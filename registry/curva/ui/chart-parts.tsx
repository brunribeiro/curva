"use client"

import * as React from "react"
import { AnimatePresence, motion, type MotionStyle } from "motion/react"

import { cn } from "@/lib/utils"
import { formatChange, useCount, type Frame, type Rising } from "@/registry/curva/lib/curva"

/** Pieces every Curva chart shares: grid, axes, tooltip and the accessible description. */

export function ChartGrid({ frame, lines }: { frame: Frame; lines: number }) {
  return (
    <g>
      {Array.from({ length: lines }, (_, k) => {
        const y = frame.top + (1 - k / (lines - 1)) * frame.h
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
    </g>
  )
}

/** Labels keep their place on the gridlines and count to new values. */
export function YAxis({
  ticks,
  frame,
  format,
  side = "left",
}: {
  ticks: readonly number[]
  frame: Frame
  format: (value: number) => string
  /** A second scale reads on the right. */
  side?: "left" | "right"
}) {
  return (
    <g>
      {ticks.map((t, k) => (
        <TickLabel
          key={k}
          value={t}
          x={side === "left" ? frame.left - 10 : frame.right + 10}
          y={frame.top + (1 - k / (ticks.length - 1)) * frame.h}
          anchor={side === "left" ? "end" : "start"}
          format={format}
        />
      ))}
    </g>
  )
}

function TickLabel({
  value,
  x,
  y,
  anchor,
  format,
}: {
  value: number
  x: number
  y: number
  anchor: "start" | "end"
  format: (value: number) => string
}) {
  const text = useCount(value, format)
  return (
    <motion.text
      x={x}
      y={y}
      dy="0.32em"
      textAnchor={anchor}
      className="fill-muted-foreground text-[11px] tabular-nums"
    >
      {text}
    </motion.text>
  )
}

/** A new set of labels crossfades in; the active one lights up. */
export function XAxis({
  labels,
  xOf,
  y,
  step,
  activeIndex,
  alignStart = false,
}: {
  labels: readonly string[]
  xOf: (index: number) => number
  y: number
  step: number
  activeIndex: number | null
  alignStart?: boolean
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.g
        key={labels.join("|")}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {labels.map((text, k) =>
          k % step === 0 ? (
            <text
              key={k}
              x={xOf(k)}
              y={y}
              textAnchor={k === 0 && alignStart ? "start" : "middle"}
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
  )
}

export type TooltipRow = {
  key: string
  label: string
  value: number
  color?: string
  /** Formats this row when its unit differs from the others. */
  format?: (value: number) => string
}

export function ChartTooltip({
  ref,
  title,
  rows,
  active,
  fresh,
  format,
  footer,
  style,
}: {
  ref?: React.Ref<HTMLDivElement>
  title: string
  rows: readonly TooltipRow[]
  active: boolean
  fresh: boolean
  format: (value: number) => string
  /** Anything after the rows, such as a change or a note. */
  footer?: React.ReactNode
  style?: MotionStyle
}) {
  return (
    <motion.div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10 rounded-lg border bg-popover px-2.5 py-1.5 whitespace-nowrap text-popover-foreground shadow-lg shadow-black/5"
      style={style}
      initial={false}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.94 }}
      transition={{ duration: 0.16 }}
    >
      <div className="mb-0.5 text-[11px] text-muted-foreground">{title}</div>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-1.5 text-sm tabular-nums">
          <span
            className={cn("size-2 rounded-full", !row.color && "invisible")}
            style={{ background: row.color }}
          />
          <span className="text-muted-foreground">{row.label}</span>
          <Count
            value={row.value}
            format={row.format ?? format}
            instant={fresh}
            className="ml-auto pl-4 font-medium"
          />
        </div>
      ))}
      {footer}
    </motion.div>
  )
}

/** A change as a colored pill: green when it's good news, red when it's bad. */
export function ChangeBadge({
  change,
  rising = "good",
  text,
  className,
}: {
  change: number | null
  rising?: Rising
  /** Replaces the default signed percent. */
  text?: string
  className?: string
}) {
  if (change === null || !Number.isFinite(change)) return null
  const good = rising === "neutral" || change === 0 ? null : change > 0 === (rising === "good")
  return (
    <span
      className={cn(
        "inline-block rounded-full px-1.5 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap tabular-nums",
        good === null
          ? "bg-muted text-muted-foreground"
          : good
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
        className
      )}
    >
      {text ?? formatChange(change)}
    </span>
  )
}

export function Count({
  value,
  format,
  instant = false,
  className,
}: {
  value: number
  format: (value: number) => string
  instant?: boolean
  className?: string
}) {
  const text = useCount(value, format, instant)
  return <motion.span className={className}>{text}</motion.span>
}

export type LegendRow = {
  key: string
  label: string
  color: string
  value: number
  format: (value: number) => string
  /** A share or progress in percent, shown after the value. */
  percent?: number
}

/** Rows that follow the chart: pointing at one activates its point, and the highlight glides. */
export function ChartLegend({
  rows,
  activeIndex,
  onSelect,
}: {
  rows: readonly LegendRow[]
  activeIndex: number | null
  onSelect: (index: number | null) => void
}) {
  const id = React.useId()
  return (
    <ul aria-hidden className="w-full min-w-0 flex-1 text-sm">
      {rows.map((row, k) => (
        <li
          key={row.key}
          onPointerEnter={() => onSelect(k)}
          onPointerLeave={() => onSelect(null)}
          className="relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
        >
          <AnimatePresence>
            {activeIndex === k && (
              <motion.span
                layoutId={`${id}-row`}
                className="absolute inset-0 rounded-md bg-muted"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
          </AnimatePresence>
          <span className="relative size-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
          <span className="relative min-w-0 flex-1 truncate text-muted-foreground">{row.label}</span>
          <Count value={row.value} format={row.format} className="relative font-medium tabular-nums" />
          {row.percent !== undefined && (
            <Count
              value={row.percent}
              format={(v) => `${Math.round(v)}%`}
              className="relative w-10 text-right text-muted-foreground tabular-nums"
            />
          )}
        </li>
      ))}
    </ul>
  )
}

/** The number in the middle of a donut or radial chart. */
export function ChartCenter({
  title,
  value,
  format,
  detail,
  instant = false,
}: {
  title: string
  value: number
  format: (value: number) => string
  /** A second, quieter line such as a share; hidden when undefined. */
  detail?: { value: number; format: (value: number) => string }
  instant?: boolean
}) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
      <div className="max-w-[60%]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="truncate text-xs text-muted-foreground"
          >
            {title}
          </motion.p>
        </AnimatePresence>
        <Count
          value={value}
          format={format}
          instant={instant}
          className="block text-xl font-semibold tracking-tight tabular-nums @[15rem]:text-2xl"
        />
        <motion.p
          initial={false}
          animate={{ opacity: detail ? 1 : 0 }}
          transition={{ duration: 0.18 }}
          className="text-xs text-muted-foreground tabular-nums"
        >
          <Count value={detail?.value ?? 0} format={detail?.format ?? String} instant={instant} />
        </motion.p>
      </div>
    </div>
  )
}

/** Announces the active point and carries the full dataset as a table. */
export function ChartDescription({
  label,
  columns,
  rows,
  live,
}: {
  label: string
  columns: readonly string[]
  rows: readonly { label: string; values: readonly string[] }[]
  live: string
}) {
  return (
    <>
      <div aria-live="polite" className="sr-only">
        {live}
      </div>
      {/* Tables ignore sr-only's 1px width, so a wrapper hides it without overflow. */}
      <div className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <td />
              {columns.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, k) => (
              <tr key={k}>
                <th scope="row">{row.label}</th>
                {row.values.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
