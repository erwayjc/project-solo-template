-- ---------------------------------------------------------------------------
-- Migration 00027: Page Design Tokens
-- Extends site_config with richer branding for custom page generation.
-- The Dev Agent saves these after the first page collaboration so all
-- subsequent pages automatically inherit the user's brand identity.
-- ---------------------------------------------------------------------------

ALTER TABLE public.site_config
ADD COLUMN IF NOT EXISTS page_design_tokens jsonb NOT NULL DEFAULT '{
  "fonts": {
    "heading": "system-ui, -apple-system, sans-serif",
    "body": "system-ui, -apple-system, sans-serif"
  },
  "button_style": "rounded",
  "section_style": "spacious",
  "overall_vibe": "modern-minimal",
  "custom_css": ""
}'::jsonb;

COMMENT ON COLUMN public.site_config.page_design_tokens IS
  'Extended brand tokens for custom page generation: fonts, button style, section spacing, vibe, custom CSS overrides.';
