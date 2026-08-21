# Impulse Coach

Impulse Coach is a React Native fintech coaching app built with Expo, TypeScript, Supabase, Plaid, PostgreSQL, and Supabase Edge Functions. It is designed to detect impulse-spending patterns from synced transaction data and turn them into real-time coaching signals.

## Stack

- React Native with Expo and TypeScript
- Supabase Auth, Postgres, Row Level Security, and Edge Functions
- Plaid transaction sync for linked financial accounts
- Web export support for desktop validation

## What is included

- A mobile-first dashboard for discretionary spend, safe-to-spend guidance, recent transactions, and coaching signals
- A built-in Supabase email/password auth flow with persisted sessions
- Supabase client wiring for authenticated edge-function calls
- PostgreSQL schema with strict per-user data isolation through RLS
- Plaid edge functions for link token creation, encrypted public-token exchange, transaction sync, and insight generation
- Official Plaid Link launchers for both web and native
- Pattern scoring for merchant loops, spend sprees, category spikes, and high-ticket purchases
- A free mock-data demo path that runs entirely on desktop without paid services
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

For native Plaid Link testing, use a local development build instead of Expo Go:

```bash
npm run ios:devbuild
# or
npm run android:devbuild
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
PLAID_REDIRECT_URI=https://your-app-domain.example.com
PLAID_ACCESS_TOKEN_ENCRYPTION_KEY=replace-this-with-a-32-character-secret
```

## Supabase setup

1. Create a Supabase project.
2. Log into the Supabase CLI.

```bash
npm run supabase:login
```

3. Link this repo to your Supabase project ref.

```bash
npm run supabase:link
```

4. Apply the SQL migration.

```bash
npm run supabase:db:push
```

5. Add the secrets from `supabase/.env.example` to your Supabase project.
6. Deploy the edge functions.

```bash
npm run supabase:functions:deploy
```

## End-to-end flow

1. The signed-in app user requests a Plaid link token from `plaid-link-token`.
2. Plaid Link returns a `public_token` after bank authorization.
3. The app exchanges that token through `plaid-exchange-public-token`.
4. The backend encrypts and stores the Plaid access token under the current user.
5. The app triggers `plaid-sync-transactions` to ingest accounts and transactions without exposing the access token back to the client.
6. Shared scoring logic inside the edge layer classifies merchant loops, spend sprees, category spikes, and high-ticket purchases.
7. `coach-insights` summarizes recent user activity into watchlist merchants, safe-to-spend guidance, and high-signal coaching prompts.

## Free usage path

- Desktop demo: run `npm run web` and use the built-in mock data with no Supabase or Plaid account required
- Supabase: the project is compatible with Supabase's free tier for Auth, Postgres, and Edge Functions
- Plaid: the live bank-linking flow can be tested with Plaid Sandbox credentials before spending money

## Verification

These checks were used while building the project:

```bash
npm run typecheck
npm run build:web
```

## Notes

- The repo is ready to run locally, but live Supabase and Plaid credentials are still required.
- Plaid Link for React Native uses native code, so Expo Go is not sufficient. Use a development build for iOS or Android.
- The data model is optimized for fast user-scoped reads through composite indexes and RLS.
- The app now includes Plaid Link launch flows for native and web, but live linking still depends on your own Plaid Dashboard credentials, registered redirect URI, and Supabase deployment.
