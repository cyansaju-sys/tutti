import { t } from '../../../shared/lib/i18n'
import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { css } from '@codemirror/lang-css'
import { cpp } from '@codemirror/lang-cpp'
import { go } from '@codemirror/lang-go'
import { html } from '@codemirror/lang-html'
import { java } from '@codemirror/lang-java'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { PLSQL, sql } from '@codemirror/lang-sql'
import { yaml } from '@codemirror/lang-yaml'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { toml } from '@codemirror/legacy-modes/mode/toml'

const byExt: Record<string, () => Extension> = {
  js: () => javascript({ jsx: true }), jsx: () => javascript({ jsx: true }), mjs: () => javascript(), cjs: () => javascript(),
  ts: () => javascript({ typescript: true }), tsx: () => javascript({ jsx: true, typescript: true }),
  mts: () => javascript({ typescript: true }), cts: () => javascript({ typescript: true }),
  py: () => python(), pyw: () => python(),
  sql: () => sql({ dialect: PLSQL }), pks: () => sql({ dialect: PLSQL }), pkb: () => sql({ dialect: PLSQL }),
  fnc: () => sql({ dialect: PLSQL }), prc: () => sql({ dialect: PLSQL }), trg: () => sql({ dialect: PLSQL }), plsql: () => sql({ dialect: PLSQL }),
  json: () => json(), jsonc: () => json(), css: () => css(), scss: () => css(),
  html: () => html(), htm: () => html(), xml: () => html(), svg: () => html(), vue: () => html(),
  md: () => markdown(), markdown: () => markdown(),
  rs: () => rust(), go: () => go(), java: () => java(),
  c: () => cpp(), h: () => cpp(), cc: () => cpp(), cpp: () => cpp(), cxx: () => cpp(),
  hpp: () => cpp(), hh: () => cpp(), hxx: () => cpp(),
  php: () => php(), phtml: () => php(),
  sh: () => StreamLanguage.define(shell), bash: () => StreamLanguage.define(shell),
  zsh: () => StreamLanguage.define(shell), fish: () => StreamLanguage.define(shell),
  yaml: () => yaml(), yml: () => yaml(), toml: () => StreamLanguage.define(toml)
}

export function languageFor(fileName: string): Extension {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  return byExt[ext]?.() ?? []
}

export function languageName(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  const names: Record<string, string> = {
    js: 'JavaScript', jsx: 'JavaScript JSX', ts: 'TypeScript', tsx: 'TypeScript JSX', py: 'Python', sql: 'SQL', json: 'JSON',
    css: 'CSS', html: 'HTML', md: 'Markdown', xml: 'XML', svg: 'SVG', vue: 'Vue', rs: 'Rust', go: 'Go', java: 'Java',
    c: 'C/C++', h: 'C/C++', cc: 'C++', cpp: 'C++', cxx: 'C++', hpp: 'C++', hh: 'C++', hxx: 'C++', php: 'PHP', phtml: 'PHP',
    sh: 'Shell', bash: 'Shell', zsh: 'Shell', fish: 'Shell', yaml: 'YAML', yml: 'YAML', toml: 'TOML'
  }
  return names[ext] ?? t('lang.text')
}
