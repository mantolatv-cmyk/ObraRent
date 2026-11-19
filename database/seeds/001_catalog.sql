-- =============================================================================
-- 001_catalog.sql — demo catalog, fleet and a sample client (idempotent)
-- =============================================================================

INSERT INTO equipment_categories (slug, name, description, base_daily_rate, replacement_cost, sort_order, image_url) VALUES
  ('compactador-de-solo',      'Compactador de Solo (Sapo)',                'Compactador a percussão 4T, ideal para valas, aterros e bases de piso.',                                            180.00, 14500.00,  10, '/images/equipment/compactador-de-solo.jpg'),
  ('placa-vibratoria',         'Placa Vibratória',                          'Placa reversível para compactação de bloquetes, brita e solo granular.',                                            150.00,  9800.00,  20, '/images/equipment/placa-vibratoria.jpg'),
  ('martelete-rompedor',       'Martelete Rompedor 10kg',                   'Rompedor elétrico SDS-Max para demolição de concreto e alvenaria.',                                                 120.00,  6500.00,  30, '/images/equipment/martelete-rompedor.jpg'),
  ('alisadora-de-concreto',    'Alisadora de Concreto (Bambolê)',           'Acabadora a gasolina 36" para desempeno e alisamento de lajes e pisos.',                                            160.00, 11000.00,  40, '/images/equipment/alisadora-de-concreto.jpg'),
  ('cortadora-de-piso',        'Cortadora de Piso e Asfalto',               'Serra com disco diamantado 14", corte a úmido até 12 cm de profundidade.',                                          190.00, 13500.00,  50, '/images/equipment/cortadora-de-piso.jpg'),
  ('andaime-tubular',          'Andaime Tubular (módulo 1,5 m)',            'Módulo com 2 painéis, travessas e sapatas. Diária por módulo.',                                                      12.00,   650.00,  60, '/images/equipment/andaime-tubular.jpg'),
  ('escora-metalica',          'Escora Metálica Regulável',                 'Escora 2,0 a 3,5 m para escoramento de lajes e vigas. Diária por peça.',                                              3.50,   180.00,  70, '/images/equipment/escora-metalica.jpg'),
  ('betoneira-400l',           'Betoneira 400 Litros',                      'Betoneira profissional 400L motor monofásico 2CV bivolt para preparo de concreto e argamassa em obra.',              85.00,  5800.00,  80, '/images/equipment/betoneira-400l.jpg'),
  ('vibrador-de-concreto',     'Vibrador de Concreto com Mangote',          'Motor vibrador de imersão com mangote pendular 38mm (5 metros) para adensamento de concreto sem bolhas.',            75.00,  3600.00,  90, '/images/equipment/vibrador-de-concreto.jpg'),
  ('martelete-demolidor-30kg', 'Martelete Demolidor Pesado 30kg',           'Martelo demolidor elétrico 30kg (65 Joules) encaixe sextavado para ruptura pesada de pisos, vigas e sapatas.',      170.00, 11200.00, 100, '/images/equipment/martelete-demolidor-30kg.jpg'),
  ('regua-vibratoria',         'Régua Vibratória para Concreto',            'Régua vibratória a gasolina 4T com perfil de alumínio de 3m para sarrafeamento e nivelamento rápido de pisos.',     135.00,  7400.00, 110, '/images/equipment/regua-vibratoria.jpg'),
  ('gerador-de-energia',       'Gerador de Energia 8 kVA',                  'Grupo gerador a gasolina 8 kVA partida elétrica com tomadas 110V/220V para canteiros de obras e eventos.',          240.00, 16500.00, 120, '/images/equipment/gerador-de-energia.jpg'),
  ('plataforma-andaime',       'Piso Metálico para Andaime (1,5 m)',        'Pranchão metálico antiderrapante 1,5m (NR-18) com travas de segurança para plataforma de trabalho em andaimes.',      6.00,   320.00, 130, '/images/equipment/plataforma-andaime.jpg'),
  ('guincho-de-coluna',        'Guincho de Coluna Elétrico 400kg',          'Talha elétrica de coluna 400kg com cabo de aço 30m e botoeira pendente para içamento seguro de materiais em lajes.', 95.00,  4800.00, 140, '/images/equipment/guincho-de-coluna.jpg'),
  ('motobomba-submersivel',    'Motobomba Submersível 3" (Bomba Mangote)',  'Bomba de drenagem 3" de alta vazão para esgotamento de valas, fundações, caixas e águas sujas em canteiros.',       110.00,  5200.00, 150, '/images/equipment/motobomba-submersivel.jpg')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  base_daily_rate = EXCLUDED.base_daily_rate,
  replacement_cost = EXCLUDED.replacement_cost,
  sort_order = EXCLUDED.sort_order,
  image_url = EXCLUDED.image_url;

-- Physical fleet: <PREFIX>-0001 ... with a few units in maintenance.
WITH fleet(slug, prefix, units, in_maintenance) AS (
  VALUES
    ('compactador-de-solo',      'CMP',   6, 1),
    ('betoneira-400l',           'BET',  12, 1),
    ('placa-vibratoria',         'PLV',   6, 0),
    ('vibrador-de-concreto',     'VIB',  10, 1),
    ('martelete-rompedor',       'MRT',  10, 1),
    ('martelete-demolidor-30kg', 'DEM',   6, 0),
    ('alisadora-de-concreto',    'ALS',   4, 0),
    ('regua-vibratoria',         'REG',   5, 0),
    ('cortadora-de-piso',        'CTP',   4, 1),
    ('gerador-de-energia',       'GER',   6, 0),
    ('andaime-tubular',          'AND',  60, 0),
    ('plataforma-andaime',       'PLT',  80, 0),
    ('escora-metalica',          'ESC', 200, 0),
    ('guincho-de-coluna',        'GUI',   8, 0),
    ('motobomba-submersivel',    'BMB',   6, 0)
)
INSERT INTO equipment_items (category_id, asset_tag, serial_number, status)
SELECT c.id,
       f.prefix || '-' || lpad(n::text, 4, '0'),
       'SN' || upper(substr(md5(f.prefix || n::text), 1, 10)),
       CASE WHEN n > f.units - f.in_maintenance THEN 'MAINTENANCE' ELSE 'AVAILABLE' END
FROM fleet f
JOIN equipment_categories c ON c.slug = f.slug
CROSS JOIN LATERAL generate_series(1, f.units) AS n
ON CONFLICT (asset_tag) DO NOTHING;

INSERT INTO clients (cnpj, company_name, trade_name, email, phone) VALUES
  ('11222333000181', 'Construtora Exemplo Ltda', 'Exemplo Obras', 'compras@exemplo-obras.com.br', '5511987654321')
ON CONFLICT (cnpj) DO NOTHING;
