import { clsx } from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { newSince, parseChangelog } from '@/shared/lib/changelog'
import { useT } from '@/shared/lib/i18n'
import { useStore } from '@/shared/store'
import changelogText from '../../../../../../CHANGELOG.md?raw'
import changelogEn from '../../../../../../CHANGELOG.en.md?raw'

/** Lo mínimo de Markdown en las frases del changelog: **negrita** y `código`. */
const inline = (text: string): React.ReactNode[] =>
  text.split(/(\*\*.+?\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i} className="font-semibold text-text">{part.slice(2, -2)}</strong>
      : part.startsWith('`') && part.endsWith('`') && part.length > 2 ? <code key={i} className="rounded bg-ov/[0.06] px-1 font-mono text-[11px] text-text">{part.slice(1, -1)}</code>
        : part)

/** Novedades de la versión instalada (o de todas las que se saltó el usuario), como una pestaña más del editor. */
export function NewsView() {
  const t = useT()
  const lang = useStore((s) => s.lang)
  const since = useStore((s) => s.newsSince)
  const [version, setVersion] = useState('')
  useEffect(() => { void window.api.update.version().then(setVersion) }, [])
  const all = useMemo(() => parseChangelog(lang === 'en' ? changelogEn : changelogText), [lang])
  const shown = useMemo(() => {
    if (!version) return []
    const list = since ? newSince(all, since, version) : all.filter((e) => e.version === version)
    return list.length ? list : all.slice(0, 1)
  }, [all, since, version])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto max-w-[760px]">
        <h2 className="pb-2 text-[16px] font-semibold">{version ? t('dlg.newsOf', { v: version }) : t('dlg.news')}</h2>
        {shown.map((entry) => (
          <section key={entry.version} className="mt-1">
            {shown.length > 1 && <h3 className="pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted">v{entry.version}</h3>}
            {entry.groups.map((group, g) => (
              <div key={g}>
                {group.title && <h4 className={clsx('pb-1.5 text-[12px] font-semibold text-text', g ? 'pt-3' : 'pt-1')}>{group.title}</h4>}
                <ul className="flex flex-col gap-2">
                  {group.items.map((item, i) => <li key={i} className="flex gap-2 text-[12px] leading-snug text-muted"><span className="mt-[7px] size-1 shrink-0 rounded-full bg-accent" /><span>{inline(item)}</span></li>)}
                </ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
