"use client"

import * as React from "react"
import { area as d3Area, curveMonotoneX, line as d3Line } from "d3-shape"
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react"

import { cn } from "@/lib/utils"
import {
  SAMPLES,
  clamp,
  formatNumber,
  sampleAt,
  sampleMonotone,
  useActivePoint,
  useElementSize,
  waveFrame,
} from "@/registry/curva/lib/curva"

type Datum = Record<string, unknown>

export type SparklineProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each point. */
  index: keyof T & string
  /** Key of the numeric value for each point. */
  value: keyof T & string
  /** Accessible name of the sparkline. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  /** A smooth line over a soft fill, or thin bars. */
  variant?: "line" | "bars"
  /** Formats values for screen readers. */
  formatValue?: (value: number) => string
  className?: string
  /**
   * Called as the visitor scrubs across it. Pair it with a headline number so
   * the number follows the pointer.
   */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const PAD = 6
/** How the scrub dot rides the line between points. */
const GLIDE = { stiffness: 420, damping: 38, mass: 0.6 }
const DRAW = { duration: 1.1, ease: [0.22, 1, 0.36, 1] } as const
const MORPH = { duration: 0.8, stagger: 0.22 }
const GROW = { type: "spring", stiffness: 300, damping: 24 } as const

/** Sparklines show shape, not scale: values span the height whatever their range. */
function normalized(values: readonly number[]) {
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return values.map((v) => (hi > lo ? 0.1 + ((v - lo) / (hi - lo)) * 0.8 : 0.5))
}

