-- =============================================================================
-- 001_catalog.sql — demo catalog, fleet and a sample client (idempotent)
-- =============================================================================

INSERT INTO equipment_categories (slug, name, description, base_daily_rate, replacement_cost, sort_order, image_url) VALUES
  ('compactador-de-solo',  'Compactador de Solo (Sapo)',        'Compactador a percussão 4T, ideal para valas, aterros e bases de piso.',        180.00, 14500.00, 10, '/images/equipment/compactador-de-solo.jpg'),
  ('placa-vibratoria',     'Placa Vibratória',                  'Placa reversível para compactação de bloquetes, brita e solo granular.',        150.00,  9800.00, 20, '/images/equipment/placa-vibratoria.jpg'),
  ('martelete-rompedor',   'Martelete Rompedor 10kg',           'Rompedor elétrico SDS-Max para demolição de concreto e alvenaria.',             120.00,  6500.00, 30, '/images/equipment/martelete-rompedor.jpg'),
  ('alisadora-de-concreto','Alisadora de Concreto (Bambolê)',   'Acabadora a gasolina 36" para desempeno e alisamento de lajes e pisos.',        160.00, 11000.00, 40, '/images/equipment/alisadora-de-concreto.jpg'),
  ('cortadora-de-piso',    'Cortadora de Piso e Asfalto',       'Serra com disco diamantado 14", corte a úmido até 12 cm de profundidade.',      190.00, 13500.00, 50, '/images/equipment/cortadora-de-piso.jpg'),
  ('andaime-tubular',      'Andaime Tubular (módulo 1,5 m)',    'Módulo com 2 painéis, travessas e sapatas. Diária por módulo.',                  12.00,   650.00, 60, '/images/equipment/andaime-tubular.jpg'),
  ('escora-metalica',      'Escora Metálica Regulável',         'Escora 2,0 a 3,5 m para escoramento de lajes e vigas. Diária por peça.',          3.50,   180.00, 70, '/images/equipment/escora-metalica.jpg')
ON CONFLICT (slug) DO UPDATE SET
  image_url = EXCLUDED.image_url;

-- Physical fleet: <PREFIX>-0001 ... with a few units in maintenance.
WITH fleet(slug, prefix, units, in_maintenance) AS (
  VALUES
    ('compactador-de-solo',   'CMP',   6, 1),
    ('placa-vibratoria',      'PLV',   6, 0),
    ('martelete-rompedor',    'MRT',  10, 1),
    ('alisadora-de-concreto', 'ALS',   4, 0),
    ('cortadora-de-piso',     'CTP',   4, 1),
    ('andaime-tubular',       'AND',  60, 0),
    ('escora-metalica',       'ESC', 200, 0)
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
