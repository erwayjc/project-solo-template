import { describe, it, expect } from 'vitest'
import { sanitizePageHtml } from '@/lib/utils/sanitize'

describe('sanitizePageHtml', () => {
  describe('basic HTML preservation', () => {
    it('preserves safe HTML elements', () => {
      const html = '<p>Hello <strong>world</strong></p>'
      expect(sanitizePageHtml(html)).toBe(html)
    })

    it('preserves semantic HTML5 elements', () => {
      const html = '<section><article><h1>Title</h1></article></section>'
      expect(sanitizePageHtml(html)).toBe(html)
    })

    it('preserves class and id attributes', () => {
      const html = '<div class="container" id="main">Content</div>'
      expect(sanitizePageHtml(html)).toBe(html)
    })

    it('preserves inline styles', () => {
      const html = '<p style="color:red">Red text</p>'
      const result = sanitizePageHtml(html)
      expect(result).toContain('style=')
      expect(result).toContain('color')
    })

    it('preserves data attributes', () => {
      const html = '<div data-custom="value">Content</div>'
      expect(sanitizePageHtml(html)).toContain('data-custom="value"')
    })
  })

  describe('dangerous element removal', () => {
    it('strips iframe tags', () => {
      const html = '<p>Before</p><iframe src="https://evil.com"></iframe><p>After</p>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('iframe')
      expect(result).toContain('Before')
      expect(result).toContain('After')
    })

    it('strips object tags', () => {
      const html = '<object data="evil.swf"></object>'
      expect(sanitizePageHtml(html)).not.toContain('object')
    })

    it('strips embed tags', () => {
      const html = '<embed src="evil.swf">'
      expect(sanitizePageHtml(html)).not.toContain('embed')
    })
  })

  describe('script handling', () => {
    it('preserves inline script tags (content may be stripped by sanitize-html)', () => {
      const html = '<script>console.log("hello")</script>'
      const result = sanitizePageHtml(html)
      // sanitize-html preserves the script tag but may strip text content
      expect(result).toContain('<script>')
    })

    it('strips external script tags (with src)', () => {
      const html = '<script src="https://evil.com/hack.js"></script>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('evil.com')
      expect(result).not.toContain('src=')
    })
  })

  describe('event handler stripping', () => {
    it('strips onclick handlers', () => {
      const html = '<button onclick="alert(1)">Click</button>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('onclick')
      expect(result).toContain('Click')
    })

    it('strips onerror handlers', () => {
      const html = '<img src="x" onerror="alert(1)">'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('onerror')
    })

    it('strips onload handlers', () => {
      const html = '<body onload="alert(1)"><p>Content</p></body>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('onload')
    })
  })

  describe('CSS sanitization in style blocks', () => {
    it('strips @import rules', () => {
      const html = '<style>@import url("https://evil.com/steal.css"); .ok { color: red; }</style>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('@import')
      expect(result).toContain('color: red')
    })

    it('strips CSS expression()', () => {
      const html = '<style>.hack { width: expression(alert(1)); }</style>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('expression')
    })

    it('strips external url() references but allows data: URIs', () => {
      const html = '<style>.bg { background: url("https://evil.com/track.gif"); } .ok { background: url(data:image/png;base64,abc); }</style>'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('evil.com')
      expect(result).toContain('data:image/png')
    })
  })

  describe('link tag filtering', () => {
    it('allows canonical link tags', () => {
      const html = '<link rel="canonical" href="https://example.com">'
      const result = sanitizePageHtml(html)
      expect(result).toContain('canonical')
    })

    it('allows icon link tags', () => {
      const html = '<link rel="icon" href="/favicon.ico">'
      expect(sanitizePageHtml(html)).toContain('icon')
    })

    it('strips stylesheet link tags', () => {
      const html = '<link rel="stylesheet" href="https://evil.com/steal.css">'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('stylesheet')
    })

    it('strips prefetch/preconnect link tags', () => {
      const html = '<link rel="preconnect" href="https://evil.com">'
      expect(sanitizePageHtml(html)).not.toContain('preconnect')
    })
  })

  describe('meta tag filtering', () => {
    it('strips http-equiv attribute', () => {
      const html = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'">'
      const result = sanitizePageHtml(html)
      expect(result).not.toContain('http-equiv')
    })

    it('allows charset meta tag', () => {
      const html = '<meta charset="utf-8">'
      expect(sanitizePageHtml(html)).toContain('charset')
    })
  })

  describe('SVG support', () => {
    it('preserves SVG elements', () => {
      const html = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"></circle></svg>'
      const result = sanitizePageHtml(html)
      expect(result).toContain('<svg')
      expect(result).toContain('<circle')
    })
  })

  describe('form elements', () => {
    it('preserves form elements', () => {
      const html = '<form action="/submit"><input type="text" name="email"><button type="submit">Go</button></form>'
      const result = sanitizePageHtml(html)
      expect(result).toContain('<form')
      expect(result).toContain('<input')
      expect(result).toContain('<button')
    })
  })
})
