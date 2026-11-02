"use client"

import * as React from "react"

import { funnels, kpis, scores, sources, type GoalMonth, type Kpi, type KpiRange } from "@/lib/demo-data"
import { cn } from "@/lib/utils"
import { FunnelChart } from "@/registry/curva/ui/funnel-chart"
import { RadarChart } from "@/registry/curva/ui/radar-chart"
import { Sparkline } from "@/registry/curva/ui/sparkline"
import { WaffleChart } from "@/registry/curva/ui/waffle-chart"
import { Card, Segmented, Ticker, formatCurrency, formatInteger } from "./controls"

const ticket = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const formatOf = (kind: Kpi["kind"]) =>
  kind === "currency" ? formatCurrency : kind === "ticket" ? (v: number) => ticket.format(v) : formatInteger

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})

function Header({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
      {children}
    </div>
  )
}

const ranges = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
] as const

export function KpiRow() {
  const [range, setRange] = React.useState<KpiRange>("30d")
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Segmented label="Period" options={ranges} value={range} onChange={setRange} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} range={range} />
        ))}
      </div>
    </div>
  )
}

function KpiCard({ kpi, range }: { kpi: Kpi; range: KpiRange }) {
  const [hovered, setHovered] = React.useState<{ day: string; value: number } | null>(null)
  const data = kpi.series[range]
  const format = formatOf(kpi.kind)
  const sum = data.reduce((a, d) => a + d.value, 0)
  const headline = kpi.rollup === "sum" ? sum : sum / Math.max(1, data.length)
  const half = Math.floor(data.length / 2)
  const avg = (points: typeof data) => points.reduce((a, d) => a + d.value, 0) / Math.max(1, points.length)
  const change = avg(data.slice(half)) / Math.max(1e-9, avg(data.slice(0, half))) - 1

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{kpi.label}</p>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
            change >= 0
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
          )}
        >
          {percent.format(change)}
        </span>
      </div>
      <Ticker
        value={hovered ? hovered.value : headline}
        format={format}
        className="mt-1 block text-2xl font-semibold tracking-tight tabular-nums"
      />
      <p className="mt-0.5 h-4 text-xs text-muted-foreground">
        {hovered ? hovered.day : kpi.rollup === "sum" ? "Total for the period" : "Daily average"}
      </p>
      <Sparkline
        data={data}
        index="day"
        value="value"
        label={kpi.label}
        color={kpi.color}
        variant={kpi.variant}
        formatValue={format}
        onActiveChange={setHovered}
        className="mt-3 h-14"
      />
    </Card>
  )
}

export function ScoreCard() {
  const [period, setPeriod] = React.useState<"now" | "before">("now")
  return (
    <Card>
      <Header title="Location scorecard" text="Two kitchens, six things guests rate">
        <Segmented
          label="Period"
          options={[
            { value: "before", label: "Last month" },
            { value: "now", label: "This month" },
          ]}
          value={period}
          onChange={setPeriod}
        />
      </Header>
      <RadarChart
        data={scores[period]}
        index="axis"
        series={[
          { key: "downtown", label: "Downtown", color: "var(--chart-1)" },
          { key: "riverside", label: "Riverside", color: "var(--chart-4)" },
        ]}
        max={100}
        label="Location scorecard"
        formatValue={formatInteger}
        className="mt-6"
      />
    </Card>
  )
}

export function SourcesCard() {
  const [month, setMonth] = React.useState<GoalMonth>("sep")
  return (
    <Card>
      <Header title="Where orders come from" text="Each square is one percent">
        <Segmented
          label="Month"
          options={[
            { value: "sep", label: "Sep" },
            { value: "oct", label: "Oct" },
          ]}
          value={month}
          onChange={setMonth}
        />
      </Header>
      <WaffleChart
        data={sources[month]}
        index="source"
        value="orders"
        color="color"
        label="Orders by source"
        formatValue={formatInteger}
        className="mt-6"
      />
    </Card>
  )
}

export function FunnelCard() {
  const [platform, setPlatform] = React.useState<"web" | "app">("web")
  return (
    <Card>
      <Header title="Online ordering" text="From the menu to a paid order; point at a stage to see who dropped">
        <Segmented
          label="Platform"
          options={[
            { value: "web", label: "Web" },
            { value: "app", label: "App" },
          ]}
          value={platform}
          onChange={setPlatform}
        />
      </Header>
      <FunnelChart
        data={funnels[platform]}
        index="stage"
        value="people"
        label="Ordering funnel"
        formatValue={formatInteger}
        className="mt-6"
      />
    </Card>
  )
}
