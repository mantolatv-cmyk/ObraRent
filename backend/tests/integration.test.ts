import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DB_POOL_MAX = '1';
process.env.GATEWAY_WEBHOOK_TOKEN = 'test-webhook-secret-token';

/**
 * Bridges Node `pg.Pool` (`pool.connect()` and `pool.query()`) directly to an
 * in-process PGlite instance (PostgreSQL 17 WASM with `btree_gist` enabled),
 * avoiding TCP socket contention while executing 100% real PostgreSQL SQL,
 * transactions (`BEGIN`/`COMMIT`/`ROLLBACK`), `FOR UPDATE` locks, and GiST
 * `EXCLUDE` constraints.
 */
let pglite: PGlite;

vi.mock('../src/db/pool', () => {
  const queryable = {
    async query(text: string, values?: unknown[]) {
      const res = await pglite.query(text, values);
      return {
        rows: res.rows,
        rowCount: res.affectedRows ?? res.rows.length,
      };
    },
    async connect() {
      return {
        async query(text: string, values?: unknown[]) {
          const res = await pglite.query(text, values);
          return {
            rows: res.rows,
            rowCount: res.affectedRows ?? res.rows.length,
          };
        },
        release() {
          // no-op for single-session PGlite
        },
      };
    },
    async end() {
      // closed in afterAll
    },
    on() {
      return this;
    },
  };

  return {
    pool: queryable,
    checkDatabase: async () => true,
  };
});

