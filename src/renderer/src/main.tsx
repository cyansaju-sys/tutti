import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { useStore } from './shared/store'
import { cachedAccent, paintAccent, paintTheme } from './shared/lib/theme'

;(window as unknown as { __tutti: typeof useStore }).__tutti = useStore      // para el modo captura y la depuración

paintAccent(cachedAccent().color)
paintTheme(useStore.getState().themeMode)       // el tema antes del primer pintado: sin parpadeo

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
