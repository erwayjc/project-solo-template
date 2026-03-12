/**
 * Returns the site's base URL, with automatic fallback chain:
 * 1. NEXT_PUBLIC_SITE_URL (explicit override)
 * 2. RAILWAY_PUBLIC_DOMAIN (auto-set by Railway on every deployment)
 * 3. localhost:3000 (local development)
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  }
  return 'http://localhost:3000'
}
