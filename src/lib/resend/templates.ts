interface EmailTemplate {
  subject: string
  html: string
}

const UNSUBSCRIBE_PLACEHOLDER = '{{unsubscribe_url}}'

function wrapInLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; color: #111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>
        </table>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 24px 40px; text-align: center; font-size: 12px; color: #9ca3af;">
              <p style="margin: 0;">
                <a href="${UNSUBSCRIBE_PLACEHOLDER}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildWelcomeEmail(
  name: string,
  downloadUrl?: string
): EmailTemplate {
  const greeting = name ? `Hi ${name},` : 'Hi there,'
  const downloadSection = downloadUrl
    ? `<p style="margin: 24px 0;">
        <a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Download Your Resource
        </a>
      </p>`
    : ''

  const html = wrapInLayout(`
    <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111827;">Welcome!</h1>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">${greeting}</p>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
      Thanks for joining! We're excited to have you here.
    </p>
    ${downloadSection}
    <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.6; color: #374151;">
      If you have any questions, just reply to this email.
    </p>
  `)

  return {
    subject: downloadUrl ? 'Welcome! Here\'s your download' : 'Welcome aboard!',
    html,
  }
}

export function buildReceiptEmail(
  name: string,
  productName: string,
  amount: number
): EmailTemplate {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount / 100)

  const html = wrapInLayout(`
    <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111827;">Payment Confirmed</h1>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">Hi ${name},</p>
    <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #374151;">
      Thank you for your purchase! Here are the details:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 14px; color: #6b7280; padding-bottom: 8px;">Product</td>
              <td style="font-size: 14px; color: #111827; padding-bottom: 8px; text-align: right; font-weight: 600;">${productName}</td>
            </tr>
            <tr>
              <td style="font-size: 14px; color: #6b7280; padding-top: 8px; border-top: 1px solid #e5e7eb;">Total</td>
              <td style="font-size: 14px; color: #111827; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${formattedAmount}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
      If you have any questions about your purchase, just reply to this email.
    </p>
  `)

  return {
    subject: `Receipt for ${productName}`,
    html,
  }
}

export function buildSequenceEmail(
  subject: string,
  body: string,
  name?: string
): EmailTemplate {
  const personalizedBody = name
    ? body.replace(/\{\{name\}\}/g, name)
    : body.replace(/\{\{name\}\}/g, 'there')

  const html = wrapInLayout(`
    <div style="font-size: 16px; line-height: 1.6; color: #374151;">
      ${personalizedBody}
    </div>
  `)

  return {
    subject: name ? subject.replace(/\{\{name\}\}/g, name) : subject,
    html,
  }
}

export function buildBroadcastEmail(
  subject: string,
  body: string,
  name?: string
): EmailTemplate {
  return buildSequenceEmail(subject, body, name)
}

export function buildTestimonialRequestEmail(
  customerName: string,
  siteName: string,
  submitUrl: string
): EmailTemplate {
  const safeName = escapeHtml(customerName || 'there')
  const safeSiteName = escapeHtml(siteName)
  const safeUrl = encodeURI(submitUrl)
  const html = wrapInLayout(`
    <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #111827;">We&rsquo;d love your feedback!</h1>
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">
      Hi ${safeName}, you&rsquo;ve been making great progress! We&rsquo;d love to hear about your experience with ${safeSiteName}. It only takes a minute.
    </p>
    <p style="margin: 24px 0;">
      <a href="${safeUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600;">
        Share Your Feedback
      </a>
    </p>
    <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: #6b7280;">
      Thank you for being a valued member of our community.
    </p>
  `)

  return {
    subject: "We'd love your feedback!",
    html,
  }
}

/**
 * Wrap content in the standard email layout but without the unsubscribe link.
 * Used for transactional support replies (not marketing).
 */
function wrapInSupportLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb; color: #111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 40px;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildSupportReplyEmail(
  subject: string,
  body: string,
  siteName: string,
  customerName?: string
): EmailTemplate {
  const safeName = customerName ? escapeHtml(customerName) : null
  const greeting = safeName ? `Hi ${safeName},` : 'Hi there,'
  const bodyHtml = body
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => `<p style="margin: 0 0 12px; font-size: 16px; line-height: 1.6; color: #374151;">${escapeHtml(line)}</p>`)
    .join('\n')

  const safeSiteName = escapeHtml(siteName)

  const html = wrapInSupportLayout(`
    <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #374151;">${greeting}</p>
    ${bodyHtml}
    <p style="margin: 24px 0 0; font-size: 16px; line-height: 1.6; color: #374151;">
      Best regards,<br />${safeSiteName} Support
    </p>
  `)

  return { subject, html }
}
