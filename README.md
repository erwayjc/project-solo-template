# AI Solo Starter Kit

Your AI-powered business platform — a complete business-in-a-box for solo creators and entrepreneurs.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ferwayjc%2Fproject-solo-template&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,STRIPE_SECRET_KEY,RESEND_API_KEY,ANTHROPIC_API_KEY,NEXT_PUBLIC_SITE_URL)

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) account (free tier works)
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

# 4. Run Supabase migrations (see Supabase Setup below)

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your site.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in each value:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (Settings > API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (Settings > API) — keep secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (Developers > API keys) |
| `STRIPE_SECRET_KEY` | Stripe secret key — keep secret |
| `RESEND_API_KEY` | Resend API key (Settings > API Keys) |
| `ANTHROPIC_API_KEY` | Anthropic API key (Console > API Keys) |
| `BUFFER_ACCESS_TOKEN` | _(Optional)_ Buffer access token for social publishing |
| `NEXT_PUBLIC_SITE_URL` | Your deployed site URL (e.g., `https://yourdomain.com`) |
| `ENCRYPTION_KEY` | Auto-generated during admin setup — do not set manually |

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com/)
2. Copy your project URL and keys into `.env.local`
3. Install the [Supabase CLI](https://supabase.com/docs/guides/cli)
4. Link your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
5. Run all migrations:
   ```bash
   supabase db push
   ```
6. Row Level Security (RLS) is enabled by default in the migrations

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
