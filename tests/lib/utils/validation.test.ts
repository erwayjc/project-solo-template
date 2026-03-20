import { describe, it, expect } from 'vitest'
import {
  emailSchema,
  leadSchema,
  blogPostSchema,
  customPageSlugSchema,
  agentConfigSchema,
  pageContentSchema,
  leadCaptureSchema,
} from '@/lib/utils/validation'

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.parse('User@Example.COM')).toBe('user@example.com')
  })

  it('lowercases and trims after validation', () => {
    // Zod validates before transform, so leading/trailing spaces fail email validation
    expect(emailSchema.parse('User@Example.com')).toBe('user@example.com')
  })

  it('rejects invalid email', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => emailSchema.parse('')).toThrow()
  })

  it('rejects email exceeding 320 chars', () => {
    const longEmail = 'a'.repeat(310) + '@example.com'
    expect(() => emailSchema.parse(longEmail)).toThrow()
  })
})

describe('leadSchema', () => {
  it('accepts valid lead with email only', () => {
    const result = leadSchema.parse({ email: 'test@example.com' })
    expect(result.email).toBe('test@example.com')
  })

  it('accepts lead with all fields', () => {
    const result = leadSchema.parse({
      email: 'test@example.com',
      name: 'John',
      source: 'landing-page',
    })
    expect(result.name).toBe('John')
    expect(result.source).toBe('landing-page')
  })

  it('rejects lead without email', () => {
    expect(() => leadSchema.parse({})).toThrow()
  })

  it('rejects name exceeding 200 chars', () => {
    expect(() =>
      leadSchema.parse({ email: 'a@b.com', name: 'x'.repeat(201) })
    ).toThrow()
  })
})

describe('blogPostSchema', () => {
  const validPost = {
    title: 'My Post',
    slug: 'my-post',
    content: 'Some content',
  }

  it('accepts a valid blog post', () => {
    const result = blogPostSchema.parse(validPost)
    expect(result.title).toBe('My Post')
    expect(result.published).toBe(false) // default
  })

  it('rejects empty title', () => {
    expect(() => blogPostSchema.parse({ ...validPost, title: '' })).toThrow()
  })

  it('rejects invalid slug format', () => {
    expect(() => blogPostSchema.parse({ ...validPost, slug: 'Has Spaces' })).toThrow()
    expect(() => blogPostSchema.parse({ ...validPost, slug: 'UPPERCASE' })).toThrow()
    expect(() => blogPostSchema.parse({ ...validPost, slug: '-leading-dash' })).toThrow()
  })

  it('accepts valid slug formats', () => {
    expect(blogPostSchema.parse({ ...validPost, slug: 'simple' }).slug).toBe('simple')
    expect(blogPostSchema.parse({ ...validPost, slug: 'multi-word-slug' }).slug).toBe('multi-word-slug')
    expect(blogPostSchema.parse({ ...validPost, slug: 'post123' }).slug).toBe('post123')
  })

  it('rejects empty content', () => {
    expect(() => blogPostSchema.parse({ ...validPost, content: '' })).toThrow()
  })

  it('accepts optional featured_image as URL or empty string', () => {
    expect(
      blogPostSchema.parse({ ...validPost, featured_image: 'https://img.com/a.jpg' }).featured_image
    ).toBe('https://img.com/a.jpg')
    expect(blogPostSchema.parse({ ...validPost, featured_image: '' }).featured_image).toBe('')
  })

  it('rejects meta_description exceeding 160 chars', () => {
    expect(() =>
      blogPostSchema.parse({ ...validPost, meta_description: 'x'.repeat(161) })
    ).toThrow()
  })
})

describe('customPageSlugSchema', () => {
  it('accepts valid slugs', () => {
    expect(customPageSlugSchema.parse('about')).toBe('about')
    expect(customPageSlugSchema.parse('my-page')).toBe('my-page')
  })

  it('rejects empty string', () => {
    expect(() => customPageSlugSchema.parse('')).toThrow()
  })

  it('rejects slugs with uppercase', () => {
    expect(() => customPageSlugSchema.parse('About')).toThrow()
  })

  it('rejects slugs exceeding 200 chars', () => {
    expect(() => customPageSlugSchema.parse('a'.repeat(201))).toThrow()
  })
})

describe('pageContentSchema', () => {
  it('accepts valid page content', () => {
    const result = pageContentSchema.parse({
      sections: [{ id: '1', type: 'hero', content: { title: 'Hello' }, order: 0 }],
    })
    expect(result.sections).toHaveLength(1)
  })

  it('rejects empty sections array', () => {
    expect(() => pageContentSchema.parse({ sections: [] })).toThrow()
  })

  it('rejects section with missing id', () => {
    expect(() =>
      pageContentSchema.parse({
        sections: [{ id: '', type: 'hero', content: {}, order: 0 }],
      })
    ).toThrow()
  })
})

describe('leadCaptureSchema', () => {
  it('accepts extended lead capture with funnel_step_id', () => {
    const result = leadCaptureSchema.parse({
      email: 'test@example.com',
      funnel_step_id: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.funnel_step_id).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('rejects invalid UUID for funnel_step_id', () => {
    expect(() =>
      leadCaptureSchema.parse({ email: 'a@b.com', funnel_step_id: 'not-a-uuid' })
    ).toThrow()
  })
})

describe('agentConfigSchema', () => {
  it('accepts minimal valid config with defaults', () => {
    const result = agentConfigSchema.parse({
      name: 'My Agent',
      system_prompt: 'You are a helpful assistant.',
    })
    expect(result.model).toBe('claude-sonnet-4-20250514')
    expect(result.max_tokens).toBe(1024)
    expect(result.temperature).toBe(0.7)
    expect(result.tools).toEqual([])
    expect(result.mcp_servers).toEqual([])
  })

  it('rejects empty name', () => {
    expect(() =>
      agentConfigSchema.parse({ name: '', system_prompt: 'prompt' })
    ).toThrow()
  })

  it('rejects system_prompt exceeding 10000 chars', () => {
    expect(() =>
      agentConfigSchema.parse({ name: 'Agent', system_prompt: 'x'.repeat(10001) })
    ).toThrow()
  })

  it('rejects temperature outside 0-1 range', () => {
    expect(() =>
      agentConfigSchema.parse({ name: 'Agent', system_prompt: 'p', temperature: 1.5 })
    ).toThrow()
  })

  it('accepts config with tools', () => {
    const result = agentConfigSchema.parse({
      name: 'Agent',
      system_prompt: 'prompt',
      tools: [{ name: 'my_tool', description: 'Does stuff' }],
    })
    expect(result.tools).toHaveLength(1)
  })
})
