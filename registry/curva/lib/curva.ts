import * as React from "react"

/**
 * Curva core: the maths every chart shares.
 *
 * Shapes are stored as SAMPLES points evenly spaced from u = 0 to u = 1,
 * with values normalised to the chart's domain (0 = bottom, 1 = top).
 * Any two datasets can then morph into each other whatever their lengths.
 */
export const SAMPLES = 200

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

export const flat = (v: number) => new Array<number>(SAMPLES).fill(v)

/**
 * Samples the monotone cubic curve through evenly spaced values
 * (Steffen's method, the same curve as d3's curveMonotoneX).
 */
export function sampleMonotone(values: readonly number[], count = SAMPLES) {
  const n = values.length
  if (n === 0) return new Array<number>(count).fill(0)
  if (n === 1) return new Array<number>(count).fill(values[0])

  const d: number[] = []
  for (let i = 0; i < n - 1; i++) d.push(values[i + 1] - values[i])

  const m = new Array<number>(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    const s0 = d[i - 1]
    const s1 = d[i]
    const p = (s0 + s1) / 2
    m[i] =
      (Math.sign(s0) + Math.sign(s1)) *
      Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p))
  }
  m[0] = n > 2 ? (3 * d[0] - m[1]) / 2 : d[0]
  m[n - 1] = n > 2 ? (3 * d[n - 2] - m[n - 2]) / 2 : d[0]

  const out = new Array<number>(count)
  for (let j = 0; j < count; j++) {
    const x = count === 1 ? 0 : (j / (count - 1)) * (n - 1)
    const i = Math.min(Math.floor(x), n - 2)
    const t = x - i
    const t2 = t * t
    const t3 = t2 * t
    out[j] =
      (2 * t3 - 3 * t2 + 1) * values[i] +
      (t3 - 2 * t2 + t) * m[i] +
      (-2 * t3 + 3 * t2) * values[i + 1] +
      (t3 - t2) * m[i + 1]
  }
  return out
}

/** Reads a sampled shape at u (0–1), interpolating between samples. */
export function sampleAt(shape: readonly number[], u: number) {
  const x = clamp(u, 0, 1) * (shape.length - 1)
  const i = Math.min(Math.floor(x), shape.length - 2)
  const t = x - i
  return shape[i] + (shape[i + 1] - shape[i]) * t
}

/** A damped spring as an easing curve: settles at t = 1 with a 2% overshoot. */
export function springEase(t: number) {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const zeta = 0.78
  const omega = 9
  const wd = omega * Math.sqrt(1 - zeta * zeta)
  const decay = Math.exp(-zeta * omega * t)
  return 1 - decay * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
}

/**
 * The frame of a morph at `progress` (0–1). Samples start one after another
 * from left to right (`stagger` is the share of the timeline spent waiting),
 * so a change travels across the chart like a wave.
 */
export function waveFrame(
  from: readonly number[],
  to: readonly number[],
  progress: number,
  stagger: number,
  out: number[] = new Array<number>(to.length)
) {
  const last = to.length - 1
  for (let i = 0; i <= last; i++) {
    const local = (progress - (i / last) * stagger) / (1 - stagger)
    out[i] = from[i] + (to[i] - from[i]) * springEase(local)
  }
  return out
}

export type Domain = { lo: number; hi: number; ticks: number[] }

const DIVISIONS = 4

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  const nice = unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10
  return nice * power
}

/**
 * A domain that always includes zero and splits into four round steps, so
 * gridlines keep their place while the labels count to new values.
 */
export function niceDomain(values: readonly number[]): Domain {
  const lo = Math.min(0, ...values)
  let hi = Math.max(0, ...values)
  if (hi === lo) hi = lo + 1

  let step = niceStep((hi - lo) / DIVISIONS)
  let niceLo = Math.floor(lo / step) * step
  while (niceLo + step * DIVISIONS < hi) {
    step = niceStep(step * 1.01)
    niceLo = Math.floor(lo / step) * step
  }

  const ticks = Array.from({ length: DIVISIONS + 1 }, (_, k) =>
    Number((niceLo + k * step).toPrecision(12))
  )
  return { lo: ticks[0], hi: ticks[DIVISIONS], ticks }
}

export const normalize = (values: readonly number[], domain: Domain) =>
  values.map((v) => (v - domain.lo) / (domain.hi - domain.lo))

const fullNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 })
const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export const formatNumber = (v: number) => fullNumber.format(v)
export const formatCompact = (v: number) => compactNumber.format(v)

/** Tracks an element's content box. */
export function useElementSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = React.useState({ width: 0, height: 0 })

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])

  return size
}
