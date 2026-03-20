// ---------------------------------------------------------------------------
// HTML Sanitization — strips dangerous elements while preserving inline JS/CSS
// ---------------------------------------------------------------------------

import sanitizeHtml from 'sanitize-html'

/**
 * Sanitize HTML for email content (broadcasts, sequences).
 *
 * Policy: allow standard formatting tags safe for email clients.
 * Strips scripts, iframes, objects, embeds, and event handlers.
 */
export function sanitizeEmailHtml(rawHtml: string): string {
  return sanitizeHtml(rawHtml, {
    allowedTags: [
      'p', 'br', 'a', 'strong', 'em', 'b', 'i', 'u',
      'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'img',
      'table', 'tr', 'td', 'th', 'thead', 'tbody', 'tfoot',
      'div', 'span', 'blockquote', 'pre', 'code', 'hr',
    ],
    allowedAttributes: {
      '*': ['style', 'class', 'id'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan', 'align', 'valign'],
      th: ['colspan', 'rowspan', 'align', 'valign', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard',
  })
}

/**
 * Sanitize user/agent-provided HTML for custom pages.
 *
 * Policy:
 * - Allow all HTML tags EXCEPT iframe, object, embed
 * - Allow inline <script> tags but strip <script src="..."> (external scripts)
 * - Allow <style> blocks; strip @import, expression(), and external url()
 * - Strip javascript: protocol from href/src attributes
 * - Strip inline event handlers (onclick, onerror, etc.)
 * - Restrict <link> to safe rel values (canonical, icon)
 * - Strip <meta http-equiv="Content-Security-Policy"> (CSP set via HTTP header)
 */
export function sanitizePageHtml(rawHtml: string): string {
  const sanitized = sanitizeHtml(rawHtml, {
    // Required to allow script and style tags — without this, sanitize-html
    // silently strips their content and emits console warnings
    allowVulnerableTags: true,

    // Allow all tags except dangerous embedding elements
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'html',
      'head',
      'body',
      'meta',
      'title',
      'link',
      'style',
      'script',
      'img',
      'video',
      'audio',
      'source',
      'canvas',
      'svg',
      'path',
      'circle',
      'rect',
      'line',
      'polyline',
      'polygon',
      'ellipse',
      'g',
      'defs',
      'use',
      'text',
      'tspan',
      'clipPath',
      'mask',
      'pattern',
      'linearGradient',
      'radialGradient',
      'stop',
      'symbol',
      'section',
      'article',
      'aside',
      'header',
      'footer',
      'nav',
      'main',
      'figure',
      'figcaption',
      'details',
      'summary',
      'dialog',
      'template',
      'input',
      'textarea',
      'select',
      'option',
      'optgroup',
      'button',
      'form',
      'label',
      'fieldset',
      'legend',
      'output',
      'progress',
      'meter',
      'datalist',
    ]),

    // Disallow iframe, object, embed explicitly
    disallowedTagsMode: 'discard',

    allowedAttributes: {
      // Allow safe attributes on all elements — NO on* event handlers
      '*': [
        'class',
        'id',
        'style',
        'data-*',
        'aria-*',
        'role',
        'tabindex',
        'title',
        'lang',
        'dir',
        'hidden',
        'draggable',
      ],
      a: ['href', 'target', 'rel', 'download', 'name'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes'],
      video: ['src', 'poster', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'playsinline'],
      audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'preload'],
      source: ['src', 'type', 'media', 'srcset', 'sizes'],
      // F8: Strip http-equiv (prevents injecting CSP overrides in html_content)
      meta: ['charset', 'name', 'content', 'property'],
      // F5: Restrict link to safe rel values only — no external stylesheet loading
      link: ['rel', 'href', 'type'],
      input: ['type', 'name', 'value', 'placeholder', 'required', 'disabled', 'readonly', 'checked', 'min', 'max', 'step', 'pattern', 'maxlength', 'minlength', 'autocomplete', 'autofocus'],
      textarea: ['name', 'placeholder', 'required', 'disabled', 'readonly', 'rows', 'cols', 'maxlength', 'minlength', 'wrap'],
      select: ['name', 'required', 'disabled', 'multiple', 'size'],
      option: ['value', 'selected', 'disabled'],
      optgroup: ['label', 'disabled'],
      // F3: Removed formaction and formmethod — prevents form hijacking
      button: ['type', 'name', 'value', 'disabled'],
      form: ['action', 'method', 'enctype', 'target', 'novalidate', 'autocomplete'],
      label: ['for'],
      td: ['colspan', 'rowspan', 'headers'],
      th: ['colspan', 'rowspan', 'headers', 'scope'],
      col: ['span'],
      colgroup: ['span'],
      svg: ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
      path: ['d', 'fill', 'stroke', 'stroke-width', 'transform'],
      circle: ['cx', 'cy', 'r', 'fill', 'stroke'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
      line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
      polyline: ['points', 'fill', 'stroke'],
      polygon: ['points', 'fill', 'stroke'],
      ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
      g: ['transform', 'fill', 'stroke'],
      text: ['x', 'y', 'dx', 'dy', 'text-anchor', 'font-size', 'fill'],
      tspan: ['x', 'y', 'dx', 'dy'],
      use: ['href', 'x', 'y', 'width', 'height'],
      linearGradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform'],
      radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
      stop: ['offset', 'stop-color', 'stop-opacity'],
      clipPath: ['id'],
      mask: ['id'],
      symbol: ['id', 'viewBox'],
      canvas: ['width', 'height'],
      progress: ['value', 'max'],
      meter: ['value', 'min', 'max', 'low', 'high', 'optimum'],
    },

    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],

    // Strip <script src="..."> but keep inline <script>
    exclusiveFilter: (frame) => {
      if (frame.tag === 'script' && frame.attribs.src) {
        return true // Remove external scripts
      }
      // Remove iframe, object, embed (belt-and-suspenders with tag allowlist)
      if (['iframe', 'object', 'embed'].includes(frame.tag)) {
        return true
      }
      // F5: Strip <link> tags with unsafe rel values (allow canonical, icon only)
      if (frame.tag === 'link') {
        const rel = (frame.attribs.rel || '').toLowerCase()
        if (!['canonical', 'icon', 'shortcut icon', 'apple-touch-icon'].includes(rel)) {
          return true
        }
      }
      return false
    },

    // Allow inline styles
    allowedStyles: {
      '*': {
        // Allow all CSS properties
        'color': [/.*/],
        'background': [/.*/],
        'background-color': [/.*/],
        'background-image': [/.*/],
        'font-size': [/.*/],
        'font-family': [/.*/],
        'font-weight': [/.*/],
        'text-align': [/.*/],
        'text-decoration': [/.*/],
        'margin': [/.*/],
        'margin-top': [/.*/],
        'margin-right': [/.*/],
        'margin-bottom': [/.*/],
        'margin-left': [/.*/],
        'padding': [/.*/],
        'padding-top': [/.*/],
        'padding-right': [/.*/],
        'padding-bottom': [/.*/],
        'padding-left': [/.*/],
        'border': [/.*/],
        'border-radius': [/.*/],
        'display': [/.*/],
        'width': [/.*/],
        'height': [/.*/],
        'max-width': [/.*/],
        'max-height': [/.*/],
        'min-width': [/.*/],
        'min-height': [/.*/],
        'position': [/.*/],
        'top': [/.*/],
        'right': [/.*/],
        'bottom': [/.*/],
        'left': [/.*/],
        'z-index': [/.*/],
        'overflow': [/.*/],
        'opacity': [/.*/],
        'transform': [/.*/],
        'transition': [/.*/],
        'animation': [/.*/],
        'flex': [/.*/],
        'flex-direction': [/.*/],
        'justify-content': [/.*/],
        'align-items': [/.*/],
        'gap': [/.*/],
        'grid': [/.*/],
        'grid-template-columns': [/.*/],
        'grid-template-rows': [/.*/],
        'box-shadow': [/.*/],
        'text-shadow': [/.*/],
        'line-height': [/.*/],
        'letter-spacing': [/.*/],
        'white-space': [/.*/],
        'cursor': [/.*/],
        'visibility': [/.*/],
        'list-style': [/.*/],
        'object-fit': [/.*/],
        'aspect-ratio': [/.*/],
      },
    },

    allowedScriptHostnames: [],
    textFilter: undefined,
  })

  // Post-process: sanitize CSS inside <style> blocks
  return sanitizeCssInStyleBlocks(sanitized)
}

/**
 * Strip dangerous CSS patterns from <style> blocks:
 * - @import rules (external CSS loading)
 * - expression() (IE CSS expressions)
 * - External url() references (only allow data: URIs)
 */
function sanitizeCssInStyleBlocks(html: string): string {
  return html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css: string) => {
    let cleanCss = css
    // Strip @import rules
    cleanCss = cleanCss.replace(/@import\s+[^;]+;?/gi, '')
    // Strip expression()
    cleanCss = cleanCss.replace(/expression\s*\([^)]*\)/gi, '')
    // F7: Strip ALL url() except data: URIs (catches http, https, protocol-relative, ftp, etc.)
    cleanCss = cleanCss.replace(
      /url\s*\(\s*(['"]?)\s*(?!data:)([^)'"]+)\1\s*\)/gi,
      'url(about:blank)'
    )
    return match.replace(css, cleanCss)
  })
}
