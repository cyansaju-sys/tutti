import type { Lang } from '@shared/i18n'

/** Dónde está un archivo dentro de .tutti/specs/<spec>/: la carpeta (relativa al proyecto) y el archivo. */
export interface SpecContext { dir: string; file: string }

/** Si `path` es un archivo de una spec (`…/.tutti/specs/<spec>/<archivo>.md`), devuelve su carpeta y su nombre. */
export function specContext(path: string): SpecContext | null {
  const m = /[\\/]\.tutti[\\/]specs[\\/]([^\\/]+)[\\/]([^\\/]+\.md)$/.exec(path)
  return m ? { dir: `.tutti/specs/${m[1]}`, file: m[2] } : null
}

/** La primera tarea sin marcar de un tasks.md (la de más arriba, con su texto), o null si no queda ninguna. */
export function nextTask(text: string): string | null {
  const m = /^\s*[-*] \[ \]\s+(.*)$/m.exec(text)
  return m ? m[1].replace(/\s+_.*_$/, '').trim() : null
}

export type SpecActionId = 'analyze' | 'updateDesign' | 'updateTasks' | 'runNext' | 'runAll'
export interface SpecAction { id: SpecActionId; prompt: string; disabled?: boolean }

/** Lo que se le puede pedir al agente según el archivo de la spec que estás viendo (las acciones de Kiro: analizar, actualizar y ejecutar tareas). */
export function specActions(lang: Lang, ctx: SpecContext, text: string): SpecAction[] {
  const en = lang === 'en'
  const { dir, file } = ctx
  if (file === 'requirements.md' || file === 'bugfix.md') {
    return [
      { id: 'analyze', prompt: en
        ? `Analyze ${dir}/${file}: look for inconsistencies, ambiguities and gaps (edge cases, errors, criteria that cannot be verified). List the problems with where they are and propose fixes. Do NOT change any file until I approve it.`
        : `Analiza ${dir}/${file}: busca inconsistencias, ambigüedades y huecos (casos límite, errores, criterios que no se pueden comprobar). Lista los problemas con dónde están y propón correcciones. NO modifiques ningún archivo hasta que yo lo apruebe.` },
      { id: 'updateDesign', prompt: en
        ? `I changed ${dir}/${file}. Update ${dir}/design.md and ${dir}/tasks.md so they match the change, keeping the tasks already ticked [x]. Tell me what you change. Do not write code.`
        : `He cambiado ${dir}/${file}. Actualiza ${dir}/design.md y ${dir}/tasks.md para que reflejen el cambio, conservando las tareas ya marcadas [x]. Cuéntame qué cambias. No escribas código.` }
    ]
  }
  if (file === 'design.md') {
    return [{ id: 'updateTasks', prompt: en
      ? `I changed ${dir}/design.md. Update ${dir}/tasks.md so it matches, keeping the tasks already ticked [x]. Tell me what you change. Do not write code.`
      : `He cambiado ${dir}/design.md. Actualiza ${dir}/tasks.md para que lo refleje, conservando las tareas ya marcadas [x]. Cuéntame qué cambias. No escribas código.` }]
  }
  if (file === 'tasks.md') {
    const task = nextTask(text)
    return [
      { id: 'runNext', disabled: !task, prompt: en
        ? `Run ONLY this task from ${dir}/tasks.md: “${task}”. Do it, check that it works and tick its checkbox [x]. Then stop and wait for my go-ahead.`
        : `Ejecuta SOLO esta tarea de ${dir}/tasks.md: «${task}». Hazla, comprueba que funciona y marca su casilla como [x]. Después para y espera mi visto bueno.` },
      { id: 'runAll', disabled: !task, prompt: en
        ? `Run all the pending tasks in ${dir}/tasks.md in order, ticking each checkbox [x] when you finish it. If one fails, stop and tell me.`
        : `Ejecuta todas las tareas pendientes de ${dir}/tasks.md en orden, marcando cada casilla [x] al terminar. Si una falla, para y cuéntamelo.` }
    ]
  }
  return []
}
