import type { Lang } from '@shared/i18n'
import type { HookForm } from './spec'
import { EMPTY_HOOK_FORM } from './spec'

/** El documento del formulario de un hook: el de uno nuevo, o el de editar el hook número `index` de un archivo. */
export const HOOK_NEW = 'hook:new'
export const hookEditPath = (file: string, index: number): string => `hook:edit:${index}:${file}`
export function parseHookEditPath(path: string): { file: string; index: number } | null {
  const m = /^hook:edit:(\d+):(.+)$/.exec(path)
  return m ? { index: Number(m[1]), file: m[2] } : null
}

type RawHook = Record<string, unknown> & { action?: { type?: string; command?: string; prompt?: string } }

/** Lo que dice un hook de un archivo, convertido a los campos del formulario. */
export function hookToForm(h: RawHook): HookForm {
  const action = h.action?.type === 'command' ? 'command' : 'agent'
  return {
    ...EMPTY_HOOK_FORM, name: typeof h.name === 'string' ? h.name : '', description: typeof h.description === 'string' ? h.description : '',
    trigger: typeof h.trigger === 'string' ? h.trigger : 'PostFileSave', matcher: typeof h.matcher === 'string' ? h.matcher : '', action,
    command: h.action?.command ?? '', prompt: h.action?.prompt ?? '', timeout: typeof h.timeout === 'number' ? String(h.timeout) : '60'
  }
}

/** El hook número `index` de un archivo de hooks, listo para el formulario, o null si no se puede leer. */
export function readHookForm(text: string, index: number): HookForm | null {
  try {
    const data = JSON.parse(text) as { hooks?: RawHook[] }
    return data.hooks?.[index] ? hookToForm(data.hooks[index]) : null
  } catch { return null }
}

/** Guarda lo editado en su sitio: cambia los campos del formulario y respeta lo demás (otros hooks del archivo, `enabled`, `confirm`…). */
export function replaceHook(text: string, index: number, f: HookForm): string | null {
  try {
    const data = JSON.parse(text) as { hooks?: RawHook[] }
    const old = data.hooks?.[index]
    if (!data.hooks || !old) return null
    const { description: _d, matcher: _m, timeout: _t, ...rest } = old
    const timeout = Number(f.timeout)
    data.hooks[index] = {
      ...rest, name: f.name.trim(), ...(f.description.trim() && { description: f.description.trim() }), trigger: f.trigger, ...(f.matcher.trim() && { matcher: f.matcher.trim() }),
      action: f.action === 'command' ? { type: 'command', command: f.command.trim() } : { type: 'agent', prompt: f.prompt.trim() },
      ...(f.action === 'command' && timeout !== 60 && { timeout })
    }
    return JSON.stringify(data, null, 2) + '\n'
  } catch { return null }
}

/** Lo que se le pide al agente para crear un hook a partir de una descripción en lenguaje natural (lo guarda apagado hasta que lo apruebes). */
export function hookAgentPrompt(lang: Lang, description: string): string {
  const shape = '{ "version": "v1", "hooks": [{ "name", "description", "trigger", "matcher", "action": { "type": "command" | "agent", "command" | "prompt" }, "timeout", "enabled" }] }'
  return lang === 'en'
    ? `Create a hook in .tutti/hooks/<short-name>.json in Kiro's format: ${shape}. Events: PostFileSave (the only one Tutti runs), PreToolUse, PostToolUse, Stop; "matcher" is a regular expression on the file path. What I want: ${description.trim()}\nShow me the JSON before saving it, and save it with "enabled": false until I approve it.`
    : `Crea un hook en .tutti/hooks/<nombre-corto>.json en el formato de Kiro: ${shape}. Eventos: PostFileSave (el único que ejecuta Tutti), PreToolUse, PostToolUse, Stop; "matcher" es una expresión regular sobre la ruta del archivo. Lo que quiero: ${description.trim()}\nEnséñame el JSON antes de guardarlo y guárdalo con "enabled": false hasta que yo lo apruebe.`
}
