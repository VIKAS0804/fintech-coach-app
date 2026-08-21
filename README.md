# Impulse Coach

Impulse Coach is a React Native fintech coaching app built with Expo, TypeScript, Supabase, Plaid, PostgreSQL, and Supabase Edge Functions. It is designed to detect impulse-spending patterns from synced transaction data and turn them into real-time coaching signals.

## Stack

- React Native with Expo and TypeScript
- Supabase Auth, Postgres, Row Level Security, and Edge Functions
- Plaid transaction sync for linked financial accounts
- Web export support for desktop validation

## What is included

- A mobile-first dashboard for discretionary spend, recent transactions, and coaching signals
- A built-in Supabase email/password auth flow with persisted sessions
- Supabase client wiring for authenticated edge-function calls
- PostgreSQL schema with strict per-user data isolation through RLS
- Plaid edge functions for link token creation, public-token exchange, transaction sync, and insight generation
- Web build support so the app can be validated from desktop too

## Project structure

- `App.tsx` boots the client and loads the dashboard experience
- `src/` contains app config, mock data, Supabase/Plaid helpers, types, and screens
- `supabase/migrations/` contains the database schema and RLS policies
- `supabase/functions/` contains the edge functions used by the client

## Quick start

1. Install dependencies.

```bash
npm install
```

2. Create the app environment file.

```bash
cp .env.example .env
```

3. Create the Supabase function environment file.

```bash
cp supabase/.env.example supabase/.env
```

4. Start the app locally.

```bash
npm start
```

5. Run the verification checks.

```bash
npm run check
```

## Environment variables

### App

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Edge functions

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=sandbox
PLAID_VERSION=2020-09-14
```

## Supabase setup

1. Create a Supabase project.
2. Apply the SQL migration in `supabase/migrations/20260821071900_init_fintech_schema.sql`.
3. Add the secrets from `supabase/.env.example` to your Supabase project.
4. Deploy the edge functions.

```bash
supabase functions deploy plaid-link-token
supabase functions deploy plaid-exchange-public-token
supabase functions deploy plaid-sync-transactions
supabase functions deploy coach-insights
```

## End-to-end flow

1. The signed-in app user requests a Plaid link token from `plaid-link-token`.
2. Plaid Link returns a `public_token` after bank authorization.
3. The app exchanges that token through `plaid-exchange-public-token`.
4. The backend stores the Plaid item metadata under the current user.
5. The app triggers `plaid-sync-transactions` to ingest accounts and transactions.
6. `coach-insights` summarizes recent user activity into high-signal coaching prompts.

## Verification

These checks were used while building the project:

```bash
npm run typecheck
npm run build:web
```

## Notes

- The repo is ready to run locally, but live Supabase and Plaid credentials are still required.
- The data model is optimized for fast user-scoped reads through composite indexes and RLS.
- The current UI includes the backend integration points and dashboard shell; live account-link launch still depends on your chosen Plaid Link client implementation for native/web.
