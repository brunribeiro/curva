"use client"

import * as React from "react"

import { channels, orders, type ChannelPoint, type OrdersPoint, type Range } from "@/lib/demo-data"
import { cn } from "@/lib/utils"
import { BarChart, type BarSeries } from "@/registry/curva/ui/bar-chart"
import { Card, Segmented, Ticker, formatCurrency, formatInteger, rangeOptions } from "./controls"

export function OrdersCard() {
  const [range, setRange] = React.useState<Range>("week")
  const [hovered, setHovered] = React.useState<OrdersPoint | null>(null)
  const { data, period } = orders[range]
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.orders, 0), [data])

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {hovered ? `Orders on ${hovered.label}` : `Orders this ${period}`}
          </p>
          <Ticker
            value={hovered ? hovered.orders : total}
            format={formatInteger}
            className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums"
          />
        </div>
        <Segmented label="Range" options={rangeOptions} value={range} onChange={setRange} />
      </div>

      <BarChart
        data={data}
        index="label"
        series={[{ key: "orders", label: "Orders", color: "var(--chart-1)" }]}
        label="Orders"
        formatValue={formatInteger}
        onActiveChange={setHovered}
        className="mt-6 h-60"
      />
    </Card>
  )
}

const channelSeries: BarSeries<ChannelPoint>[] = [
  { key: "online", label: "Online store", color: "var(--chart-1)" },
  { key: "marketplace", label: "Marketplace", color: "var(--chart-2)" },
  { key: "inPerson", label: "In person", color: "var(--chart-3)" },
]

export function ChannelsCard() {
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set())
  const [hovered, setHovered] = React.useState<ChannelPoint | null>(null)
  const series = channelSeries.filter((s) => !hidden.has(s.key))
  const sumOf = (d: ChannelPoint) => series.reduce((sum, s) => sum + Number(d[s.key]), 0)
  const total = channels.reduce((sum, d) => sum + sumOf(d), 0)

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else if (next.size < channelSeries.length - 1) next.add(key)
      return next
    })

  return (
    <Card>
      <div>
        <p className="text-sm text-muted-foreground">
          {hovered ? `Revenue in ${hovered.label}` : "Revenue by channel, May to Oct"}
        </p>
        <Ticker
          value={hovered ? sumOf(hovered) : total}
          format={formatCurrency}
          className="mt-1 block text-3xl font-semibold tracking-tight tabular-nums"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Channels">
        {channelSeries.map((s) => {
          const on = !hidden.has(s.key)
          return (
            <button
              key={s.key}
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-full border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50",
                on ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn("size-2 rounded-full transition-opacity", !on && "opacity-30")}
                style={{ background: s.color }}
              />
              {s.label}
            </button>
          )
        })}
      </div>

      <BarChart
        data={channels}
        index="label"
        series={series}
        stacked
        label="Revenue by channel"
        formatValue={formatCurrency}
        onActiveChange={setHovered}
        className="mt-4 h-60"
      />
    </Card>
  )
}
