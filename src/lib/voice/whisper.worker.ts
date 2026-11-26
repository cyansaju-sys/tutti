/// <reference lib="webworker" />
/**
 * Whisper dentro de la app: transforma el audio grabado en texto sin salir del equipo. Corre en un worker para no
 * congelar la interfaz. El modelo se descarga la primera vez de Hugging Face y queda en la caché del navegador.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers'

// el motor (onnxruntime-web) va dentro de la app: sin esto lo pediría a un CDN
const wasm = env.backends.onnx.wasm
if (wasm) {
  wasm.wasmPaths = {
    mjs: new URL('../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs', import.meta.url).href,
    wasm: new URL('../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm', import.meta.url).href
  }
  wasm.numThreads = 1          // sin aislamiento de origen no hay SharedArrayBuffer: un hilo, pero sin errores
}
env.allowLocalModels = false

const MODEL = 'onnx-community/whisper-base'

export type WhisperIn = { id: number; audio: Float32Array; language: string }
export type WhisperOut =
  | { kind: 'progress'; percent: number }          // descargando el modelo (solo la primera vez)
  | { kind: 'ready' }
  | { kind: 'result'; id: number; text: string }
  | { kind: 'error'; id: number; message: string }

const post = (m: WhisperOut): void => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m)

let model: Promise<AutomaticSpeechRecognitionPipeline> | null = null
function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (!model) {
    const files = new Map<string, { loaded: number; total: number }>()
    model = pipeline('automatic-speech-recognition', MODEL, {
      device: 'wasm',
      dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' },          // el encoder pierde mucho si se cuantiza; el decoder no tanto
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file || !p.total) return
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total })
        const all = [...files.values()].reduce((acc, f) => ({ loaded: acc.loaded + f.loaded, total: acc.total + f.total }), { loaded: 0, total: 0 })
        post({ kind: 'progress', percent: Math.round((all.loaded / Math.max(1, all.total)) * 100) })
      }
    }) as Promise<AutomaticSpeechRecognitionPipeline>
    model.then(() => post({ kind: 'ready' }), () => { model = null })          // si falla (sin red), se reintenta la próxima vez
  }
  return model
}

void load().catch(() => undefined)          // el worker nace al pulsar el micrófono: el modelo se carga mientras se habla

// los trozos llegan seguidos al hablar con pausas: se transcriben de uno en uno y en orden (el modelo no admite dos a la vez)
let queue: Promise<void> = Promise.resolve()
self.onmessage = (e: MessageEvent<WhisperIn>): void => {
  const { id, audio, language } = e.data
  queue = queue.then(async () => {
    try {
      const asr = await load()
      const out = await asr(audio, { language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
      const text = (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).trim()
      post({ kind: 'result', id, text })
    } catch (err) {
      post({ kind: 'error', id, message: err instanceof Error ? err.message : String(err) })
    }
  })
}
