-- ---------------------------------------------------------------------------
-- Agent Introspection Functions
-- ---------------------------------------------------------------------------
-- These functions allow AI agents to discover the database schema and run
-- read-only queries at runtime, eliminating the need to hard-code every
-- capability into bespoke MCP tools.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. describe_schema — returns table/column metadata for the public schema
-- ---------------------------------------------------------------------------
create or replace function public.describe_schema(
  p_table_name text default null
)
returns json
language plpgsql
security definer
as $$
declare
  result json;
begin
  if p_table_name is not null then
    -- Return columns for a specific table
    select json_agg(row_to_json(t))
    into result
    from (
      select
        c.table_name,
        c.column_name,
        c.data_type,
        c.udt_name,
        c.is_nullable,
        c.column_default,
        col_description(
          (quote_ident(c.table_schema) || '.' || quote_ident(c.table_name))::regclass,
          c.ordinal_position
        ) as column_comment
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = p_table_name
      order by c.ordinal_position
    ) t;
  else
    -- Return all tables with their column counts and comments
    select json_agg(row_to_json(t))
    into result
    from (
      select
        ist.table_name,
        obj_description((quote_ident('public') || '.' || quote_ident(ist.table_name))::regclass) as table_comment,
        (
          select count(*)::int
          from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = ist.table_name
        ) as column_count
      from information_schema.tables ist
      where ist.table_schema = 'public'
        and ist.table_type = 'BASE TABLE'
      order by ist.table_name
    ) t;
  end if;

  return coalesce(result, '[]'::json);
end;
$$;

comment on function public.describe_schema(text)
  is 'Returns schema metadata for the public schema. Call with no args to list all tables, or pass a table name to get column details.';

-- ---------------------------------------------------------------------------
-- 2. execute_readonly_query — runs a SELECT statement and returns results
-- ---------------------------------------------------------------------------
create or replace function public.execute_readonly_query(
  p_query text,
  p_max_rows int default 100
)
returns json
language plpgsql
security definer
as $$
declare
  result json;
  safe_query text;
begin
  -- Normalize whitespace and convert to lowercase for safety check
  safe_query := lower(trim(p_query));

  -- Block non-SELECT statements
  if not (safe_query like 'select%' or safe_query like 'with%') then
    raise exception 'Only SELECT and WITH (CTE) queries are allowed. Got: %', left(safe_query, 50);
  end if;

  -- Block dangerous keywords that could modify data even within a SELECT
  if safe_query ~ '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|execute|copy)\b' then
    raise exception 'Query contains a disallowed keyword. Only read-only queries are permitted.';
  end if;

  -- Execute with row limit
  execute format(
    'select json_agg(row_to_json(t)) from (select * from (%s) sub limit %s) t',
    p_query,
    p_max_rows
  ) into result;

  return coalesce(result, '[]'::json);
end;
$$;

comment on function public.execute_readonly_query(text, int)
  is 'Executes a read-only SQL query (SELECT/WITH only) and returns results as JSON. Max rows defaults to 100.';
