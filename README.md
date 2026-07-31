# SonicPOS

Multi-tenant restaurant POS platform built with React, TypeScript, Express, and Prisma.

SonicPOS is designed for running many restaurant companies from one codebase while keeping tenant data isolated. It includes a tenant-facing POS/admin app and a SonicPOS platform admin console for cross-company operations.

## Features

- Multi-tenant architecture with tenant-aware data access
- Tenant signup and onboarding flow
- Owner and staff login flows (including Google sign-in support)
- POS workflows: floor view, orders, payments, menu building, modifiers
- Admin workflows: employees, inventory, discounts, shifts, reports, settings
- Custom inventory items (not tied to menu items)
- Expanded analytics and reporting dashboard
- Platform admin console:
  - Platform auth flow
  - Organization overview across all tenants
  - Plan/status management
  - Organization activation/deactivation

## Tech Stack

### Frontend

- React 18 + TypeScript + Vite
- Material UI (MUI)
- React Router
- React Query
- Zustand
- Axios

### Backend

- Node.js + Express + TypeScript
- Prisma ORM
- PostgreSQL
- JWT authentication
- Socket.IO
- Stripe integration hooks

## Project Structure

```text
SonicPOS/
  client/      # React + Vite frontend
  server/      # Express + Prisma backend
  package.json # Workspace scripts
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the server env template and update values:

```bash
copy server\\.env.example server\\.env
```

At minimum, set these in server/.env:

- DATABASE_URL
- JWT_SECRET
- CLIENT_URL

Optional but recommended:

- GOOGLE_CLIENT_ID
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_STARTER
- STRIPE_PRICE_PROFESSIONAL
- STRIPE_PRICE_ENTERPRISE
- PLATFORM_ADMIN_EMAIL
- PLATFORM_ADMIN_PASSWORD

### 3. Run database migrations and seed

```bash
npm run db:migrate
npm run db:seed
```

### 4. Start the app (client + server)

```bash
npm run dev
```

- Client: http://localhost:5173
- API: http://localhost:3001

## Workspace Scripts

From the repo root:

- npm run dev - Run server and client concurrently
- npm run build - Build server and client
- npm run db:migrate - Run Prisma migrations
- npm run db:seed - Seed database
- npm run db:studio - Open Prisma Studio

## Platform Admin Access

Platform admin routes are separated from tenant auth:

- Login page: /platform/login
- Dashboard: /platform/dashboard
- API auth: /api/platform/auth/*
- API admin: /api/platform/admin/*

Default fallback credentials (change immediately in production):

- Email: admin@sonicpos.com
- Password: sonicadmin123

## Tenant Isolation Notes

Tenant safety relies on authenticated tenant context. Routes that read tenant-scoped models should be protected to prevent cross-tenant leakage.

## Build and Validation

Server build:

```bash
npm run build --workspace=server
```

Client build:

```bash
npm run build --workspace=client
```

## Deployment Notes

- Use a managed PostgreSQL instance in production
- Set secure, unique secrets for JWT and platform admin credentials
- Configure Stripe and Google credentials via environment variables
- Use HTTPS and secure CORS origin settings

## License

No license has been specified yet.
