import { describe, expect, it } from 'vitest'
import { isSensitive } from '../../../src/main/services/sensitive'

describe('archivos con secretos', () => {
  it('reconoce .env, claves y credenciales', () => {
    for (const f of ['.env', '.env.local', 'app/.env.production', 'id_rsa', 'certs/server.pem', 'a/b/private.key', '.npmrc', 'credentials.json', 'config/secrets.yaml']) expect(isSensitive(f)).toBe(true)
  })
  it('deja pasar lo normal y las plantillas de ejemplo', () => {
    for (const f of ['.env.example', '.env.sample', 'src/key-map.ts', 'README.md', 'src/secrets-manager.ts', 'monkey.ts']) expect(isSensitive(f)).toBe(false)
  })
})
