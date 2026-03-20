import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encrypt, decrypt } from '@/lib/utils/encryption'

describe('encryption', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.ENCRYPTION_KEY = 'test-encryption-key-for-vitest-suite'
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts a simple string', () => {
      const plaintext = 'hello world'
      const encrypted = encrypt(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })

    it('encrypts and decrypts an empty string', () => {
      const encrypted = encrypt('')
      expect(decrypt(encrypted)).toBe('')
    })

    it('encrypts and decrypts JSON data', () => {
      const json = JSON.stringify({ api_key: 'sk-123', secret: 'abc' })
      const encrypted = encrypt(json)
      expect(decrypt(encrypted)).toBe(json)
    })

    it('encrypts and decrypts unicode characters', () => {
      const plaintext = '日本語テスト 🎉 émojis'
      const encrypted = encrypt(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })

    it('produces different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'deterministic?'
      const a = encrypt(plaintext)
      const b = encrypt(plaintext)
      expect(a).not.toBe(b)
      // But both decrypt to the same value
      expect(decrypt(a)).toBe(plaintext)
      expect(decrypt(b)).toBe(plaintext)
    })
  })

  describe('ciphertext format', () => {
    it('produces iv:authTag:ciphertext format', () => {
      const encrypted = encrypt('test')
      const parts = encrypted.split(':')
      expect(parts).toHaveLength(3)
      // IV is 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32)
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32)
      // Ciphertext is non-empty hex
      expect(parts[2].length).toBeGreaterThan(0)
    })
  })

  describe('tamper detection', () => {
    it('throws on tampered ciphertext', () => {
      const encrypted = encrypt('sensitive data')
      const parts = encrypted.split(':')
      // Flip a character in the ciphertext
      parts[2] = parts[2].replace(/[0-9a-f]/, (c) =>
        c === '0' ? '1' : '0'
      )
      const tampered = parts.join(':')
      expect(() => decrypt(tampered)).toThrow()
    })

    it('throws on tampered auth tag', () => {
      const encrypted = encrypt('sensitive data')
      const parts = encrypted.split(':')
      parts[1] = '0'.repeat(32)
      expect(() => decrypt(parts.join(':'))).toThrow()
    })
  })

  describe('invalid input handling', () => {
    it('throws on invalid format (missing parts)', () => {
      expect(() => decrypt('just-one-part')).toThrow('Invalid ciphertext format')
    })

    it('throws on invalid format (too many parts)', () => {
      expect(() => decrypt('a:b:c:d')).toThrow('Invalid ciphertext format')
    })

    it('throws on invalid IV length', () => {
      expect(() => decrypt('aa:' + '00'.repeat(16) + ':abcd')).toThrow('Invalid IV length')
    })

    it('throws on invalid auth tag length', () => {
      expect(() => decrypt('00'.repeat(16) + ':aa:abcd')).toThrow('Invalid auth tag length')
    })
  })

  describe('missing ENCRYPTION_KEY', () => {
    it('throws when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY
      expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required')
    })

    it('throws on decrypt when ENCRYPTION_KEY is not set', () => {
      const encrypted = encrypt('test')
      delete process.env.ENCRYPTION_KEY
      expect(() => decrypt(encrypted)).toThrow('ENCRYPTION_KEY environment variable is required')
    })
  })
})
