# Mantovani — Pessoa Física e Jurídica Equipment Rental Platform ("Uberização Pessoa Física e Jurídica")

Full-stack automated Construction equipment rental platform platform for compactors, jackhammers, vibratory plates, concrete trowels, floor saws, scaffolding, and shoring.

## System Architecture

1. **Modern Minimalist PWA Frontend (`frontend/`)** — Next.js 15 (App Router), TypeScript, Tailwind CSS, Geist Sans/Mono, and Lucide React icons. Engineered for outdoor construction-site sunlight readability, 48px+ touch targets, and a 4-step frictionless checkout flow with automatic CNPJ/CEP lookups and instant Pix QR Code generation.
2. **RESTful API Backend (`backend/`)** — Node.js + Express 5 + TypeScript modular architecture (`routes` -> `services` -> `repositories` -> `db`) with Zod validation, structured error envelopes, and parameterized PostgreSQL queries.
3. **PostgreSQL Relational Database (`database/`)** — Relational schema with UUID primary keys, foreign key constraints, composite indexes, and a `btree_gist` `EXCLUDE` constraint on `rental_items` (`daterange`) combined with transaction-scoped advisory locks and `SELECT ... FOR UPDATE` to prevent overbooking atomically.
4. **WhatsApp State Machine Bot (`POST /api/v1/webhooks/whatsapp`)** — Stateful conversation engine backed by `whatsapp_sessions` (`IDLE` -> `AWAITING_CATEGORY` -> `AWAITING_DATES` -> `AWAITING_ADDRESS` -> `IDLE`) compatible with Evolution API and Meta Cloud API.
5. **Payment Gateway Webhook (`POST /api/v1/webhooks/gateway`)** — Handles Asaas and Pagar.me payment events idempotently, updates payment status to `PAID`, transitions the contract to `CONFIRMED`, assigns physical assets (`asset_tag`), and dispatches an automated WhatsApp confirmation to the contractor.

---

## Repository Structure

```text
.
├── database/
│   ├── migrations/
│   │   └── 001_init.sql          # Relational DDL, FK constraints, indexes & GiST EXCLUDE constraint
│   └── seeds/
│       └── 001_catalog.sql       # 7 Pessoa Física e Jurídica equipment categories, 290 tagged physical units, sample client
├── backend/
│   ├── src/
│   │   ├── config/env.ts         # Zod-validated environment configuration
│   │   ├── db/                   # pg Pool, BEGIN/COMMIT/ROLLBACK transaction helper, migrations, PGlite dev server
│   │   ├── lib/                  # Domain errors, CNPJ validator, BR Code EMV Pix generator, date/money utils
│   │   ├── middleware/           # Centralized JSON error handler
│   │   ├── repositories/         # Parameterized SQL repositories (equipment, client, rental, payment, whatsapp-session)
│   │   ├── services/             # Business logic (availability, checkout, freight, CNPJ/CEP, gateway, WhatsApp bot)
│   │   ├── routes/               # Express routers (/api/v1/equipment, /rentals, /clients, /geo, /webhooks, /dev)
│   │   ├── app.ts                # Express app factory
│   │   └── server.ts             # HTTP server bootstrap + expired reservation hold sweeper
│   └── tests/
│       └── integration.test.ts   # End-to-end integration tests against PostgreSQL (PGlite WASM)
├── frontend/
│   ├── public/sw.js              # Offline-capable PWA Service Worker
│   └── src/
│       ├── app/                  # Next.js App Router (/, /alugar, /pedidos/[id], /offline, manifest.ts, icons)
│       ├── components/           # Minimalist high-contrast UI primitives, catalog cards, checkout wizard, order view
│       ├── hooks/                # Real-time availability, auto CNPJ/CEP lookup, quote & payment polling hooks
│       └── lib/                  # Typed API client, formatters, and validators
├── docs/
│   └── API.md                    # Complete REST API v1 contract
└── docker-compose.yml            # PostgreSQL 16 container with auto-initialized schema and seed
```

---

## Quick Start

### 1. Database & Backend API

You can run against either Docker PostgreSQL (`docker compose up -d`) or the built-in zero-install PGlite PostgreSQL server:

```bash
cd backend
cp .env.example .env

# Option A: Zero-install local PostgreSQL server (in a separate terminal)
npm run db:dev

# Run migrations and seed catalog
npm run db:migrate
npm run db:seed

# Start the API server on http://localhost:4000
npm run dev
```

Run the end-to-end integration test suite (no external database process required):

```bash
cd backend
npm test
```

### 2. Frontend PWA

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` in your browser.
