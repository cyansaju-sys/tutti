/** Funciones del SDK de Claude (Agent SDK) que corren en el proceso principal. La interfaz vive en el renderer. */
import type { ChatModel } from '@/shared/types'
import { probe } from './probe'

/** Los modelos disponibles para la cuenta con la que ha iniciado sesión Claude Code. */
export const listModels = (): Promise<ChatModel[]> => probe(async (q) =>
  (await q.supportedModels()).map((m) => ({ value: m.value, displayName: m.displayName, description: m.description, efforts: m.supportsEffort ? m.supportedEffortLevels : undefined })))
