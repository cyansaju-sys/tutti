/** Modelos que se pueden elegir en el chat para cada agente (el resto usa el suyo por defecto). Los demás agentes no se listan: no hay una forma segura de elegirlo. */
export const CHAT_MODELS: Record<string, string[]> = {
  claude: ['haiku', 'sonnet', 'opus'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  codex: []
}
