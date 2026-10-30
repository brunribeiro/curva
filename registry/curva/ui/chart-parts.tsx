"use client"

import * as React from "react"
import { AnimatePresence, motion, type MotionStyle } from "motion/react"

import { cn } from "@/lib/utils"
import { useCount, type Frame } from "@/registry/curva/lib/curva"

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
}: {
  ticks: readonly number[]
  frame: Frame
  format: (value: number) => string
}) {
  return (
    <g>
      {ticks.map((t, k) => (
        <TickLabel
          key={k}
          value={t}
          x={frame.left - 10}
          y={frame.top + (1 - k / (ticks.length - 1)) * frame.h}
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
  format,
}: {
  value: number
  x: number
  y: number
  format: (value: number) => string
}) {
  const text = useCount(value, format)
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
}

export function ChartTooltip({
  ref,
  title,
  rows,
  active,
  fresh,
  format,
  style,
}: {
  ref?: React.Ref<HTMLDivElement>
  title: string
  rows: readonly TooltipRow[]
  active: boolean
  fresh: boolean
  format: (value: number) => string
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
            format={format}
            instant={fresh}
            className="ml-auto pl-4 font-medium"
          />
        </div>
      ))}
    </motion.div>
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
