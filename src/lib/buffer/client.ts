const BUFFER_API_BASE = 'https://api.bufferapp.com/1'

interface BufferProfile {
  id: string
  service: string
  service_username: string
  formatted_username: string
  default: boolean
}

interface BufferPublishResult {
  success: boolean
  message: string
  updates: Array<{
    id: string
    status: string
    text: string
    scheduled_at?: number
  }>
}

function getAccessToken(): string {
  const token = process.env.BUFFER_ACCESS_TOKEN
  if (!token) {
    throw new Error('BUFFER_ACCESS_TOKEN environment variable is not set')
  }
  return token
}

async function bufferFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken()
  const url = `${BUFFER_API_BASE}${endpoint}`

  const separator = url.includes('?') ? '&' : '?'
  const authenticatedUrl = `${url}${separator}access_token=${token}`

  const response = await fetch(authenticatedUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `Buffer API error (${response.status}): ${errorText}`
    )
  }

  return response.json() as Promise<T>
}

export async function getProfiles(): Promise<BufferProfile[]> {
  return bufferFetch<BufferProfile[]>('/profiles.json')
}

export async function publishPost(
  content: string,
  profileIds: string[],
  scheduledAt?: Date
): Promise<BufferPublishResult> {
  const params = new URLSearchParams()
  params.set('text', content)
  params.set('shorten', 'true')

  profileIds.forEach((id) => {
    params.append('profile_ids[]', id)
  })

  if (scheduledAt) {
    params.set('scheduled_at', scheduledAt.toISOString())
  } else {
    params.set('now', 'true')
  }

  return bufferFetch<BufferPublishResult>('/updates/create.json', {
    method: 'POST',
    body: params.toString(),
  })
}
