"use client"

import * as React from "react"
import { area as d3Area, curveMonotoneX, line as d3Line } from "d3-shape"
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react"

import { cn } from "@/lib/utils"
import {
  SAMPLES,
  clamp,
  flat,
  formatCompact,
  formatNumber,
  niceDomain,
  normalize,
  sampleAt,
  sampleMonotone,
  useElementSize,
  waveFrame,
} from "@/registry/curva/lib/curva"

type Datum = Record<string, unknown>

export type AreaChartProps<T extends Datum> = {
  data: readonly T[]
  /** Key of the label for each point (x). */
  index: keyof T & string
  /** Key of the numeric value for each point (y). */
  value: keyof T & string
  /** Accessible name of the chart, also the series name in the tooltip. */
  label: string
  /** Any CSS color. Defaults to the theme's first chart color. */
  color?: string
  /** Formats values in the tooltip and for screen readers. */
  formatValue?: (value: number) => string
  /** Formats the y-axis labels. */
  formatAxis?: (value: number) => string
  showXAxis?: boolean
  showYAxis?: boolean
  showGrid?: boolean
  className?: string
  /** Called when the visitor points at, taps or arrows to a point. */
  onActiveChange?: (point: T | null, index: number | null) => void
}

const PAD = { top: 12, side: 8, axis: 44, labels: 28 }

/** How the active dot rides the curve between points. */
const GLIDE = { stiffness: 380, damping: 36, mass: 0.7 }
/** How labels count to new values. */
const COUNT = { stiffness: 120, damping: 24 }

const ENTRANCE = { duration: 1.25, stagger: 0.5 }
const MORPH = { duration: 0.9, stagger: 0.24 }

function frameOf(width: number, height: number, xAxis: boolean, yAxis: boolean) {
  const left = yAxis ? PAD.axis : PAD.side
  const right = width - PAD.side
  const top = PAD.top
  const bottom = height - (xAxis ? PAD.labels : PAD.side)
  return { left, right, top, bottom, w: Math.max(0, right - left), h: Math.max(0, bottom - top) }
}

