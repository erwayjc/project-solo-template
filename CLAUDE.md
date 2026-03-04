# CLAUDE.md — AI Solo Starter Kit

## Project Overview

AI Solo Starter Kit is a white-label, AI-powered business platform for solo creators and entrepreneurs. It provides a complete business-in-a-box: public marketing site, customer portal, admin dashboard with AI agents, email automation, course delivery, support ticketing, content management, and Stripe payments. The platform is database-driven and extensible through MCP (Model Context Protocol) tool servers that allow AI agents to read and write business data.

## Tech Stack

- **Framework**: Next.js 14+ (App Router, Server Actions, RSC)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4, CSS custom properties for brand theming
- **Database**: Supabase (PostgreSQL + Auth + Realtime + Storage + RLS)
- **Payments**: Stripe (Checkout, Webhooks, Customer Portal)
- **Email**: Resend (transactional + broadcast)
- **AI**: Anthropic Claude SDK (agents, content generation, support triage)
- **Social**: Buffer API (content queue publishing)
- **Protocol**: MCP SDK for tool-server architecture
- **UI Primitives**: Lucide icons, class-variance-authority, clsx, tailwind-merge
- **Validation**: Zod

## Directory Structure

```
ai-solo-starter-kit/
├── middleware.ts              # Auth routing + role-based access control
├── src/
│   ├── app/                   # Next.js App Router pages
│   │   ├── (public)/          # Marketing: home, blog, pricing, landing pages
│   │   ├── admin/             # Admin dashboard (requires admin role)
│   │   ├── portal/            # Customer portal (requires customer/admin role)
│   │   ├── api/               # API routes: webhooks, agent chat, health
│   │   └── layout.tsx         # Root layout
│   ├── actions/               # Server Actions (auth, CRUD, integrations)
│   ├── components/            # React components (ui/, admin/, portal/, shared/)
│   ├── hooks/                 # Client-side hooks (chat, realtime, PWA, theme)
│   ├── lib/                   # Service clients & utilities
│   │   ├── supabase/          # Server, browser, admin, middleware clients + types
│   │   ├── stripe/            # Stripe client, checkout helpers, webhook verification
│   │   ├── resend/            # Resend client + email templates
│   │   ├── claude/            # Anthropic client
│   │   ├── buffer/            # Buffer social publishing client
│   │   └── utils/             # Encryption, merge-fields, helpers
│   ├── styles/                # globals.css (Tailwind v4 + brand variables)
│   └── types/                 # TypeScript types (database aliases, app types)
├── supabase/
│   └── migrations/            # SQL migration files
└── public/                    # Static assets
```

## Key Architectural Patterns

### Database-Driven Content
All site content (pages, blog posts, courses, config) is stored in Supabase and editable through the admin dashboard. The `site_config` table (single-row, id=1) holds branding, SEO defaults, and setup status. The `pages` table stores landing page content as JSON section arrays.

### MCP Tool Architecture
AI agents interact with business data through MCP tool servers. The `agents` table defines each agent's system prompt, allowed tools, MCP server bindings, and data-access permissions. The `mcp_connections` table stores connection configs for both in-process and remote tool servers. Credentials are AES-256-GCM encrypted at rest.

### Agent Execution Flow
1. User sends a message to an agent via `/api/agent/chat`
2. Server loads the agent definition (system prompt, tools, MCP servers)
3. Claude SDK processes the message with tool-use enabled
4. Tool calls are executed against allowed MCP servers
5. Results stream back to the client with tool call visibility

### Server Actions Pattern
All mutations use Next.js Server Actions (`"use server"`) in `src/actions/`. Each action:
1. Creates a Supabase server client
2. Validates input with Zod where appropriate
3. Verifies authentication and authorization
4. Performs the database operation
5. Returns typed results or throws descriptive errors

## Database Schema

| Table | Description |
|-------|-------------|
| `profiles` | Extends auth.users with role, Stripe/Resend IDs, and metadata |
| `site_config` | Single-row global config: branding, SEO, setup status |
| `products` | Purchasable items synced with Stripe (one-time or subscription) |
| `purchases` | Purchase records linking users to products |
| `modules` | Course modules/sections, optionally tied to a product |
| `lessons` | Individual lessons with markdown content, video, downloads |
| `lesson_progress` | Per-user lesson completion tracking |
| `leads` | Email leads from opt-in forms with status lifecycle |
| `pages` | JSON-driven landing/sales pages keyed by slug |
| `email_sequences` | Drip/automation sequences with trigger types |
| `email_sequence_steps` | Timed steps within a sequence |
| `email_sends` | Per-email send log with delivery status tracking |
| `broadcasts` | One-off broadcast campaigns with audience filtering |
| `sequence_enrollments` | Per-subscriber progress through a sequence |
| `blog_posts` | Articles with SEO, tags, and draft/published workflow |
| `content_queue` | Social media content scheduling across platforms |
| `support_tickets` | Support tickets with JSONB conversation history |
| `agents` | AI agent definitions (prompt, tools, permissions) |
| `agent_conversations` | Chat history per agent session |
| `mcp_connections` | MCP server connection configs with encrypted credentials |
| `announcements` | Portal dashboard announcements (info/update/alert) |
| `media` | Centralized media/asset library |

