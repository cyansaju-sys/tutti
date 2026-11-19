import { probe } from './probe'

/** El correo de la cuenta con la que inició sesión Claude Code (el SDK lo da en `accountInfo`); null si no hay sesión o usa API key. */
export const claudeEmail = (): Promise<string | null> => probe(async (q) => (await q.accountInfo()).email ?? null).catch(() => null)
