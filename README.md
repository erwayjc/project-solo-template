# AI Solo Starter Kit

Your AI-powered business platform — a complete business-in-a-box for solo creators and entrepreneurs.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ferwayjc%2Fproject-solo-template&project-name=my-solo-business&env=NEXT_PUBLIC_SUPABASE_URL%2CNEXT_PUBLIC_SUPABASE_ANON_KEY%2CSUPABASE_SERVICE_ROLE_KEY%2CDATABASE_URL%2CNEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY%2CSTRIPE_SECRET_KEY%2CRESEND_API_KEY%2CANTHROPIC_API_KEY%2CNEXT_PUBLIC_SITE_URL&envDescription=Set+up+your+Supabase+project+first%2C+then+grab+API+keys+from+each+service+dashboard.+See+the+linked+guide+for+step-by-step+instructions.&envLink=https%3A%2F%2Fgithub.com%2Ferwayjc%2Fproject-solo-template%23environment-variables)

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) account (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- [Stripe](https://stripe.com/) account (test mode keys)
- [Resend](https://resend.com/) account
- [Anthropic](https://console.anthropic.com/) API key

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/erwayjc/project-solo-template.git
cd project-solo-template

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your keys in .env.local (see Environment Variables below)

# 4. Set up Supabase (see Supabase Setup below)

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your site.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in each value:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase: **Connect** button > **API Keys** tab > **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase: **Connect** > **API Keys** tab > **Anon Key (Legacy)** — use the JWT key, _not_ the Publishable Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase: **Connect** > **API Keys** tab > click **API settings** link > `service_role` key |
| `DATABASE_URL` | Supabase: **Connect** > **Connection String** tab > Type: URI, Method: **Transaction Pooler** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe: [Dashboard](https://dashboard.stripe.com/test/apikeys) > Publishable key |
| `STRIPE_SECRET_KEY` | Stripe: [Dashboard](https://dashboard.stripe.com/test/apikeys) > Secret key |
| `RESEND_API_KEY` | Resend: [Dashboard](https://resend.com/api-keys) > API Keys |
| `ANTHROPIC_API_KEY` | Anthropic: [Console](https://console.anthropic.com/settings/keys) > API Keys |
| `BUFFER_ACCESS_TOKEN` | _(Optional)_ Buffer access token for social publishing |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL (set after deploy, e.g., `https://my-solo-business.vercel.app`) |
| `ENCRYPTION_KEY` | Auto-generated during admin setup — do not set manually |

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com/)
2. Copy your project URL and keys into `.env.local`
3. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
4. Run all migrations (creates tables, RLS policies, and triggers):
   ```bash
   supabase db push
   ```
5. Load the sample data (products, pages, agents, email sequences, and more):
   ```bash
   supabase db seed
   ```
   > **Important:** The seed data includes 6 pre-built AI agents, sample course content, landing pages, email sequences, and a blog post. Without it, the app will boot to an empty state. You can customize or remove this data later through the admin dashboard.

6. Row Level Security (RLS) is enabled by default in the migrations

## Edge Functions (Optional)

The `supabase/functions/` directory contains 5 Supabase Edge Functions that power background automation:

| Function | Schedule | Purpose |
|----------|----------|---------|
| `process-email-queue` | Every 15 min | Sends emails for active sequence enrollments via Resend |
| `process-content-queue` | Every 30 min | Publishes scheduled social content to Buffer |
| `check-engagement` | Daily | Analyzes customer engagement signals |
| `generate-briefing` | Weekly (Monday) | Generates an AI-powered CEO business briefing |
| `sync-stripe-data` | Every 6 hours | Syncs Stripe products and customers to the database |

These functions run on [Deno](https://deno.com/) (Supabase's edge runtime) — not Node.js. They have their own `deno.json` config and import from `https://esm.sh/`.

**To deploy edge functions:**
```bash
# Deploy all functions
supabase functions deploy process-email-queue
supabase functions deploy process-content-queue
supabase functions deploy check-engagement
supabase functions deploy generate-briefing
supabase functions deploy sync-stripe-data

# Set secrets for the functions
supabase secrets set RESEND_API_KEY=your_key ANTHROPIC_API_KEY=your_key
```

**To set up scheduled execution**, go to your Supabase Dashboard > Database > Extensions and enable `pg_cron`, then create cron jobs for each function. See [Supabase Cron docs](https://supabase.com/docs/guides/functions/schedule-functions) for details.

> **Note:** The app works without edge functions — they add automation for email sequences, content scheduling, and weekly briefings. You can deploy them later when you're ready.

## Stripe Setup

1. Get your test mode API keys from [Stripe Dashboard > Developers](https://dashboard.stripe.com/test/apikeys)
2. Add them to `.env.local`
3. Set up the webhook endpoint in Stripe:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. For local development, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

## First Run

After completing the setup above:

1. Open [http://localhost:3000/admin/setup](http://localhost:3000/admin/setup)
2. Create your admin account (first signup automatically gets the admin role)
3. Follow the setup wizard: branding, integrations, and initial content
4. Visit `/admin` to access your dashboard with all 6 AI agents ready to use

## Tech Stack

- **Next.js** (App Router, Server Actions, React Server Components)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** with CSS custom properties for brand theming
- **Supabase** (PostgreSQL, Auth, Realtime, Storage, RLS)
- **Stripe** (Checkout, Webhooks, Customer Portal)
- **Resend** (transactional + broadcast email)
- **Anthropic Claude SDK** (AI agents, content generation, support triage)
- **MCP SDK** (tool-server architecture)
- **Zod** (input validation)

## Debugging Tips

- **Supabase issues**: Check your project's Logs section in the Supabase dashboard. Ensure RLS policies aren't blocking your queries — you can test queries directly in the SQL Editor.
- **Stripe webhooks**: Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` during local dev. Check the Stripe Dashboard > Developers > Webhooks for delivery logs in production.
- **Email not sending**: Verify your Resend API key is valid and your sending domain is verified in Resend. Check the Resend dashboard for delivery logs.
- **Agent not responding**: Verify your Anthropic API key has credits. Check the browser console and server logs for error messages. Ensure the agent's MCP tools are properly configured in the admin dashboard.
