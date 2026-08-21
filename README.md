# Core ERP

Multitenant Ghana business operations workspace for retail, pharmacy, water production, electrical shops, clinics, susu finance, and schools.

## Run locally

```bash
npm install
npm run dev
```

Without Supabase variables, the app runs in local demo mode. Demo accounts and activity data are stored in the browser only.

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Run `supabase/migrations/001_core_erp_foundation.sql` in the Supabase SQL editor or through the Supabase CLI.
4. Enable email authentication in Supabase Auth.
5. Restart the Vite server.

### Payment subscriptions

Apply migration `007_payment_transactions.sql`, then deploy these Edge Functions:

```bash
supabase functions deploy subscription-checkout
supabase functions deploy payment-webhook
supabase functions deploy verify-payment
supabase functions deploy invite-subordinate
```

Set these Supabase Edge Function secrets. Do not put them in `.env.local` or frontend code:

```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
supabase secrets set HUBTEL_CLIENT_ID=...
supabase secrets set HUBTEL_CLIENT_SECRET=...
supabase secrets set HUBTEL_MERCHANT_ACCOUNT=...
supabase secrets set HUBTEL_WEBHOOK_SECRET=...
supabase secrets set SUBSCRIPTION_DURATION_DAYS=30
supabase secrets set SUPABASE_FUNCTIONS_URL=https://your-project.supabase.co/functions/v1
```

Configure Paystack to send `charge.success` webhooks to `/payment-webhook/paystack` and Hubtel to send successful payment callbacks to `/payment-webhook/hubtel`. The backend verifies signatures/provider status, checks the authenticated workspace owner/admin, prevents cross-tenant references, and activates only the matching workspace subscription.

The migration creates tenant boundaries, owner profile bootstrapping, school scope configuration, audit logging, starter domain tables, and Row-Level Security policies.

## Validation

```bash
npm run build
npm run lint
```

## Project notes

The tenant workspace is available at `/dashboard`. Domain components can be connected to the starter tables as each operational workflow is completed.

---

## Vite template reference

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
