import { useEffect, useRef, useState } from 'react'
import type { WhisperIn, WhisperOut } from './whisper.worker'

/** Idiomas del dictado (Whisper los admite todos, pero fijarlo evita que confunda el idioma en frases cortas). */
export const DICTATION_LANGS = ['es', 'en'] as const
export type DictationLang = (typeof DICTATION_LANGS)[number]

/** `recording`: escuchando; `busy`: frases que Whisper aún está pasando a texto; `percent`: descarga del modelo (solo la primera vez). */
export interface DictationState { recording: boolean; busy: number; percent: number | null }

// un solo worker para toda la app (los dos chats lo comparten): el modelo se carga una vez
let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { done: (text: string) => void; fail: (message: string) => void }>()
const progress = new Set<(percent: number | null) => void>()
function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<WhisperOut>): void => {
    const m = e.data
    if (m.kind === 'progress') progress.forEach((f) => f(m.percent))
    else if (m.kind === 'ready') progress.forEach((f) => f(null))
    else { const p = pending.get(m.id); pending.delete(m.id); if (m.kind === 'result') p?.done(m.text); else p?.fail(m.message) }
  }
  worker.onerror = (e): void => { pending.forEach((p) => p.fail(e.message || 'Whisper')); pending.clear(); worker?.terminate(); worker = null }
  return worker
}

function transcribe(audio: Float32Array, language: DictationLang): Promise<string> {
  return new Promise((done, fail) => {
    const id = nextId++
    pending.set(id, { done, fail })
    const msg: WhisperIn = { id, audio, language }
    getWorker().postMessage(msg, [audio.buffer])
  })
}

const RATE = 16000                // lo que espera Whisper
const FRAME = 2048                // ~128 ms por bloque
const PAUSE_MS = 700              // silencio que cierra una frase
const MIN_SPEECH_MS = 300         // menos que esto es un ruido, no una frase
const MAX_MS = 25000              // una frase muy larga se corta igual (Whisper trabaja con trozos de 30 s)
const frameMs = (FRAME / RATE) * 1000

/** Lo que Whisper «oye» en el silencio o el ruido: se descarta. */
const isNoise = (text: string): boolean => !text || /^[\s.,…!?¡¿-]*$/.test(text) || /^[[(（].*[\])）]$/.test(text)

const join = (parts: Float32Array[]): Float32Array => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}

/**
 * Dictado por voz continuo: mientras graba, cada vez que hay una pausa la frase dicha se pasa a texto y se entrega a
 * `onText` (en orden). `toggle` empieza o para de escuchar; al parar, se transcribe lo que quedara.
 */
export function useDictation(lang: DictationLang, onText: (text: string) => void, onError: (message: string) => void): { state: DictationState; toggle: () => void } {
  const [state, setState] = useState<DictationState>({ recording: false, busy: 0, percent: null })
  const stopRef = useRef<(() => void) | null>(null)
  const cb = useRef({ onText, onError, lang })
  cb.current = { onText, onError, lang }

  useEffect(() => {
    const onProgress = (percent: number | null): void => setState((s) => ({ ...s, percent }))
    progress.add(onProgress)
    return () => { progress.delete(onProgress); stopRef.current?.() }
  }, [])

  // las frases se entregan en el orden en que se dijeron, aunque alguna tarde más
  const order = useRef<Promise<void>>(Promise.resolve())
  const send = (audio: Float32Array): void => {
    setState((s) => ({ ...s, busy: s.busy + 1 }))
    const result = transcribe(audio, cb.current.lang).then((text) => text.trim(), (e: unknown) => { cb.current.onError(e instanceof Error ? e.message : String(e)); return '' })
    order.current = order.current.then(async () => {
      const text = await result
      if (!isNoise(text)) cb.current.onText(text)
      setState((s) => ({ ...s, busy: Math.max(0, s.busy - 1) }))
    })
  }

  const starting = useRef(false)
  const start = async (): Promise<void> => {
    if (starting.current) return          // un doble clic mientras se pide el micrófono
    starting.current = true
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } }) } catch (e) {
      starting.current = false
      cb.current.onError(e instanceof Error ? e.message : String(e)); return
    }
    starting.current = false
    getWorker()          // el modelo empieza a cargarse mientras se habla
    const ctx = new AudioContext({ sampleRate: RATE })
    const source = ctx.createMediaStreamSource(stream)
    const node = ctx.createScriptProcessor(FRAME, 1, 1)          // obsoleto pero sencillo y sin archivos aparte (un AudioWorklet necesitaría su propio módulo)
    const mute = ctx.createGain(); mute.gain.value = 0          // el nodo tiene que llegar al destino para funcionar, pero sin sonar

    let floor = 0.005             // ruido de fondo (se ajusta solo)
    let speech: Float32Array[] = []
    let preroll: Float32Array | null = null          // el bloque anterior al primer sonido: así no se come el principio de la palabra
    let spokenMs = 0, silentMs = 0
    const flush = (): void => {
      if (spokenMs >= MIN_SPEECH_MS) send(join(speech))
      speech = []; spokenMs = 0; silentMs = 0
    }
    node.onaudioprocess = (e) => {
      const frame = e.inputBuffer.getChannelData(0).slice()
      let sum = 0
      for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
      const rms = Math.sqrt(sum / frame.length)
      const loud = rms > Math.max(0.012, floor * 3)
      if (!loud) floor = floor * 0.95 + rms * 0.05
      if (speech.length === 0) {
        if (loud) { speech = preroll ? [preroll, frame] : [frame]; spokenMs = frameMs }
        else preroll = frame
        return
      }
      speech.push(frame)
      if (loud) { spokenMs += frameMs; silentMs = 0 } else silentMs += frameMs
      if (silentMs >= PAUSE_MS || speech.length * frameMs >= MAX_MS) { flush(); preroll = null }
    }
    source.connect(node); node.connect(mute); mute.connect(ctx.destination)

    stopRef.current = () => {
      stopRef.current = null
      node.onaudioprocess = null
      source.disconnect(); node.disconnect(); mute.disconnect()
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
      flush()          // lo que se estaba diciendo al parar
      setState((s) => ({ ...s, recording: false }))
    }
    setState((s) => ({ ...s, recording: true }))
  }

  const toggle = (): void => { if (stopRef.current) stopRef.current(); else void start() }
  return { state, toggle }
}