describe('Mantovani API — End-to-End Integration Suite', () => {
  let app: ReturnType<typeof import('../src/create-app').createApp>;
  let whatsappProviderService: typeof import('../src/services/whatsapp-provider.service').whatsappProviderService;

  beforeAll(async () => {
    pglite = await PGlite.create({ extensions: { btree_gist } });
    // Ensure DATE (OID 1082) is returned as YYYY-MM-DD string
    pglite.parsers[1082] = (val: string) => val;

    const dbRoot = path.resolve(__dirname, '../../database');
    const migration1Sql = await readFile(path.join(dbRoot, 'migrations/001_init.sql'), 'utf8');
    const migration2Sql = await readFile(path.join(dbRoot, 'migrations/002_enhancements.sql'), 'utf8');
    const seedSql = await readFile(path.join(dbRoot, 'seeds/001_catalog.sql'), 'utf8');

    await pglite.exec(migration1Sql);
    await pglite.exec(migration2Sql);
    await pglite.exec(seedSql);

    const appModule = await import('../src/create-app');
    const waModule = await import('../src/services/whatsapp-provider.service');
    app = appModule.createApp();
    whatsappProviderService = waModule.whatsappProviderService;
  });

  afterAll(async () => {
    await pglite.close();
  });

  it('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('GET /api/v1/equipment/categories returns the 15 seeded equipment categories', async () => {
    const res = await request(app).get('/api/v1/equipment/categories');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(15);

    const compactor = res.body.data.find((c: { slug: string }) => c.slug === 'compactador-de-solo');
    expect(compactor).toBeDefined();
    expect(compactor.baseDailyRate).toBe(180);

    const mixer = res.body.data.find((c: { slug: string }) => c.slug === 'betoneira-400l');
    expect(mixer).toBeDefined();
    expect(mixer.baseDailyRate).toBe(85);
    expect(mixer.operationalUnits).toBe(11);
    expect(compactor.totalUnits).toBe(6);
    expect(compactor.operationalUnits).toBe(5); // 6 total, 1 in MAINTENANCE
  });

  it('GET /api/v1/equipment/availability checks physical inventory and excludes MAINTENANCE items', async () => {
    const catRes = await request(app).get('/api/v1/equipment/categories');
    const compactor = catRes.body.data.find((c: { slug: string }) => c.slug === 'compactador-de-solo');

    const availRes = await request(app)
      .get('/api/v1/equipment/availability')
      .query({
        start_date: '2026-12-01',
        end_date: '2026-12-05',
        category_id: compactor.id,
      });

    expect(availRes.status).toBe(200);
    expect(availRes.body.data.days).toBe(5);
    expect(availRes.body.data.categories).toHaveLength(1);
    expect(availRes.body.data.categories[0].availableCount).toBe(5);
    expect(availRes.body.data.categories[0].availableItems).toHaveLength(5);
    expect(availRes.body.data.categories[0].availableItems[0].assetTag).toBe('CMP-0001');
  });

  it('POST /api/v1/rentals allocates physical assets, generates Pix QR/Copy-Paste, and prevents overbooking', async () => {
    const catRes = await request(app).get('/api/v1/equipment/categories');
    const trowel = catRes.body.data.find((c: { slug: string }) => c.slug === 'alisadora-de-concreto');
    expect(trowel.operationalUnits).toBe(4);

    // 1. Create a rental for 3 out of 4 concrete trowels for 2026-12-10..2026-12-12 (3 days)
    const createRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        client: {
          cnpj: '11.222.333/0001-81',
          companyName: 'Construtora Exemplo Ltda',
          email: 'obras@exemplo.com.br',
          phone: '11987654321',
        },
        startDate: '2026-12-10',
        endDate: '2026-12-12',
        items: [{ categoryId: trowel.id, quantity: 3 }],
        deliveryAddress: {
          cep: '01310-100',
          street: 'Av. Paulista',
          number: '1578',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        paymentMethod: 'PIX',
      });

    expect(createRes.status).toBe(201);
    const rental = createRes.body.data;
    expect(rental.code).toMatch(/^LOC-[0-9A-F]{6}$/);
    expect(rental.status).toBe('PENDING_PAYMENT');
    expect(rental.days).toBe(3);
    expect(rental.items).toHaveLength(3);
    expect(rental.items.map((i: { assetTag: string }) => i.assetTag)).toEqual([
      'ALS-0001',
      'ALS-0002',
      'ALS-0003',
    ]);
    expect(rental.payment.method).toBe('PIX');
    expect(rental.payment.pixKey).toBe('52342052000140');
    expect(rental.payment.pixMerchantName).toBe('MAQUINAS PARA CONCRETO');
    expect(rental.payment.pixMerchantCity).toBe('ATIBAIA');
    expect(rental.payment.pixCopyPaste).toContain('000201');
    expect(rental.payment.pixCopyPaste).toContain('010211');
    expect(rental.payment.pixCopyPaste).toContain('br.gov.bcb.pix');
    expect(rental.payment.pixCopyPaste).toContain('52342052000140');
    expect(rental.payment.pixQrCodeImage).toMatch(/^data:image\/png;base64,/);

    // 2. Availability on overlapping period (2026-12-11..2026-12-14) should now report only 1 unit left
    const overlapAvail = await request(app)
      .get('/api/v1/equipment/availability')
      .query({
        start_date: '2026-12-11',
        end_date: '2026-12-14',
        category_id: trowel.id,
      });
    expect(overlapAvail.status).toBe(200);
    expect(overlapAvail.body.data.categories[0].availableCount).toBe(1);
    expect(overlapAvail.body.data.categories[0].availableItems[0].assetTag).toBe('ALS-0004');

    // 3. Attempting to book 2 units on overlapping dates must fail with 409 INSUFFICIENT_AVAILABILITY and rollback
    const overbookRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        client: { cnpj: '11222333000181' },
        startDate: '2026-12-11',
        endDate: '2026-12-13',
        items: [{ categoryId: trowel.id, quantity: 2 }],
        deliveryAddress: {
          cep: '01310100',
          street: 'Av. Paulista',
          number: '900',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        paymentMethod: 'PIX',
      });
    expect(overbookRes.status).toBe(409);
    expect(overbookRes.body.error.code).toBe('INSUFFICIENT_AVAILABILITY');
    expect(overbookRes.body.error.details[0]).toMatchObject({
      categoryId: trowel.id,
      requested: 2,
      available: 1,
    });

    // 4. Non-overlapping period (2026-12-20..2026-12-22) still has all 4 units available
    const futureAvail = await request(app)
      .get('/api/v1/equipment/availability')
      .query({
        start_date: '2026-12-20',
        end_date: '2026-12-22',
        category_id: trowel.id,
      });
    expect(futureAvail.status).toBe(200);
    expect(futureAvail.body.data.categories[0].availableCount).toBe(4);
  });

  it('POST /api/v1/webhooks/gateway approves payment, confirms rental, assigns assets, and sends WhatsApp alert', async () => {
    whatsappProviderService.clearOutbox();
    const catRes = await request(app).get('/api/v1/equipment/categories');
    const saw = catRes.body.data.find((c: { slug: string }) => c.slug === 'cortadora-de-piso');

    const createRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        client: {
          cnpj: '11222333000181',
          companyName: 'Construtora Exemplo Ltda',
          phone: '5511998887766',
        },
        startDate: '2026-12-15',
        endDate: '2026-12-16',
        items: [{ categoryId: saw.id, quantity: 1 }],
        deliveryAddress: {
          cep: '04538132',
          street: 'Av. Brig. Faria Lima',
          number: '3477',
          district: 'Itaim Bibi',
          city: 'São Paulo',
          state: 'SP',
        },
        paymentMethod: 'PIX',
      });

    expect(createRes.status).toBe(201);
    const rental = createRes.body.data;
    const gatewayTxId = rental.payment.gatewayTxId;

    // Fire Asaas-formatted PAYMENT_CONFIRMED webhook
    const webhookRes = await request(app)
      .post('/api/v1/webhooks/gateway')
      .set('asaas-access-token', 'test-webhook-secret-token')
      .send({
        id: `evt_${gatewayTxId}`,
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: gatewayTxId,
          externalReference: rental.id,
          billingType: 'PIX',
          value: rental.totalAmount,
        },
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.data.processed).toBe(true);
    expect(webhookRes.body.data.rental.status).toBe('CONFIRMED');
    expect(webhookRes.body.data.rental.payment.status).toBe('PAID');

    // Outbox must contain both the client WhatsApp confirmation and the company warehouse separation order
    const outbox = whatsappProviderService.getOutbox();
    expect(outbox.length).toBeGreaterThanOrEqual(2);
    const clientMsg = outbox.find((m) => m.to === '5511998887766');
    expect(clientMsg).toBeDefined();
    expect(clientMsg!.text).toContain(rental.code);
    expect(clientMsg!.text).toContain('CTP-0001');

    const warehouseMsg = outbox[outbox.length - 1]!;
    expect(warehouseMsg.text).toContain('ORDEM DE SEPARAÇÃO DE ESTOQUE');
    expect(warehouseMsg.text).toContain(rental.code);
    expect(warehouseMsg.text).toContain('CTP-0001');

    // Sending the exact same webhook event again is idempotently ignored
    const duplicateRes = await request(app)
      .post('/api/v1/webhooks/gateway')
      .set('asaas-access-token', 'test-webhook-secret-token')
      .send({
        id: `evt_${gatewayTxId}`,
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: gatewayTxId,
          externalReference: rental.id,
        },
      });
    expect(duplicateRes.status).toBe(200);
    expect(duplicateRes.body.data.duplicate).toBe(true);
  });

  it('POST /api/v1/webhooks/whatsapp drives the full State Machine journey (IDLE -> CATEGORY -> DATES -> ADDRESS -> PIX & IDLE)', async () => {
    const phone = '5511977776655';

    // Step 1: IDLE -> trigger keyword "preciso alugar" -> AWAITING_CATEGORY
    const step1 = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        event: 'messages.upsert',
        data: {
          key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: 'msg-1' },
          pushName: 'Eng. Marcos',
          message: { conversation: 'Olá, preciso alugar um equipamento para obra' },
        },
      });

    expect(step1.status).toBe(200);
    expect(step1.body.data.replies[0]).toMatchObject({
      phoneNumber: phone,
      previousState: 'IDLE',
      nextState: 'AWAITING_CATEGORY',
    });
    expect(step1.body.data.replies[0].replyText).toContain('Compactador de Solo');

    // Step 2: AWAITING_CATEGORY -> select option "2" (Placa Vibratória) -> AWAITING_DATES
    const step2 = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        event: 'messages.upsert',
        data: {
          key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: 'msg-2' },
          pushName: 'Eng. Marcos',
          message: { conversation: '2' },
        },
      });

    expect(step2.status).toBe(200);
    expect(step2.body.data.replies[0]).toMatchObject({
      phoneNumber: phone,
      previousState: 'AWAITING_CATEGORY',
      nextState: 'AWAITING_DATES',
    });
    expect(step2.body.data.replies[0].replyText).toContain('Placa Vibratória');

    // Step 3: AWAITING_DATES -> send "5 dias" -> AWAITING_ADDRESS
    const step3 = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        event: 'messages.upsert',
        data: {
          key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: 'msg-3' },
          pushName: 'Eng. Marcos',
          message: { conversation: '5 dias' },
        },
      });

    expect(step3.status).toBe(200);
    expect(step3.body.data.replies[0]).toMatchObject({
      phoneNumber: phone,
      previousState: 'AWAITING_DATES',
      nextState: 'AWAITING_ADDRESS',
    });
    expect(step3.body.data.replies[0].replyText).toContain('5 dia(s)');

    // Step 4: AWAITING_ADDRESS -> send delivery address -> creates rental, returns Pix code, resets to IDLE
    const step4 = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        event: 'messages.upsert',
        data: {
          key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false, id: 'msg-4' },
          pushName: 'Eng. Marcos',
          message: {
            conversation: 'Rua Vergueiro, 1000 - Paraíso, São Paulo - SP, CEP 04101-000',
          },
        },
      });

    expect(step4.status).toBe(200);
    const reply4 = step4.body.data.replies[0];
    expect(reply4.previousState).toBe('AWAITING_ADDRESS');
    expect(reply4.nextState).toBe('IDLE');
    expect(reply4.rentalId).toBeDefined();
    expect(reply4.replyText).toContain('Contrato LOC-');
    expect(reply4.replyText).toContain('PLV-0001');
    expect(reply4.replyText).toContain('000201'); // EMV Pix Copy-Paste payload

    // Session inspector endpoint returns IDLE state and outbox messages
    const sessionRes = await request(app).get(`/api/v1/webhooks/whatsapp/session/${phone}`);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.session.currentState).toBe('IDLE');
    expect(sessionRes.body.data.outbox.length).toBeGreaterThanOrEqual(4);
  });

  it('Rental Creation, Contract PDF data, Express Extension, and Yard Operations', async () => {
    const catRes = await request(app).get('/api/v1/equipment/categories');
    const jackhammer = catRes.body.data.find((c: { slug: string }) => c.slug === 'martelete-rompedor');

    // 1. Seeded client 11222333000181 is found in local DB
    const lookupRes = await request(app).get('/api/v1/clients/cnpj/11222333000181');
    expect(lookupRes.status).toBe(200);
    expect(lookupRes.body.data.registered).toBe(true);
    expect(lookupRes.body.data.companyName).toBe('Construtora Exemplo Ltda');

    // 2. Create rental with PIX -> PENDING_PAYMENT -> simulate payment -> CONFIRMED
    const createRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        client: { cnpj: '11222333000181' },
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        items: [{ categoryId: jackhammer.id, quantity: 2 }],
        deliveryAddress: {
          cep: '01310100',
          street: 'Av. Paulista',
          number: '2000',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
        paymentMethod: 'PIX',
      });

    expect(createRes.status).toBe(201);
    let rental = createRes.body.data;
    expect(rental.status).toBe('PENDING_PAYMENT');
    expect(rental.payment.method).toBe('PIX');
    expect(rental.days).toBe(3);

    // Approve payment to transition to CONFIRMED
    const payRes = await request(app).post(`/api/v1/rentals/${rental.id}/simulate-payment`);
    expect(payRes.status).toBe(200);
    rental = payRes.body.data;
    expect(rental.status).toBe('CONFIRMED');

    // 3. Extend rental by +4 days (total 7 days)
    const extendRes = await request(app)
      .post(`/api/v1/rentals/${rental.id}/extend`)
      .send({ additionalDays: 4 });
    expect(extendRes.status).toBe(200);
    expect(extendRes.body.data.days).toBe(7);
    expect(extendRes.body.data.endDate).toBe('2026-12-07');

    // 4. Fetch formal Contract & Romaneio document
    const contractRes = await request(app).get(`/api/v1/rentals/${rental.id}/contract`);
    expect(contractRes.status).toBe(200);
    expect(contractRes.body.data.documentNumber).toContain('CTR-');
    expect(contractRes.body.data.assets).toHaveLength(2);
    expect(contractRes.body.data.totalReplacementValue).toBe(13000);

    // 5. Yard dispatch (CONFIRMED -> ACTIVE) and return with 1 unit sent to MAINTENANCE (ACTIVE -> COMPLETED)
    const dispatchRes = await request(app).post(`/api/v1/rentals/${rental.id}/dispatch`);
    expect(dispatchRes.status).toBe(200);
    expect(dispatchRes.body.data.status).toBe('ACTIVE');

    const firstTag = rental.items[0].assetTag;
    const returnRes = await request(app)
      .post(`/api/v1/rentals/${rental.id}/return`)
      .send({ maintenanceAssetTags: [firstTag] });
    expect(returnRes.status).toBe(200);
    expect(returnRes.body.data.status).toBe('COMPLETED');

    // 6. Fleet endpoint reflects the unit in MAINTENANCE
    const fleetRes = await request(app)
      .get('/api/v1/equipment/fleet')
      .query({ category_id: jackhammer.id });
    expect(fleetRes.status).toBe(200);
    const maintainedUnit = fleetRes.body.data.items.find(
      (i: { assetTag: string }) => i.assetTag === firstTag,
    );
    expect(maintainedUnit.status).toBe('MAINTENANCE');
  });

  it('Dynamic WhatsApp AI Assistant directly answers questions and performs natural language rentals', async () => {
    const aiPhone = '5511966665544';

    // 1. Direct question about equipment price and specs
    const priceQRes = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        phone: aiPhone,
        text: 'Quanto custa a diária do martelete?',
      });
    expect(priceQRes.status).toBe(200);
    const reply1 = priceQRes.body.data.replies[0];
    expect(reply1.nextState).toBe('IDLE');
    expect(reply1.replyText).toContain('Martelete Rompedor');
    expect(reply1.replyText).toContain('120,00/dia');

    // 2. Direct question about technical difference (Sapo vs Placa)
    const diffQRes = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        phone: aiPhone,
        text: 'Qual a diferença entre a placa vibratória e o compactador sapo?',
      });
    expect(diffQRes.status).toBe(200);
    const reply2 = diffQRes.body.data.replies[0];
    expect(reply2.nextState).toBe('IDLE');
    expect(reply2.replyText).toContain('Diferença Técnica');
    expect(reply2.replyText).toContain('Compactador de Solo (Sapo)');
    expect(reply2.replyText).toContain('Placa Vibratória');

    // 3. Direct question about freight
    const freightQRes = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        phone: aiPhone,
        text: 'Quanto custa o frete para o CEP 01310-100?',
      });
    expect(freightQRes.status).toBe(200);
    const reply3 = freightQRes.body.data.replies[0];
    expect(reply3.replyText).toContain('Logística & Frete');
    expect(reply3.replyText).toContain('01310-100');

    // 4. One-Shot Natural Language Rental (Equipment + Dates + Address in 1 single message!)
    const oneShotRes = await request(app)
      .post('/api/v1/webhooks/whatsapp')
      .send({
        phone: aiPhone,
        pushName: 'Construtora Delta',
        text: 'Quero alugar 2 compactadores a partir de amanhã por 3 dias para a Av Paulista 1000, CEP 01310-100',
      });
    expect(oneShotRes.status).toBe(200);
    const reply4 = oneShotRes.body.data.replies[0];
    expect(reply4.nextState).toBe('IDLE');
    expect(reply4.rentalId).toBeDefined();
    expect(reply4.replyText).toContain('Pedido gerado com sucesso!');
    expect(reply4.replyText).toContain('2x Compactador de Solo (Sapo)');
    expect(reply4.replyText).toContain('000201'); // Pix code
  });

  it('Client Authentication System: Register, Login with Email or CPF, and Get Profile via Bearer token', async () => {
    // 1. Register a new client with CPF and password
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        cnpj: '72384784048', // valid CPF
        companyName: 'Engenheiro Lucas Martins',
        tradeName: 'Lucas Obras',
        email: 'lucas@martins.eng.br',
        phone: '11988887777',
        password: 'senhaSegura123',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.data.client.cnpj).toBe('72384784048');
    expect(regRes.body.data.client.companyName).toBe('Engenheiro Lucas Martins');
    expect(regRes.body.data.token).toBeDefined();

    // 2. Duplicate registration with same CPF and active password must fail
    const dupRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        cnpj: '72384784048',
        companyName: 'Outro Nome',
        email: 'outro@email.com',
        password: 'outrasenha123',
      });
    expect(dupRes.status).toBe(400);

    // 3. Login with email
    const loginEmailRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'lucas@martins.eng.br',
        password: 'senhaSegura123',
      });
    expect(loginEmailRes.status).toBe(200);
    const token = loginEmailRes.body.data.token;
    expect(token).toBeDefined();

    // 4. Login with CPF (11 digits)
    const loginCpfRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: '72384784048',
        password: 'senhaSegura123',
      });
    expect(loginCpfRes.status).toBe(200);

    // 5. Login with invalid password fails 401
    const badPassRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'lucas@martins.eng.br',
        password: 'senhaErrada',
      });
    expect(badPassRes.status).toBe(401);

    // 6. Access /api/v1/auth/me with Bearer token
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.cnpj).toBe('72384784048');
    expect(meRes.body.data.companyName).toBe('Engenheiro Lucas Martins');

    // 7. Access /api/v1/auth/me without token fails 401
    const unauthRes = await request(app).get('/api/v1/auth/me');
    expect(unauthRes.status).toBe(401);
  });

  it('operational time slots: calculates capacity proportional to fleet, locks slot upon selection, and rejects overbooking', async () => {
    // 1. Get categories to get compactador ID
    const catRes = await request(app).get('/api/v1/equipment/categories');
    const compactor = catRes.body.data.find((c: { slug: string }) => c.slug === 'compactador-de-solo');
    expect(compactor).toBeDefined();

    const targetDate = '2027-01-15';

    // 2. Query time slots for target date for compactador
    const initialSlotsRes = await request(app)
      .get(`/api/v1/equipment/time-slots?date=${targetDate}&category_ids=${compactor.id}&quantities=1`);
    expect(initialSlotsRes.status).toBe(200);
    const slots = initialSlotsRes.body.data.slots;
    expect(slots.length).toBe(6);

    // Initial slot 07:30 - 09:00 should be available with capacity 1
    const slot1 = slots.find((s: { slot: string }) => s.slot === '07:30 - 09:00');
    expect(slot1).toBeDefined();
    expect(slot1.available).toBe(true);
    expect(slot1.categories[0].slotCapacity).toBe(1);
    expect(slot1.categories[0].bookedUnits).toBe(0);
    expect(slot1.categories[0].availableUnits).toBe(1);

    // 3. Create a rental booking for that specific time slot
    const createRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        startDate: targetDate,
        endDate: targetDate,
        items: [{ categoryId: compactor.id, quantity: 1 }],
        deliveryTimeSlot: '07:30 - 09:00',
        paymentMethod: 'PIX',
        client: {
          cnpj: '11222333000181',
          companyName: 'Construtora Teste Slots',
          email: 'teste@slots.com',
          phone: '11999998888',
        },
        deliveryAddress: {
          cep: '01310100',
          street: 'Avenida Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.deliveryTimeSlot).toBe('07:30 - 09:00');

    // 4. Query time slots again - slot 07:30 - 09:00 must now be unavailable (booked/esgotado)!
    const afterBookingRes = await request(app)
      .get(`/api/v1/equipment/time-slots?date=${targetDate}&category_ids=${compactor.id}&quantities=1`);
    expect(afterBookingRes.status).toBe(200);
    const updatedSlot1 = afterBookingRes.body.data.slots.find((s: { slot: string }) => s.slot === '07:30 - 09:00');
    expect(updatedSlot1.available).toBe(false);
    expect(updatedSlot1.reason).toContain('Esgotado para Compactador de Solo');
    expect(updatedSlot1.categories[0].bookedUnits).toBe(1);
    expect(updatedSlot1.categories[0].availableUnits).toBe(0);

    // Other slots like 09:00 - 10:30 should still be available!
    const slot2 = afterBookingRes.body.data.slots.find((s: { slot: string }) => s.slot === '09:00 - 10:30');
    expect(slot2.available).toBe(true);

    // 5. Trying to book again in the exhausted slot 07:30 - 09:00 must fail with validation error!
    const overbookRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        startDate: targetDate,
        endDate: targetDate,
        items: [{ categoryId: compactor.id, quantity: 1 }],
        deliveryTimeSlot: '07:30 - 09:00',
        paymentMethod: 'PIX',
        client: {
          cnpj: '11222333000181',
          companyName: 'Outra Empresa',
          email: 'outra@slots.com',
          phone: '11999997777',
        },
        deliveryAddress: {
          cep: '01310100',
          street: 'Avenida Paulista',
          number: '1000',
          district: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
        },
      });
    expect(overbookRes.status).toBe(400);
    expect(overbookRes.body.error.message).toContain('já está esgotado');
  });

  it('11. Cash payment applies 8% discount on quote and rental creation', async () => {
    const catsRes = await request(app).get('/api/v1/equipment/categories');
    const plate = catsRes.body.data.find((c: { slug: string }) => c.slug === 'placa-vibratoria');
    expect(plate).toBeDefined();

    // Base daily rate of placa-vibratoria is R$ 150.00 -> 2 days = R$ 300.00 subtotal
    // 8% cash discount = R$ 24.00 -> totalAmount = R$ 276.00
    const quoteRes = await request(app)
      .post('/api/v1/rentals/quote')
      .send({
        startDate: '2026-12-20',
        endDate: '2026-12-21',
        paymentMethod: 'CASH',
        items: [{ categoryId: plate.id, quantity: 1 }],
      });
    expect(quoteRes.status).toBe(200);
    expect(quoteRes.body.data.subtotal).toBe(300);
    expect(quoteRes.body.data.cashDiscountPct).toBe(8);
    expect(quoteRes.body.data.cashDiscountAmount).toBe(24);
    expect(quoteRes.body.data.totalAmount).toBe(276);

    const createRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        startDate: '2026-12-20',
        endDate: '2026-12-21',
        paymentMethod: 'CASH',
        items: [{ categoryId: plate.id, quantity: 1 }],
        client: {
          cnpj: '52342052000140',
          companyName: 'Maquinas para Concreto Atibaiense Ltda',
          email: 'caixa@mantovani.com.br',
          phone: '11988887777',
        },
        deliveryAddress: {
          cep: '12944430',
          street: 'Rua Bragança Paulista',
          number: '132',
          district: 'Centro',
          city: 'Atibaia',
          state: 'SP',
        },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.payment.method).toBe('CASH');
    expect(createRes.body.data.subtotal).toBe(300);
    expect(createRes.body.data.cashDiscountPct).toBe(8);
    expect(createRes.body.data.cashDiscountAmount).toBe(24);
    expect(createRes.body.data.totalAmount).toBe(276);
    expect(createRes.body.data.payment.amount).toBe(276);
  });

  it('12. POST /api/v1/rentals/:id/activate confirms the contract and sends the equipment separation order to the company WhatsApp number', async () => {
    const catsRes = await request(app).get('/api/v1/equipment/categories');
    const prop = catsRes.body.data.find((c: { slug: string }) => c.slug === 'escora-metalica');
    expect(prop).toBeDefined();

    const createRes = await request(app)
      .post('/api/v1/rentals')
      .send({
        startDate: '2026-12-22',
        endDate: '2026-12-23',
        paymentMethod: 'CASH',
        deliveryTimeSlot: '09:00 - 10:30',
        items: [{ categoryId: prop.id, quantity: 1 }],
        client: {
          cnpj: '52342052000140',
          companyName: 'Obra Atibaia Engenharia Ltda',
          email: 'obra@atibaia.com.br',
          phone: '11977776666',
        },
        deliveryAddress: {
          cep: '12944430',
          street: 'Rua Bragança Paulista',
          number: '132',
          district: 'Centro',
          city: 'Atibaia',
          state: 'SP',
        },
      });
    expect(createRes.status).toBe(201);
    const rentalId = createRes.body.data.id;
    const rentalCode = createRes.body.data.code;
    expect(createRes.body.data.status).toBe('PENDING_PAYMENT');
    expect(createRes.body.data.warehouseWhatsappUrl).toContain('https://wa.me/');

    const activateRes = await request(app)
      .post(`/api/v1/rentals/${rentalId}/activate`)
      .send({ companyPhone: '5511999999999' });

    expect(activateRes.status).toBe(200);
    expect(activateRes.body.data.status).toBe('CONFIRMED');
    expect(activateRes.body.data.warehouseNotifiedAt).toBeTruthy();
    expect(activateRes.body.data.warehouseWhatsappUrl).toContain('https://wa.me/5511999999999?text=');

    const outbox = whatsappProviderService.getOutbox();
    const lastMsg = outbox[outbox.length - 1]!;
    expect(lastMsg.to).toBe('5511999999999');
    expect(lastMsg.text).toContain('ORDEM DE SEPARAÇÃO DE ESTOQUE — MANTOVANI');
    expect(lastMsg.text).toContain(rentalCode);
    expect(lastMsg.text).toContain('ESC-0001');
    expect(lastMsg.text).toContain('09:00 - 10:30');
  });
});
