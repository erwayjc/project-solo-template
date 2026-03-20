import { describe, it, expect } from 'vitest'
import { mergeFields } from '@/lib/utils/merge-fields'

describe('mergeFields', () => {
  it('replaces a single placeholder', () => {
    expect(mergeFields('Hello {{name}}!', { name: 'Alice' })).toBe('Hello Alice!')
  })

  it('replaces multiple placeholders', () => {
    const template = '{{greeting}} {{name}}, welcome to {{site}}.'
    const data = { greeting: 'Hi', name: 'Bob', site: 'Project Solo' }
    expect(mergeFields(template, data)).toBe('Hi Bob, welcome to Project Solo.')
  })

  it('leaves unmatched placeholders in place', () => {
    expect(mergeFields('Hello {{name}}, {{unsubscribe}}', { name: 'Alice' })).toBe(
      'Hello Alice, {{unsubscribe}}'
    )
  })

  it('returns template unchanged when no placeholders exist', () => {
    expect(mergeFields('No placeholders here', { name: 'Alice' })).toBe('No placeholders here')
  })

  it('returns template unchanged when data is empty', () => {
    expect(mergeFields('Hello {{name}}!', {})).toBe('Hello {{name}}!')
  })

  it('handles empty template', () => {
    expect(mergeFields('', { name: 'Alice' })).toBe('')
  })

  it('replaces duplicate placeholders', () => {
    expect(mergeFields('{{x}} and {{x}}', { x: 'yes' })).toBe('yes and yes')
  })

  it('only matches word characters in keys', () => {
    // Non-word chars in braces should not match
    expect(mergeFields('{{not-valid}}', { 'not-valid': 'x' })).toBe('{{not-valid}}')
  })

  it('handles replacement values with special regex characters', () => {
    expect(mergeFields('Price: {{amount}}', { amount: '$100.00' })).toBe('Price: $100.00')
  })

  it('does not match single braces', () => {
    expect(mergeFields('{name}', { name: 'Alice' })).toBe('{name}')
  })

  it('does not match triple braces', () => {
    expect(mergeFields('{{{name}}}', { name: 'Alice' })).toBe('{Alice}')
  })
})
