/*
 * Calming noise generated entirely with the Web Audio API: no audio files.
 * Each colour is rendered once into a looping buffer.
 */

const SECONDS = 6

function white(ctx) {
  const buf = ctx.createBuffer(2, ctx.sampleRate * SECONDS, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.35
  }
  return buf
}

// Paul Kellet's refined pink-noise filter.
function pink(ctx) {
  const buf = ctx.createBuffer(2, ctx.sampleRate * SECONDS, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09
      b6 = w * 0.115926
    }
  }
  return buf
}

// Integrated (random-walk) noise: deep and rumbly.
function brown(ctx) {
  const buf = ctx.createBuffer(2, ctx.sampleRate * SECONDS, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let last = 0
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 2.8
    }
  }
  return buf
}

// Rain: a soft pink bed plus thousands of tiny decaying "droplet" clicks.
function rain(ctx) {
  const sr = ctx.sampleRate
  const bed = pink(ctx)
  const buf = ctx.createBuffer(2, sr * SECONDS, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    const b = bed.getChannelData(ch)
    for (let i = 0; i < d.length; i++) d[i] = b[i] * 0.55
    const drops = SECONDS * 900
    for (let k = 0; k < drops; k++) {
      const start = Math.floor(Math.random() * d.length)
      const len = Math.floor(sr * (0.002 + Math.random() * 0.012))
      const amp = Math.random() ** 3 * 0.5
      let lp = 0
      for (let j = 0; j < len; j++) {
        lp = lp * 0.6 + (Math.random() * 2 - 1) * 0.4 // slightly softened click
        d[(start + j) % d.length] += lp * amp * Math.exp((-j / len) * 5)
      }
    }
  }
  return buf
}

const MAKERS = { white, pink, brown, rain }

export class NoiseEngine {
  constructor() {
    this.ctx = null
    this.buffers = {}
    this.source = null
    this.gain = null
    this.filter = null
    this.volume = 0.5
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0
      // Gentle low-pass takes the harsh edge off every colour.
      this.filter = this.ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 9000
      this.filter.connect(this.gain).connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  play(kind) {
    this.ensure()
    this.stopSource(0.4)
    this.buffers[kind] ??= MAKERS[kind](this.ctx)
    const src = this.ctx.createBufferSource()
    src.buffer = this.buffers[kind]
    src.loop = true
    src.connect(this.filter)
    src.start()
    this.source = src
    this.fadeTo(this.volume, 1.2)
  }

  setVolume(v) {
    this.volume = v
    if (this.source) this.fadeTo(v, 0.15)
  }

  fadeTo(value, seconds) {
    const now = this.ctx.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(value, now + seconds)
  }

  stopSource(fade = 1.5) {
    if (!this.source) return
    const src = this.source
    this.source = null
    this.fadeTo(0, fade)
    src.stop(this.ctx.currentTime + fade + 0.05)
  }

  stop(fade = 1.5) {
    if (this.ctx) this.stopSource(fade)
  }

  close() {
    this.ctx?.close()
    this.ctx = null
    this.source = null
  }
}
