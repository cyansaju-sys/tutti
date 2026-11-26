import { Component, type ErrorInfo, type ReactNode } from 'react'
import { t } from '@/lib/i18n'

/**
 * Si un apartado falla al pintarse, React desmonta toda la interfaz y la ventana se queda en negro. Con esto solo ese
 * apartado muestra un aviso (con «Reintentar»); el resto de la app sigue funcionando. `resetKey` lo vuelve a intentar
 * solo al cambiar (por ejemplo, de pestaña).
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: unknown }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error): { error: Error } { return { error } }

  componentDidCatch(error: Error, info: ErrorInfo): void { console.error('[tutti] fallo al pintar un apartado', error, info.componentStack) }

  componentDidUpdate(prev: { resetKey?: unknown }): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex flex-col items-start gap-2 px-3 py-2 text-[12px] text-muted">
        <p className="m-0">{t('app.crashed')}</p>
        <code className="max-w-full truncate text-[11px] opacity-70" title={error.message}>{error.message}</code>
        <button className="rounded-md bg-accent-bg px-2 py-1 text-text transition-colors hover:bg-accent/30" onClick={() => this.setState({ error: null })}>{t('app.retry')}</button>
      </div>
    )
  }
}
