import { translate, type MsgKey, type Vars } from '@shared/i18n'
import type { State } from './types'

/** Traduce al idioma que tenga el store en ese momento. */
export const tr = (get: () => State, key: MsgKey, vars?: Vars): string => translate(get().lang, key, vars)
