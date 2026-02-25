"use client"

// Audio engine for TTS + sound effects with browser autoplay policy handling

let audioContext: AudioContext | null = null
let isAudioUnlocked = false

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!audioContext) {
    try {
      audioContext = new AudioContext()
    } catch { /* unsupported */ }
  }
  return audioContext
}

export function unlockAudio(): boolean {
  const ctx = getAudioContext()
  if (!ctx) return false
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {})
  }
  // Create a silent buffer to unlock
  const buffer = ctx.createBuffer(1, 1, 22050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(0)
  isAudioUnlocked = true
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("dou-u-audio-unlocked", "1")
  }
  return true
}

export function isUnlocked(): boolean {
  if (isAudioUnlocked) return true
  if (typeof localStorage !== "undefined") {
    return localStorage.getItem("dou-u-audio-unlocked") === "1"
  }
  return false
}

// Generate a "ding" sound using Web Audio API
export function playDing(volume = 0.5): void {
  const ctx = getAudioContext()
  if (!ctx || ctx.state === "suspended") return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(880, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1)
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.5)
}

// Generate a "coin clink" sound for golden alerts
export function playCoinClink(volume = 0.7): void {
  const ctx = getAudioContext()
  if (!ctx || ctx.state === "suspended") return

  // Two oscillators for metallic sound
  for (const freq of [2637, 3520]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume * 0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.3)
  }
}

// Generate alarm sound for price alerts
let alarmInterval: ReturnType<typeof setInterval> | null = null

export function playAlarm(volume = 0.6): void {
  stopAlarm()
  const ctx = getAudioContext()
  if (!ctx || ctx.state === "suspended") return

  function beep() {
    if (!ctx || ctx.state === "suspended") return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(440, ctx.currentTime)
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  }

  beep()
  alarmInterval = setInterval(beep, 800)
}

export function stopAlarm(): void {
  if (alarmInterval) {
    clearInterval(alarmInterval)
    alarmInterval = null
  }
}

// TTS using Web Speech API
export function speakTTS(
  text: string,
  options: { volume?: number; rate?: number; voice?: "male" | "female" } = {}
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = "zh-CN"
  utter.volume = options.volume ?? 0.7
  utter.rate = options.rate ?? 1.0

  // Try to pick a Chinese voice, prefer female
  const voices = window.speechSynthesis.getVoices()
  const zhVoices = voices.filter((v) => v.lang.startsWith("zh"))
  if (zhVoices.length > 0) {
    if (options.voice === "male") {
      utter.voice = zhVoices.find((v) => /male/i.test(v.name)) || zhVoices[0]
    } else {
      utter.voice = zhVoices.find((v) => /female/i.test(v.name)) || zhVoices[0]
    }
  }

  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utter)
}