export function Sparkline<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  variant = "line",
  formatValue = formatNumber,
  className,
  onActiveChange,
}: SparklineProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const inView = useInView(rootRef, { once: true, amount: 0.6 })
  const reduced = useReducedMotion() ?? false

  const [settled, setSettled] = React.useState(false)
  React.useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => setSettled(true), 1200)
    return () => clearTimeout(timer)
  }, [inView])

  const labels = React.useMemo(() => data.map((d) => String(d[index])), [data, index])
  const values = React.useMemo(() => data.map((d) => Number(d[value]) || 0), [data, value])
  const levels = React.useMemo(() => normalized(values), [values])
  const target = React.useMemo(() => sampleMonotone(levels, SAMPLES), [levels])
  const n = data.length

  const { activeIndex, fresh, select } = useActivePoint(n, (k) =>
    onActiveChange?.(k === null ? null : data[k], k)
  )

  const w = Math.max(0, size.width - PAD * 2)
  const h = Math.max(0, size.height - PAD * 2)
  const uOf = (k: number) => (n <= 1 ? 1 : k / (n - 1))

  // The line, painted from motion values outside React renders.
  const progress = useMotionValue(1)
  const glide = useSpring(1, GLIDE)
  const lineD = useMotionValue("")
  const areaD = useMotionValue("")
  const dotX = useMotionValue(0)
  const dotY = useMotionValue(0)
  const shape = React.useRef({ from: target, to: target, out: [...target] })
  const geometry = React.useRef({ w, h })
  const generators = React.useMemo(
    () => ({
      line: d3Line<number>().curve(curveMonotoneX),
      area: d3Area<number>().curve(curveMonotoneX),
    }),
    []
  )

  const paint = React.useCallback(() => {
    const { w: gw, h: gh } = geometry.current
    if (gw <= 0) return
    const s = shape.current
    const current = waveFrame(s.from, s.to, progress.get(), MORPH.stagger, s.out)
    const px = (_: number, j: number) => PAD + (j / (SAMPLES - 1)) * gw
    const py = (v: number) => PAD + (1 - v) * gh
    lineD.set(generators.line.x(px).y(py)(current) ?? "")
    areaD.set(generators.area.x(px).y0(PAD + gh + PAD).y1(py)(current) ?? "")
    const u = glide.get()
    dotX.set(PAD + u * gw)
    dotY.set(py(sampleAt(current, u)))
  }, [areaD, dotX, dotY, generators, glide, lineD, progress])

  useMotionValueEvent(progress, "change", paint)
  useMotionValueEvent(glide, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = { w, h }
    paint()
  }, [w, h, paint])

  React.useLayoutEffect(() => {
    const s = shape.current
    if (!settled || reduced) {
      shape.current = { ...s, from: target, to: target }
      progress.jump(1)
      paint()
      return
    }
    s.from = waveFrame(s.from, s.to, progress.get(), MORPH.stagger)
    s.to = target
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
  }, [target, settled, reduced, paint, progress])

  // The dot rests on the last point and glides to wherever the visitor scrubs.
  React.useEffect(() => {
    const u = activeIndex === null ? 1 : uOf(activeIndex)
    if ((fresh && activeIndex !== null) || reduced) glide.jump(u)
    else glide.set(u)
    // uOf only depends on n.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, fresh, n, reduced, glide])

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || n === 0 || w <= 0) return null
    if (variant === "bars") return clamp(Math.floor(((clientX - rect.left - PAD) / w) * n), 0, n - 1)
    return Math.round(clamp((clientX - rect.left - PAD) / w, 0, 1) * (n - 1))
  }

  const band = n > 0 ? w / n : 0
  const barWidth = Math.max(1.5, band * 0.6)

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={
        n > 0
          ? `${label}: ${formatValue(values[0])} on ${labels[0]}, ${formatValue(values[n - 1])} on ${labels[n - 1]}`
          : label
      }
      onPointerMove={(e) => select(indexAt(e.clientX))}
      onPointerDown={(e) => select(indexAt(e.clientX))}
      onPointerLeave={() => select(null)}
      className={cn("relative h-12 w-full touch-pan-y select-none", className)}
    >
      {size.width > 0 && (
        <svg width={size.width} height={size.height} className="absolute inset-0 overflow-visible" aria-hidden>
          {variant === "line" ? (
            <>
              <defs>
                <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} />
                  <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
                </linearGradient>
                <clipPath id={`${id}-draw`}>
                  <motion.rect
                    x={0}
                    y={-PAD}
                    height={size.height + PAD * 2}
                    initial={{ width: 0 }}
                    animate={{ width: inView ? size.width + PAD : 0 }}
                    transition={reduced ? { duration: 0 } : DRAW}
                  />
                </clipPath>
              </defs>
              <g clipPath={`url(#${id}-draw)`}>
                <motion.path d={areaD} fill={`url(#${id}-fill)`} />
                <motion.path
                  d={lineD}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
              <motion.line
                x1={dotX}
                x2={dotX}
                y1={0}
                y2={size.height}
                className="stroke-muted-foreground/40"
                strokeDasharray="2 3"
                initial={false}
                animate={{ opacity: activeIndex === null ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              />
              <motion.g
                style={{ x: dotX, y: dotY }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: inView ? 1 : 0, scale: inView ? 1 : 0 }}
                transition={
                  reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 22, delay: DRAW.duration * 0.8 }
                }
              >
                <circle r={7} fill={color} opacity={0.18} />
                <circle r={3} className="fill-background" stroke={color} strokeWidth={2} />
              </motion.g>
            </>
          ) : (
            values.map((_, k) => {
              const bh = Math.max(2, levels[k] * h)
              const on = activeIndex === null ? k === n - 1 : activeIndex === k
              return (
                <motion.rect
                  key={k}
                  x={PAD + band * k + (band - barWidth) / 2}
                  width={barWidth}
                  rx={Math.min(1.5, barWidth / 2)}
                  fill={color}
                  initial={{ y: PAD + h, height: 0 }}
                  animate={{
                    y: inView ? PAD + h - bh : PAD + h,
                    height: inView ? bh : 0,
                    opacity: on ? 1 : activeIndex === null ? 0.45 : 0.25,
                  }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { ...GROW, delay: settled ? 0 : k * 0.02, opacity: { duration: 0.15 } }
                  }
                />
              )
            })
          )}
        </svg>
      )}
    </div>
  )
}
