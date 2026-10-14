// A soft two-note chime made with Web Audio, so no audio file is needed.
let ctx = null

export function chime() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
    const now = ctx.currentTime
    ;[659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = now + i * 0.22
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.2)
    })
  } catch {
    // Audio unavailable: the visual alert still shows.
  }
}
