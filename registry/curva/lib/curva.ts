import * as React from "react"
import {
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "motion/react"

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

const NICE_UNITS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]

function niceStep(raw: number) {
  const power = 10 ** Math.floor(Math.log10(raw))
  const unit = raw / power
  return (NICE_UNITS.find((u) => unit <= u + 1e-9) ?? 10) * power
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
export const formatPercent = (v: number) => `${Math.round(v)}%`

/** Default series colors, cycling through the theme's five chart colors. */
export const seriesColor = (i: number) => `var(--chart-${(i % 5) + 1})`

export const PAD = { top: 12, side: 8, axis: 44, labels: 28 }

export type Frame = {
  left: number
  right: number
  top: number
  bottom: number
  w: number
  h: number
}

/** The plot area inside a chart of the given size. */
export function frameOf(width: number, height: number, xAxis: boolean, yAxis: boolean): Frame {
  const left = yAxis ? PAD.axis : PAD.side
  const right = width - PAD.side
  const top = PAD.top
  const bottom = height - (xAxis ? PAD.labels : PAD.side)
  return { left, right, top, bottom, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

/** Shows every nth x label so they never collide. */
export const labelStep = (count: number, width: number, room = 56) =>
  Math.max(1, Math.ceil(count / Math.max(2, Math.floor(width / room))))

/** How labels count to new values. */
export const COUNT = { stiffness: 120, damping: 24 }
/** How highlights and tooltips travel between points. */
export const SLIDE = { stiffness: 420, damping: 40 }

/** A spring that follows `target`, or jumps there when `instant` or reduced motion. */
export function useFollow(target: number, instant = false, config = SLIDE): MotionValue<number> {
  const reduced = useReducedMotion() ?? false
  const value = useSpring(target, config)
  React.useEffect(() => {
    if (instant || reduced) value.jump(target)
    else value.set(target)
  }, [value, target, instant, reduced])
  return value
}

/**
 * A formatted number that counts to each new value. The text always uses the
 * latest `format`, even when the format changes while the value stays put.
 */
export function useCount(value: number, format: (v: number) => string, instant = false) {
  const spring = useFollow(value, instant, COUNT)
  const text = useMotionValue(format(value))
  useMotionValueEvent(spring, "change", (v) => text.set(format(v)))
  React.useEffect(() => {
    text.set(format(spring.get()))
  }, [format, spring, text])
  return text
}

/**
 * The point the visitor is on, from pointer, touch or keyboard. `fresh` is
 * true when they have just arrived, so highlights appear in place instead of
 * travelling from wherever they last were.
 */
export function useActivePoint(count: number, onChange?: (index: number | null) => void) {
  const [active, setActive] = React.useState<number | null>(null)
  const [last, setLast] = React.useState(0)
  const [fresh, setFresh] = React.useState(true)
  const activeIndex = active === null || count === 0 ? null : Math.min(active, count - 1)
  const shownIndex = Math.min(last, Math.max(0, count - 1))

  const select = (k: number | null) => {
    if (k === activeIndex) return
    setFresh(activeIndex === null)
    setActive(k)
    if (k !== null) setLast(k)
    onChange?.(k)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count === 0) return
    let k = activeIndex
    switch (e.key) {
      case "ArrowRight":
        k = k === null ? 0 : Math.min(k + 1, count - 1)
        break
      case "ArrowLeft":
        k = k === null ? count - 1 : Math.max(k - 1, 0)
        break
      case "Home":
        k = 0
        break
      case "End":
        k = count - 1
        break
      case "Escape":
        k = null
        break
      default:
        return
    }
    e.preventDefault()
    select(k)
  }

  return { activeIndex, shownIndex, fresh, select, onKeyDown }
}

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
