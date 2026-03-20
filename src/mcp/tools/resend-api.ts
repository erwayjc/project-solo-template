// ---------------------------------------------------------------------------
// Generic Resend API Tool — lets agents call any Resend SDK method
// ---------------------------------------------------------------------------

import { getResend } from '@/lib/resend/client'
import type { ToolDefinition } from '../types'

/**
 * Supported Resend SDK resources and their methods.
 * This map drives validation and documentation for the agent.
 */
const ALLOWED_METHODS: Record<string, string[]> = {
  emails: ['send', 'get', 'list', 'update', 'cancel'],
  domains: ['list', 'get', 'verify'],
  webhooks: ['create', 'list', 'get', 'update', 'remove'],
  contacts: ['create', 'list', 'get', 'update', 'remove'],
  audiences: ['create', 'list', 'get', 'remove'],
  // apiKeys intentionally excluded — agents should not create or manage API keys
}

export const tools: ToolDefinition[] = [
  {
    name: 'call_resend_api',
    description:
      `Call any Resend API method directly. This gives you full access to Resend's capabilities: sending emails, managing domains, webhooks, contacts, audiences, and API keys.

Available resources and methods:
- emails: send, get, list, update, cancel
- domains: create, list, get, update, remove, verify
- webhooks: create, list, get, update, remove
- contacts: create, list, get, update, remove
- audiences: create, list, get, remove
Example: resource="webhooks", method="create", params={"endpoint": "https://mysite.com/api/webhooks/resend", "events": ["email.received"]}
Example: resource="domains", method="list", params={}
Example: resource="emails", method="send", params={"from": "support@mysite.com", "to": "user@example.com", "subject": "Hello", "html": "<p>Hi!</p>"}`,
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          enum: Object.keys(ALLOWED_METHODS),
          description: 'The Resend API resource to call (e.g. "webhooks", "domains", "emails").',
        },
        method: {
          type: 'string',
          description: 'The method to call on the resource (e.g. "create", "list", "get").',
        },
        params: {
          type: 'object',
          description:
            'Parameters to pass to the method. Varies by resource/method — check Resend API docs if unsure.',
        },
      },
      required: ['resource', 'method'],
    },
    async execute(toolParams) {
      const resource = toolParams.resource as string
      const method = toolParams.method as string
      const params = (toolParams.params as Record<string, unknown>) ?? {}

      // Validate resource
      const allowedMethods = ALLOWED_METHODS[resource]
      if (!allowedMethods) {
        return {
          success: false,
          error: `Unknown resource "${resource}". Available: ${Object.keys(ALLOWED_METHODS).join(', ')}`,
        }
      }

      // Validate method
      if (!allowedMethods.includes(method)) {
        return {
          success: false,
          error: `Unknown method "${method}" on resource "${resource}". Available: ${allowedMethods.join(', ')}`,
        }
      }

      try {
        const resend = getResend()
        const resourceObj = (resend as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>)[resource]

        if (!resourceObj || typeof resourceObj[method] !== 'function') {
          return {
            success: false,
            error: `Method "${resource}.${method}" not available on this Resend SDK version.`,
          }
        }

        // Call the method — most Resend methods take a single params object,
        // but some (like .get(id)) take a positional argument.
        let result: unknown
        if (method === 'get' && typeof params.id === 'string') {
          result = await resourceObj[method](params.id)
        } else if (method === 'remove' && typeof params.id === 'string') {
          result = await resourceObj[method](params.id)
        } else if (method === 'verify' && typeof params.id === 'string') {
          result = await resourceObj[method](params.id)
        } else if (Object.keys(params).length === 0) {
          result = await resourceObj[method]()
        } else {
          result = await resourceObj[method](params)
        }

        // Resend SDK returns { data, error }
        const res = result as { data?: unknown; error?: { message: string } }
        if (res?.error) {
          return { success: false, error: res.error.message }
        }

        return { success: true, data: res?.data ?? res }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : `Resend API call failed: ${resource}.${method}`,
        }
      }
    },
  },
]