## Important Conventions

- **Import alias**: `@/*` maps to `./src/*` (configured in tsconfig.json)
- **File naming**: kebab-case for files, PascalCase for components
- **Server Actions**: one file per domain in `src/actions/` — always `"use server"` directive
- **Components**: organized into `ui/`, `admin/`, `portal/`, `shared/` subdirectories
- **Database types**: generated types in `src/lib/supabase/types.ts`, aliased in `src/types/database.ts`
- **Auth flow**: middleware refreshes session; server actions call `createClient()` from `@/lib/supabase/server`
- **Admin client**: use `createAdminClient()` from `@/lib/supabase/admin` only for service-role operations (webhooks, setup)
- **Error handling**: server actions throw errors with descriptive messages; client components catch and display
- **Env vars**: public vars prefixed with `NEXT_PUBLIC_`; secrets are server-only
- **Service clients**: Stripe, Anthropic, and Resend clients are lazy-initialized via Proxy in `src/lib/*/client.ts` — never eagerly construct SDK clients at module scope
- **JSONB columns**: when inserting/updating JSONB fields via Supabase, cast typed objects with `as unknown as Json` (import `Json` from `@/lib/supabase/types`)

## Guardrails for Customization

**This section protects critical systems from accidental breaks. Do NOT remove or weaken these rules.**

### Database Safety Rules

- NEVER run `DROP TABLE` on any existing table — always create new tables or add columns
- NEVER run `DROP COLUMN` on `profiles`, `site_config`, `products`, `purchases`, `agents`, or `mcp_connections` — these are critical system tables that the platform depends on
- NEVER remove or modify the `handle_new_user()` trigger function — it auto-creates profile rows on signup; removing it breaks all new user registration
- NEVER remove or modify the `is_admin()` function — it prevents RLS recursion on the profiles table; removing it breaks all admin database access
- NEVER disable Row Level Security on any table — RLS is the authorization layer; disabling it exposes all data to all users
- NEVER remove RLS policies without understanding their purpose — read the policy definition first and explain its function to the user before making changes
- ALWAYS remind the user to back up their database via the Supabase dashboard before running any migration that modifies existing tables
- ALWAYS use additive migrations (ADD COLUMN, CREATE TABLE) rather than destructive ones (DROP, ALTER TYPE, RENAME COLUMN)
- Be aware of CASCADE foreign keys: deleting rows from `profiles`, `modules`, `email_sequences`, or `agents` will cascade-delete related child records

### Auth & Middleware Rules

- NEVER remove or bypass the `updateSession()` call in `middleware.ts` — it refreshes auth cookies on every request; removing it breaks all authenticated routes
- NEVER remove the role-based checks in `middleware.ts` (the `role !== 'admin'` and `role !== 'customer'` guards) — they protect admin and portal routes from unauthorized access
- NEVER remove the `setup_complete` check in `middleware.ts` — it prevents access to admin routes before setup is finished
- NEVER mix up Supabase clients: use `createClient()` (server) for authenticated user operations, `createAdminClient()` (admin) only for webhooks and setup. Using admin client for user operations bypasses RLS and creates security vulnerabilities.
- NEVER modify `src/lib/supabase/middleware.ts` cookie handling — the cookie sync logic is what propagates sessions across requests

### Webhook & Integration Rules

- NEVER modify the Stripe webhook signature verification in `src/app/api/webhooks/stripe/route.ts` — it prevents fraudulent webhook calls; the purchase recording flow depends on it
- NEVER remove the Resend webhook signature verification — it prevents unauthorized email event processing
- NEVER change webhook routes from POST to other HTTP methods
- NEVER add auth middleware to `/api/webhooks/*` routes — they verify signatures internally; adding auth blocks legitimate webhook calls

### Environment & Config Rules

- NEVER hardcode API keys, secrets, or credentials in source code — always use environment variables
- When adding new environment variables to `.env.local`, ALWAYS add the corresponding empty placeholder to `.env.example`
- NEVER remove existing environment variables from `.env.example` without confirming the feature they support has been fully removed

### Verification Rule

- After making changes to database schema, middleware, webhooks, or environment variables, ALWAYS call `/api/health` and verify all checks pass before considering the work complete
- If `/api/health` returns `degraded` or `critical` status, investigate and fix before proceeding
