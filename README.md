# AI Solo Starter Kit

Your AI-powered business platform — a complete business-in-a-box for solo creators and entrepreneurs.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/H2cdmz?referralCode=J8cxkr)

---

## Quick Start (Deploy Button)

The fastest way to get started — deploys both your web app and agent worker as separate services:

1. **Click "Deploy on Railway"** above
2. **Fill in the required environment variables** (Supabase URL, keys — see below)
3. **Wait for both services to deploy** (~60-90s)
4. **Visit your app URL** at `your-app.up.railway.app/admin/setup`
5. **Create your admin account** (first signup gets the admin role)
6. **Click "Run Setup"** to initialize the database with tables and sample data
7. **Done** — start building your business from the admin dashboard

### Required Environment Variables

Set these during Railway deployment:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase: **Connect** > **API Keys** > **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase: **Connect** > **API Keys** > **Publishable API keys** tab > `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase: **Connect** > **API Keys** > **Service role secret** section |
| `DATABASE_URL` | Supabase: **Connect** > **Connection String** > Type: URI, Method: **Transaction Pooler** |

### Add After Deploy

Once your site is running, add these in **Railway > Variables** to unlock payments, email, and AI features:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe: [Dashboard](https://dashboard.stripe.com/test/apikeys) > Publishable key |
| `STRIPE_SECRET_KEY` | Stripe: [Dashboard](https://dashboard.stripe.com/test/apikeys) > Secret key |
| `RESEND_API_KEY` | Resend: [Dashboard](https://resend.com/api-keys) > API Keys |
| `ANTHROPIC_API_KEY` | Anthropic: [Console](https://console.anthropic.com/settings/keys) > API Keys |
| `NEXT_PUBLIC_SITE_URL` | Your deployed URL (e.g., `https://my-solo-business.up.railway.app`) |
| `BUFFER_ACCESS_TOKEN` | _(Optional)_ Buffer access token for social publishing |
| `ENCRYPTION_KEY` | Auto-generated during admin setup — do not set manually |

> Railway shares environment variables between services by default, so both the web app and worker will have access.

---

<details>
<summary><strong>Manual Setup (for developers using their own infrastructure)</strong></summary>

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) account (free tier works)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- [Stripe](https://stripe.com/) account (test mode keys)
- [Resend](https://resend.com/) account
- [Anthropic](https://console.anthropic.com/) API key

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/erwayjc/project-solo-template.git
cd project-solo-template

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Fill in your keys in .env.local (see below)

# 4. Set up Supabase (see below)

# 5. Start the web dev server
npm run dev

# 6. (In another terminal) Start the agent worker
npm run worker:dev
```

Open [http://localhost:3000](http://localhost:3000) to see your site.

### Manual Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase: **Connect** > **API Keys** > **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase: **Connect** > **API Keys** > **Publishable API keys** tab > `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase: **Connect** > **API Keys** > **Service role secret** section |
| `DATABASE_URL` | Supabase: **Connect** > **Connection String** > Type: URI, Method: **Transaction Pooler** |

### Supabase Setup (CLI)

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

</details>

## Architecture

The platform runs as **two services**:

1. **Web App** (Next.js) — admin dashboard, public site, API routes, agent chat
2. **Agent Worker** (Node.js) — autonomous agent execution with 3 subsystems:
   - **Scheduler** — runs agents on cron schedules (replaces pg_cron)
   - **Event Listener** — triggers agents on database changes via Supabase Realtime
   - **Goal Engine** — autonomous goal pursuit with task decomposition

Both services share the same codebase and environment variables. The worker process runs TypeScript directly via `tsx`.

## Stripe Setup

1. Get your test mode API keys from [Stripe Dashboard > Developers](https://dashboard.stripe.com/test/apikeys)
2. Add them to your environment variables
3. Set up the webhook endpoint in Stripe:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. For local development, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

## First Run

After deploying (via button or manually):

1. Visit `your-app.up.railway.app/admin/setup` (or [http://localhost:3000/admin/setup](http://localhost:3000/admin/setup) for local dev)
2. Create your admin account (first signup automatically gets the admin role)
3. Click "Run Setup" to initialize the database (creates tables, loads sample data)
4. Follow the setup wizard: branding, integrations, and initial content
5. Visit `/admin` to access your dashboard with all 6 AI agents ready to use
6. Visit `/admin/command-center` to monitor agent activity, set goals, and track runs

## Tech Stack

- **Next.js** (App Router, Server Actions, React Server Components)
- **TypeScript** (strict mode)
- **Tailwind CSS v4** with CSS custom properties for brand theming
- **Supabase** (PostgreSQL, Auth, Realtime, Storage, RLS)
- **Stripe** (Checkout, Webhooks, Customer Portal)
- **Resend** (transactional + broadcast email)
- **Anthropic Claude SDK** (AI agents, content generation, support triage)
- **MCP SDK** (tool-server architecture)
- **Railway** (multi-service deployment with persistent worker)
- **Zod** (input validation)

## Debugging Tips

- **Supabase issues**: Check your project's Logs section in the Supabase dashboard. Ensure RLS policies aren't blocking your queries — you can test queries directly in the SQL Editor.
- **Stripe webhooks**: Use `stripe listen --forward-to localhost:3000/api/webhooks/stripe` during local dev. Check the Stripe Dashboard > Developers > Webhooks for delivery logs in production.
- **Email not sending**: Verify your Resend API key is valid and your sending domain is verified in Resend. Check the Resend dashboard for delivery logs.
- **Agent not responding**: Verify your Anthropic API key has credits. Check the browser console and server logs for error messages. Ensure the agent's MCP tools are properly configured in the admin dashboard.
- **Worker offline**: Check the Railway dashboard for the worker service logs. The Command Center page shows worker status — if the heartbeat is stale (>2 min), the worker may have crashed and Railway will auto-restart it.
- **Agent runs not appearing**: Check the Command Center run log. Verify the agent is active and has at least one active schedule or trigger in the Config tab.
