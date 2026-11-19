import { join } from 'node:path'
import { codexHome, readText } from './project'

/** El correo de la cuenta con la que inició sesión el CLI de Codex: va en el `id_token` (un JWT) de su `auth.json`; null si no hay sesión o usa API key. */
export function codexEmail(): string | null {
  try {
    const token = (JSON.parse(readText(join(codexHome(), 'auth.json'))) as { tokens?: { id_token?: string } }).tokens?.id_token
    const payload = token?.split('.')[1]
    if (!payload) return null
    const email = (JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email?: unknown }).email
    return typeof email === 'string' ? email : null
  } catch { return null }
}
