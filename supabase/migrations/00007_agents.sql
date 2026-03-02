-- =============================================================================
-- Migration 00007: Agents — agents, agent_conversations, mcp_connections
-- =============================================================================
-- Powers the Dev Agent and all custom AI agents. Each agent has a system prompt,
-- allowed tools, MCP server connections, and data-access permissions.
-- Conversations are stored as JSONB message arrays for full history replay.
-- MCP connections define how agents reach external tool servers.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: agents
-- ---------------------------------------------------------------------------
create table public.agents (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  slug          text        unique not null,
  description   text        not null default '',
  system_prompt text        not null,
  tools         text[]      not null default '{}',
  mcp_servers   text[]      not null default '{internal}',
  data_access   text[]      not null default '{}',
  icon          text        not null default '🤖',
  is_system     boolean     not null default false,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

comment on table  public.agents is 'AI agent definitions — system prompt, tools, permissions, and MCP server bindings.';
comment on column public.agents.slug is 'URL-safe identifier used in routes and API calls.';
comment on column public.agents.tools is 'Array of tool function names this agent is allowed to call.';
comment on column public.agents.mcp_servers is 'Array of MCP connection slugs this agent can use. Defaults to internal.';
comment on column public.agents.data_access is 'Array of table names this agent may query.';
comment on column public.agents.is_system is 'True for the Dev Agent (cannot be deleted by the user).';

-- Indexes
create index idx_agents_slug on public.agents (slug);

-- RLS
alter table public.agents enable row level security;

-- Anyone can read active agents (portal support agent needs to be discoverable)
create policy "Anyone can read active agents"
  on public.agents for select
  using (is_active = true);

-- Admin can read all agents (including inactive)
create policy "Admin can read all agents"
  on public.agents for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can insert agents
create policy "Admin can create agents"
  on public.agents for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can update agents
create policy "Admin can update agents"
  on public.agents for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin can delete agents (app logic prevents deleting is_system agents)
create policy "Admin can delete agents"
  on public.agents for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role full access
create policy "Service role full access on agents"
  on public.agents for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: agent_conversations
-- ---------------------------------------------------------------------------
create table public.agent_conversations (
  id         uuid        primary key default gen_random_uuid(),
  agent_id   uuid        not null references public.agents(id) on delete cascade,
  title      text        not null default 'New Conversation',
  messages   jsonb       not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table  public.agent_conversations is 'Chat history for each agent session. Messages are {role, content, tool_calls, timestamp}.';
comment on column public.agent_conversations.messages is 'JSONB array of message objects with role, content, optional tool_calls, and timestamp.';

-- Indexes
create index idx_agent_conversations_agent_id on public.agent_conversations (agent_id);

-- RLS
alter table public.agent_conversations enable row level security;

-- Admin only: read conversations
create policy "Admin can read agent conversations"
  on public.agent_conversations for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin only: create conversations
create policy "Admin can create agent conversations"
  on public.agent_conversations for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin only: update conversations
create policy "Admin can update agent conversations"
  on public.agent_conversations for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Admin only: delete conversations
create policy "Admin can delete agent conversations"
  on public.agent_conversations for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role full access
create policy "Service role full access on agent_conversations"
  on public.agent_conversations for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- ---------------------------------------------------------------------------
-- Table: mcp_connections
-- ---------------------------------------------------------------------------
create table public.mcp_connections (
  id                    uuid        primary key default gen_random_uuid(),
  name                  text        not null,
  slug                  text        unique not null,
  transport             text        not null default 'in_process'
                                    check (transport in ('streamable_http', 'in_process')),
  url                   text,
  auth_type             text        not null default 'none'
                                    check (auth_type in ('api_key', 'oauth', 'none')),
  credentials_encrypted text,
  is_system             boolean     not null default false,
  is_active             boolean     not null default true,
  created_at            timestamptz not null default now()
);

comment on table  public.mcp_connections is 'MCP (Model Context Protocol) server connections available to agents.';
comment on column public.mcp_connections.transport is 'Transport type: in_process for local tool servers, streamable_http for remote.';
comment on column public.mcp_connections.credentials_encrypted is 'Encrypted credentials blob — decrypted at runtime by the service layer.';

-- Indexes
create index idx_mcp_connections_slug on public.mcp_connections (slug);

-- RLS
alter table public.mcp_connections enable row level security;

-- Admin only: full CRUD on MCP connections
create policy "Admin can read mcp connections"
  on public.mcp_connections for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admin can create mcp connections"
  on public.mcp_connections for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admin can update mcp connections"
  on public.mcp_connections for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admin can delete mcp connections"
  on public.mcp_connections for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service role full access
create policy "Service role full access on mcp_connections"
  on public.mcp_connections for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
