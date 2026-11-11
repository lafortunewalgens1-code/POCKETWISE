# LAFORTUNE POCKET

LAFORTUNE POCKET is a responsive personal finance app for USD and HTG income, expenses, budgets, savings goals, reports, and Safe to Spend planning. The existing HTML, CSS, and JavaScript interface is retained and connects directly to Supabase Auth and Postgres.

## Configure Supabase

1. In Netlify, open the existing site's **Site configuration > Environment variables**.
2. Add `SUPABASE_URL` using the Supabase project URL (for example, `https://your-project.supabase.co`).
3. Add `SUPABASE_PUBLISHABLE_KEY` using the project's **publishable** key. Never use a `service_role` or secret key in this frontend.
4. Trigger a Netlify deploy. The build creates `dist/js/supabase-config.js`; this generated file is ignored by Git and contains only the browser-safe URL and publishable key.
5. In Supabase Authentication URL configuration, add the Netlify production URL and any preview URLs to the allowed redirect URLs. Set the site's Site URL to the production URL.

For local development, create `js/supabase-config.js` by copying `js/supabase-config.example.js`, then replace both placeholders with the project URL and publishable key. This local file is ignored by Git. Serve the app over HTTP (not `file://`) and never paste a secret or `service_role` key into it.

The Netlify build fails if either environment variable is missing or if the key looks like a secret/service-role credential. Existing production files are not changed by this repository; publish only after verifying the Netlify deploy preview.

## Database and security

The app expects your six existing tables and the supplied columns:

- `incomes`: `id`, `user_id`, `source`, `description`, `amount`, `currency`, `received_at`
- `expenses`: `id`, `user_id`, `category`, `description`, `amount`, `currency`, `spent_at`
- `budgets`: `id`, `user_id`, `category`, `amount`, `currency`, `month`
- `savings_goals`: `id`, `user_id`, `name`, `target_amount`, `currency`, `target_date`
- `savings_contributions`: `id`, `user_id`, `goal_id`, `amount`, `contributed_at`
- `user_settings`: `id`, `user_id`, `preferred_language`, `exchange_rate`, `next_expected_income_date`

It does not create, alter, or delete database tables or policies. Every data query is scoped to the currently authenticated user's ID and the existing RLS policies remain authoritative.

User-initiated local migration preserves a backup in this browser and never deletes it. Income, expenses, goals, and contributions use their existing UUIDs for idempotent retries. Budgets matching the account's unique `(user_id, category, currency, month)` key are skipped rather than overwritten. If a migration is interrupted, retry it from Settings.

The supplied `user_settings` schema stores language, exchange rate, and next expected income date. Other display preferences and Safe to Spend amounts not represented in that schema remain local to the current browser.

## Local checks

- Set the two environment variables and run `node scripts/build-netlify.mjs` to build the static deploy files into `dist/`.
- The Supabase Publishable key is public by design; authentication and RLS, not key secrecy, protect user records.