export function AreaChart<T extends Datum>({
  data,
  index,
  value,
  label,
  color = "var(--chart-1)",
  formatValue = formatNumber,
  formatAxis = formatCompact,
  showXAxis = true,
  showYAxis = true,
  showGrid = true,
  className,
  onActiveChange,
}: AreaChartProps<T>) {
  const id = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const tipRef = React.useRef<HTMLDivElement>(null)
  const size = useElementSize(rootRef)
  const inView = useInView(rootRef, { once: true, amount: 0.4 })
  const reduced = useReducedMotion() ?? false

  const values = React.useMemo(() => data.map((d) => Number(d[value]) || 0), [data, value])
  const labels = React.useMemo(() => data.map((d) => String(d[index])), [data, index])
  const domain = React.useMemo(() => niceDomain(values), [values])
  const target = React.useMemo(
    () => sampleMonotone(normalize(values, domain), SAMPLES),
    [values, domain]
  )
  const baseline = -domain.lo / (domain.hi - domain.lo)

  const n = values.length
  const frame = frameOf(size.width, size.height, showXAxis, showYAxis)
  const uOf = (k: number) => (n <= 1 ? 0 : k / (n - 1))
  const xOf = (k: number) => frame.left + uOf(k) * frame.w

  const [active, setActive] = React.useState<number | null>(null)
  const [last, setLast] = React.useState(0)
  const activeIndex = active === null ? null : Math.min(active, n - 1)
  const shownIndex = Math.min(last, Math.max(0, n - 1))

  // Everything that moves is a motion value painted outside React renders.
  const progress = useMotionValue(0)
  const glide = useSpring(0, GLIDE)
  const reveal = useSpring(1, GLIDE)
  const tipValue = useSpring(0, COUNT)
  const tipText = useTransform(tipValue, (v) => formatValue(v))
  const lineD = useMotionValue("")
  const areaD = useMotionValue("")
  const dotX = useMotionValue(0)
  const dotY = useMotionValue(0)
  const revealX = useMotionValue(0)
  const tipX = useMotionValue(0)
  const tipY = useMotionValue(0)

  const shape = React.useRef({
    from: flat(0),
    to: flat(0),
    out: flat(0),
    baseline: 0,
    stagger: ENTRANCE.stagger,
    entered: false,
  })
  const geometry = React.useRef({ frame, width: 0 })
  const generators = React.useMemo(
    () => ({
      line: d3Line<number>().curve(curveMonotoneX),
      area: d3Area<number>().curve(curveMonotoneX),
    }),
    []
  )

  const paint = React.useCallback(() => {
    const { frame: f, width } = geometry.current
    if (f.w <= 0) return
    const s = shape.current
    const current = waveFrame(s.from, s.to, progress.get(), s.stagger, s.out)
    const px = (_: number, j: number) => f.left + (j / (SAMPLES - 1)) * f.w
    const py = (v: number) => f.top + (1 - Math.max(v, 0)) * f.h
    const base = py(clamp(s.baseline, 0, 1))

    lineD.set(generators.line.x(px).y(py)(current) ?? "")
    areaD.set(generators.area.x(px).y0(base).y1(py)(current) ?? "")

    const u = glide.get()
    const x = f.left + u * f.w
    const y = py(sampleAt(current, u))
    dotX.set(x)
    dotY.set(y)

    const r = reveal.get()
    revealX.set(r >= 0.999 ? width : f.left + r * f.w)

    const tip = tipRef.current
    if (tip) {
      const w = tip.offsetWidth
      const h = tip.offsetHeight
      tipX.set(clamp(x - w / 2, 0, Math.max(0, width - w)))
      tipY.set(y - h - 14 < 0 ? y + 14 : y - h - 14)
    }
  }, [areaD, dotX, dotY, generators, glide, lineD, progress, reveal, revealX, tipX, tipY])

  useMotionValueEvent(progress, "change", paint)
  useMotionValueEvent(glide, "change", paint)
  useMotionValueEvent(reveal, "change", paint)

  React.useLayoutEffect(() => {
    geometry.current = {
      frame: frameOf(size.width, size.height, showXAxis, showYAxis),
      width: size.width,
    }
    paint()
  }, [size.width, size.height, showXAxis, showYAxis, paint])

  // New data: morph from whatever is on screen right now, even mid-animation.
  React.useLayoutEffect(() => {
    const s = shape.current
    s.baseline = baseline
    if (!s.entered) {
      s.from = flat(baseline)
      s.to = target
      paint()
      return
    }
    s.from = waveFrame(s.from, s.to, progress.get(), s.stagger)
    s.to = target
    s.stagger = MORPH.stagger
    if (reduced) {
      progress.jump(1)
      paint()
      return
    }
    progress.jump(0)
    const controls = animate(progress, 1, { duration: MORPH.duration, ease: "linear" })
    return () => controls.stop()
  }, [target, baseline, reduced, paint, progress])

  // The one orchestrated moment: the curve rises from the baseline in a wave.
  React.useEffect(() => {
    const s = shape.current
    if (!inView || size.width === 0 || s.entered) return
    s.entered = true
    s.stagger = ENTRANCE.stagger
    if (reduced) {
      progress.jump(1)
      paint()
      return
    }
    progress.jump(0)
    animate(progress, 1, { duration: ENTRANCE.duration, ease: "linear", delay: 0.1 })
  }, [inView, size.width, reduced, paint, progress])

  // Follow the active point: the dot glides along the curve, the tooltip counts.
  const previous = React.useRef<number | null>(null)
  React.useEffect(() => {
    const entering = previous.current === null
    previous.current = activeIndex
    if (activeIndex === null) {
      if (reduced) reveal.jump(1)
      else reveal.set(1)
      return
    }
    const u = n <= 1 ? 0 : activeIndex / (n - 1)
    const v = values[activeIndex]
    if (entering || reduced) {
      glide.jump(u)
      tipValue.jump(v)
    } else {
      glide.set(u)
      tipValue.set(v)
    }
    if (reduced) reveal.jump(u)
    else reveal.set(u)
  }, [activeIndex, n, values, reduced, glide, reveal, tipValue])

  const select = (k: number | null) => {
    if (k === activeIndex) return
    setActive(k)
    if (k !== null) setLast(k)
    onActiveChange?.(k === null ? null : data[k], k)
  }

  const indexAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect || frame.w <= 0) return 0
    return Math.round(clamp((clientX - rect.left - frame.left) / frame.w, 0, 1) * (n - 1))
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return
    let k = activeIndex
    switch (e.key) {
      case "ArrowRight":
        k = k === null ? 0 : Math.min(k + 1, n - 1)
        break
      case "ArrowLeft":
        k = k === null ? n - 1 : Math.max(k - 1, 0)
        break
      case "Home":
        k = 0
        break
      case "End":
        k = n - 1
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

  const labelStep = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(frame.w / 56))))
  const isActive = activeIndex !== null
  const ticks = domain.ticks.map((t) => (inView ? t : 0))

  return (
    <div
      ref={rootRef}
      role="group"
      aria-roledescription="chart"
      aria-label={label}
      tabIndex={0}
      onPointerMove={(e) => n > 0 && select(indexAt(e.clientX))}
      onPointerDown={(e) => n > 0 && select(indexAt(e.clientX))}
      onPointerLeave={() => select(null)}
      onKeyDown={onKeyDown}
      onBlur={() => select(null)}
      className={cn(
        "relative h-60 w-full touch-pan-y rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      {size.width > 0 && (
        <svg
          width={size.width}
          height={size.height}
          className="absolute inset-0 overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
            <clipPath id={`${id}-reveal`}>
              <motion.rect x={0} y={-PAD.top} height={size.height + PAD.top} width={revealX} />
            </clipPath>
          </defs>

          {showGrid &&
            ticks.map((_, k) => {
              const y = frame.top + (1 - k / (ticks.length - 1)) * frame.h
              return (
                <line
                  key={k}
                  x1={frame.left}
                  x2={frame.right}
                  y1={y}
                  y2={y}
                  className="stroke-border"
                  strokeDasharray={k === 0 ? undefined : "2 4"}
                />
              )
            })}

          {showYAxis &&
            ticks.map((t, k) => (
              <TickLabel
                key={k}
                value={t}
                x={frame.left - 10}
                y={frame.top + (1 - k / (ticks.length - 1)) * frame.h}
                format={formatAxis}
                reduced={reduced}
              />
            ))}

          {/* Resting layer: what lies right of the active point stays quiet. */}
          <g opacity={0.32}>
            <motion.path d={areaD} fill={`url(#${id}-fill)`} />
            <motion.path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
          </g>
          <g clipPath={`url(#${id}-reveal)`}>
            <motion.path d={areaD} fill={`url(#${id}-fill)`} />
            <motion.path d={lineD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" />
          </g>

          {showXAxis && (
            <AnimatePresence initial={false}>
              <motion.g
                key={labels.join("|")}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {labels.map((text, k) =>
                  k % labelStep === 0 ? (
                    <text
                      key={k}
                      x={xOf(k)}
                      y={size.height - 8}
                      textAnchor={k === 0 && !showYAxis ? "start" : "middle"}
                      className={cn(
                        "fill-muted-foreground text-[11px] transition-[fill] duration-150",
                        k === activeIndex && "fill-foreground"
                      )}
                    >
                      {text}
                    </text>
                  ) : null
                )}
              </motion.g>
            </AnimatePresence>
          )}

          <motion.g
            initial={false}
            animate={{ opacity: isActive ? 1 : 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.line
              x1={dotX}
              x2={dotX}
              y1={frame.top}
              y2={frame.bottom}
              className="stroke-muted-foreground/40"
              strokeDasharray="3 4"
            />
            <motion.g style={{ x: dotX, y: dotY }}>
              <motion.circle
                r={11}
                fill={color}
                initial={false}
                animate={{ scale: isActive ? 1 : 0.3, opacity: isActive ? 0.18 : 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
              />
              <circle r={4.5} className="fill-background" stroke={color} strokeWidth={2.5} />
            </motion.g>
          </motion.g>
        </svg>
      )}

      <motion.div
        ref={tipRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-10 rounded-lg border bg-popover px-2.5 py-1.5 whitespace-nowrap text-popover-foreground shadow-lg shadow-black/5"
        style={{ x: tipX, y: tipY }}
        initial={false}
        animate={{ opacity: isActive ? 1 : 0, scale: isActive ? 1 : 0.94 }}
        transition={{ duration: 0.16 }}
      >
        <div className="text-[11px] text-muted-foreground">{labels[shownIndex]}</div>
        <div className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
          <span className="size-2 rounded-full" style={{ background: color }} />
          <span className="text-muted-foreground">{label}</span>
          <motion.span className="ml-2">{tipText}</motion.span>
        </div>
      </motion.div>

      <div aria-live="polite" className="sr-only">
        {activeIndex !== null ? `${labels[activeIndex]}: ${formatValue(values[activeIndex])}` : ""}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {labels.map((text, k) => (
            <tr key={k}>
              <th scope="row">{text}</th>
              <td>{formatValue(values[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TickLabel({
  value,
  x,
  y,
  format,
  reduced,
}: {
  value: number
  x: number
  y: number
  format: (value: number) => string
  reduced: boolean
}) {
  const count = useSpring(value, COUNT)
  React.useEffect(() => {
    if (reduced) count.jump(value)
    else count.set(value)
  }, [count, value, reduced])
  return <CountText value={count} format={format} x={x} y={y} />
}

function CountText({
  value,
  format,
  x,
  y,
}: {
  value: MotionValue<number>
  format: (value: number) => string
  x: number
  y: number
}) {
  const text = useTransform(value, (v) => format(v))
  return (
    <motion.text
      x={x}
      y={y}
      dy="0.32em"
      textAnchor="end"
      className="fill-muted-foreground text-[11px] tabular-nums"
    >
      {text}
    </motion.text>
  )
}
