import { z } from 'zod'

// ── Primitives ──────────────────────────────────────────────────────────────

export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(320, 'Email is too long')
  .transform((v) => v.toLowerCase().trim())

// ── Lead capture ────────────────────────────────────────────────────────────

export const leadSchema = z.object({
  email: emailSchema,
  name: z.string().max(200).optional(),
  source: z.string().max(100).optional(),
})

export type LeadInput = z.infer<typeof leadSchema>

// ── Page content ────────────────────────────────────────────────────────────

const pageSectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  content: z.record(z.string(), z.unknown()),
  order: z.number().int().min(0),
})

export const pageContentSchema = z.object({
  sections: z.array(pageSectionSchema).min(1, 'At least one section is required'),
})

export type PageContentInput = z.infer<typeof pageContentSchema>

// ── Blog post ───────────────────────────────────────────────────────────────

export const blogPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  slug: z
    .string()
    .min(1)
    .max(300)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  content: z.string().min(1, 'Content is required'),
  excerpt: z.string().max(500).optional(),
  published: z.boolean().default(false),
  featured_image: z.string().url().optional().or(z.literal('')),
  meta_title: z.string().max(70).optional(),
  meta_description: z.string().max(160).optional(),
})

export type BlogPostInput = z.infer<typeof blogPostSchema>

// ── Agent configuration ─────────────────────────────────────────────────────

export const agentConfigSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100),
  system_prompt: z.string().min(1, 'System prompt is required').max(10000),
  model: z.string().default('claude-sonnet-4-20250514'),
  max_tokens: z.number().int().min(1).max(8192).default(1024),
  temperature: z.number().min(0).max(1).default(0.7),
  tools: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        input_schema: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .default([]),
  mcp_servers: z.array(z.string()).default([]),
})

export type AgentConfigInput = z.infer<typeof agentConfigSchema>
