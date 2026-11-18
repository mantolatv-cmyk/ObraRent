# Mantovani — Frontend (Web & PWA)

Aplicação web mobile-first e Progressive Web App (PWA) da plataforma **Mantovani** ("Uberização Pessoa Física e Jurídica" de locação de equipamentos para construção civil), construída com **Next.js 15 (App Router)**, **React 19**, **TypeScript** e **Tailwind CSS**.

## Principais Funcionalidades

- **Catálogo em tempo real (`/`)**: listagem de categorias de equipamentos com diária base, indicador de unidades operacionais em estoque e atalho de locação em 1 toque.
- **Checkout Wizard em 4 etapas (`/alugar`)**:
  1. **Equipamento**: seleção rápida com controles `+`/`-` de 48px+ (pré-seleção automática via `?categoria=<id>`).
  2. **Datas**: escolha de período inclusivo com atalhos de duração (`Amanhã · 1 dia`, `3 dias`, `7 dias`, `15 dias`, `30 dias`), aviso de desconto progressivo (`10%` a partir de 7 dias, `20%` a partir de 30 dias) e consulta de disponibilidade em tempo real (`GET /equipment/availability`).
  3. **Empresa & Entrega**: preenchimento automático de dados da empresa via CNPJ (`GET /clients/cnpj/:cnpj` — banco local + Receita Federal) e endereço da obra via CEP (`GET /geo/cep/:cep`), cálculo de frete por zona (`POST /rentals/quote`) e escolha do meio de pagamento (`PIX`, `CREDIT_CARD`, `BOLETO`).
  4. **Pagamento**: QR Code Pix (`pixQrCodeImage` ou renderização local via `qrcode.react`), Pix Copia e Cola com botão de cópia rápida, contagem regressiva de expiração, polling automático a cada 3s (`GET /rentals/:id`) e botão de simulação de pagamento aprovado em ambiente de teste (`POST /dev/rentals/:id/simulate-payment`).
- **Página compartilhável do pedido (`/pedidos/[id]`)**: linha do tempo de status (`PENDING_PAYMENT` → `CONFIRMED` → `ACTIVE` → `COMPLETED` / `CANCELLED`), patrimônios físicos alocados (`assetTag`), endereço de entrega, dados do CNPJ e painel de pagamento ao vivo.
- **PWA instalável & Offline (`/offline`)**: manifesto web (`manifest.webmanifest`), ícones gerados dinamicamente (`192x192`, `512x512`, `apple-icon`) e Service Worker (`public/sw.js`) com fallback offline para canteiros de obra com sinal instável.

## Variáveis de Ambiente

Copie `.env.example` para `.env.local`:

```bash
cp .env.example .env.local
```

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000/api/v1` | URL base da API RentalOps v1 |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | `5511999999999` | Número E.164 (apenas dígitos) para atendimento via WhatsApp |
| `NEXT_PUBLIC_ENABLE_DEV_SIMULATOR` | `true` | Quando `!== 'false'`, exibe o botão de simulação de aprovação de pagamento |

## Scripts

```bash
# Instalar dependências
npm install

# Servidor de desenvolvimento (http://localhost:3000)
npm run dev

# Checagem de tipos TypeScript
npm run typecheck

# Lint (ESLint + Next Core Web Vitals)
npm run lint

# Build de produção
npm run build

# Iniciar servidor de produção
npm run start
```
