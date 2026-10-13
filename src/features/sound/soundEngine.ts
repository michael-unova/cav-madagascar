/**
 * Lightweight notification sounds generated with the Web Audio API.
 * No audio file and no external URL: nothing to fetch, nothing to break.
 *
 * Browsers only allow audio after a user gesture, so the AudioContext is
 * created lazily by unlockAudio(), which must be called from a click/tap/key
 * handler.
 */
export type SoundKind = 'message' | 'question' | 'payment' | 'announcement' | 'test'

type Note = { freq: number; at: number; dur: number }

// Short, soft, rising chimes. Each kind has a slightly different melody.
const PATTERNS: Record<SoundKind, Note[]> = {
  message: [{ freq: 880, at: 0, dur: 0.16 }, { freq: 1175, at: 0.12, dur: 0.22 }],
  question: [{ freq: 660, at: 0, dur: 0.14 }, { freq: 880, at: 0.12, dur: 0.14 }, { freq: 1047, at: 0.24, dur: 0.24 }],
  payment: [{ freq: 523, at: 0, dur: 0.14 }, { freq: 659, at: 0.12, dur: 0.14 }, { freq: 784, at: 0.24, dur: 0.26 }],
  announcement: [{ freq: 784, at: 0, dur: 0.18 }, { freq: 988, at: 0.15, dur: 0.28 }],
  test: [{ freq: 660, at: 0, dur: 0.15 }, { freq: 880, at: 0.13, dur: 0.25 }],
}

const PEAK_GAIN = 0.11 // soft: well below full scale

type AudioContextCtor = typeof AudioContext
let context: AudioContext | null = null

function getContextCtor(): AudioContextCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext
}

export function isAudioSupported(): boolean {
  return getContextCtor() !== undefined
}

/** Creates/resumes the AudioContext. Call from a user gesture. Resolves true when sound can play. */
export async function unlockAudio(): Promise<boolean> {
  const Ctor = getContextCtor()
  if (!Ctor) return false
  try {
    if (!context || context.state === 'closed') context = new Ctor()
    if (context.state === 'suspended') await context.resume()
    return context.state === 'running'
  } catch {
    return false
  }
}

function schedule(ctx: AudioContext, kind: SoundKind) {
  const start = ctx.currentTime + 0.02
  for (const note of PATTERNS[kind]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = note.freq
    const t0 = start + note.at
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.dur + 0.12)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + note.dur + 0.15)
  }
}

/** Plays a notification tone. Returns false when audio is not unlocked (autoplay restriction). */
export function playNotificationTone(kind: SoundKind): boolean {
  const ctx = context
  if (!ctx || ctx.state === 'closed') return false
  try {
    if (ctx.state === 'suspended') {
      // Browsers may suspend the context in the background; try to resume, then play.
      void ctx.resume().then(() => { if (ctx.state === 'running') schedule(ctx, kind) }).catch(() => undefined)
      return false
    }
    schedule(ctx, kind)
    return true
  } catch {
    return false
  }
}
