"use client"

import * as React from "react"

import {
  busyDays,
  pageLoads,
  storeHistory,
  storeWeeks,
  topItems,
  trend,
  trendMarkers,
} from "@/lib/demo-data"
import { changeOf } from "@/registry/curva/lib/curva"
import { AreaChart } from "@/registry/curva/ui/area-chart"
import { BarList } from "@/registry/curva/ui/bar-list"
import { ChangeBadge } from "@/registry/curva/ui/chart-parts"
import { ComboChart } from "@/registry/curva/ui/combo-chart"
import { DumbbellChart } from "@/registry/curva/ui/dumbbell-chart"
import { PercentileChart } from "@/registry/curva/ui/percentile-chart"
import { StatusTimeline } from "@/registry/curva/ui/status-timeline"
import { Card, Segmented, Ticker, formatCurrency, formatInteger } from "./controls"

const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const formatCents = (v: number) => cents.format(v)
const formatMinutes = (v: number) => `${Math.round(v)}m`
const formatSeconds = (v: number) => `${v.toFixed(1)}s`

function Header({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
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

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-lg font-semibold tracking-tight tabular-nums">{children}</div>
    </div>
  )
}

export function TrendCard() {
  const [metric, setMetric] = React.useState<"revenue" | "orders">("revenue")
  const revenue = metric === "revenue"
  const format = revenue ? formatCurrency : formatInteger
  const total = trend.reduce((a, d) => a + (revenue ? d.revenue : d.orders), 0)
  const before = trend.reduce((a, d) => a + (revenue ? d.lastRevenue : d.lastOrders), 0)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Last 30 days</p>
          <div className="mt-1 flex items-center gap-2.5">
            <Ticker value={total} format={format} className="text-3xl font-semibold tracking-tight tabular-nums" />
            <ChangeBadge change={changeOf(total, before)} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Against the previous 30 days, with what changed</p>
        </div>
        <Segmented
          label="Metric"
          options={[
            { value: "revenue", label: "Revenue" },
            { value: "orders", label: "Orders" },
          ]}
          value={metric}
          onChange={setMetric}
        />
      </div>
      <AreaChart
        data={trend}
        index="day"
        value={revenue ? "revenue" : "orders"}
        previous={revenue ? "lastRevenue" : "lastOrders"}
        label={revenue ? "Revenue" : "Orders"}
        previousLabel="Previous 30 days"
        markers={trendMarkers}
        formatValue={format}
        className="mt-6 h-80"
      />
    </Card>
  )
}

export function BusyDayCard() {
  const [day, setDay] = React.useState<"today" | "yesterday">("today")
  const { slots, bands, now } = busyDays[day]
  const full = slots.filter((s) => s.full).length
  const longest = Math.max(0, ...slots.map((s) => s.wait ?? 0))
  const orders = slots.reduce((a, s) => a + s.orders, 0)

  return (
    <Card>
      <Header title="A day, slot by slot" text="Online orders per pickup slot, slots that filled up, and the ASAP wait">
        <Segmented
          label="Day"
          options={[
            { value: "yesterday", label: "Yesterday" },
            { value: "today", label: "Today" },
          ]}
          value={day}
          onChange={setDay}
        />
      </Header>
      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
        <Figure label="Online orders">
          <Ticker value={orders} format={formatInteger} />
        </Figure>
        <Figure label="Slots full">
          <Ticker value={full} format={formatInteger} />
        </Figure>
        <Figure label="Longest ASAP wait">
          <Ticker value={longest} format={(v) => `${Math.round(v)} min`} />
        </Figure>
      </div>
      <ComboChart
        data={slots}
        index="slot"
        bar={{ key: "orders", label: "Online orders", format: formatInteger }}
        line={{ key: "wait", label: "ASAP wait", color: "var(--chart-4)", format: formatMinutes }}
        flag="full"
        flagLabel="Slot full"
        flagColor="var(--chart-3)"
        now={now}
        bands={bands}
        label="Online orders and ASAP wait by pickup slot"
        className="mt-6 h-80"
      />
    </Card>
  )
}

const storeStates = [
  { value: "open", label: "Taking orders", color: "var(--chart-2)" },
  { value: "short", label: "Paused under 30 min", color: "var(--chart-3)" },
  { value: "long", label: "Paused 30 min or more", color: "var(--chart-4)" },
  { value: "none", label: "Not recorded", color: "var(--muted-foreground)", hatched: true },
]

export function UptimeCard() {
  const [store, setStore] = React.useState<"downtown" | "riverside">("downtown")
  const days = storeHistory[store]
  const open = days.filter((d) => d.state === "open").length
  const recorded = days.filter((d) => d.state !== "none").length

  return (
    <Card>
      <Header title="Taking orders" text="One bar per day, last 30 days">
        <Segmented
          label="Store"
          options={[
            { value: "downtown", label: "Downtown" },
            { value: "riverside", label: "Riverside" },
          ]}
          value={store}
          onChange={setStore}
        />
      </Header>
      <p className="mt-5 text-2xl font-semibold tracking-tight tabular-nums">
        <Ticker value={open} format={formatInteger} />
        <span className="text-base font-normal text-muted-foreground"> of {recorded} days without a pause</span>
      </p>
      <StatusTimeline
        data={days}
        index="day"
        status="state"
        states={storeStates}
        detail={(d) => d.detail}
        label={`Taking orders at ${store === "downtown" ? "Downtown" : "Riverside"}, last 30 days`}
        className="mt-5"
      />
    </Card>
  )
}

export function TopItemsCard() {
  const [week, setWeek] = React.useState<"week" | "last">("week")
  return (
    <Card>
      <Header title="What's selling" text="Items sold and their share">
        <Segmented
          label="Week"
          options={[
            { value: "last", label: "Last week" },
            { value: "week", label: "This week" },
          ]}
          value={week}
          onChange={setWeek}
        />
      </Header>
      <BarList
        data={topItems[week]}
        index="item"
        value="sold"
        label="Items sold"
        formatValue={formatInteger}
        share
        className="mt-5"
      />
    </Card>
  )
}

export function StoresCard() {
  const [metric, setMetric] = React.useState<"average" | "orders">("average")
  const average = metric === "average"
  return (
    <Card>
      <Header title="Stores, week over week" text="Where each store was last week and where it is now">
        <Segmented
          label="Metric"
          options={[
            { value: "average", label: "Average order" },
            { value: "orders", label: "Orders" },
          ]}
          value={metric}
          onChange={setMetric}
        />
      </Header>
      <DumbbellChart
        data={storeWeeks}
        index="store"
        from={average ? "lastAverage" : "lastOrders"}
        to={average ? "average" : "orders"}
        fromLabel="Last week"
        toLabel="This week"
        label={average ? "Average order by store, last week and this week" : "Orders by store, last week and this week"}
        formatValue={average ? formatCents : formatInteger}
        formatAxis={average ? formatCurrency : formatInteger}
        className="mt-4"
      />
    </Card>
  )
}

export function PageLoadCard() {
  const [device, setDevice] = React.useState<"mobile" | "desktop">("mobile")
  return (
    <Card>
      <Header title="Page load" text="Time until the main content shows, judged at the slow end">
        <Segmented
          label="Device"
          options={[
            { value: "mobile", label: "Mobile" },
            { value: "desktop", label: "Desktop" },
          ]}
          value={device}
          onChange={setDevice}
        />
      </Header>
      <PercentileChart
        data={pageLoads[device]}
        index="page"
        percentiles={[
          { key: "p50", label: "Typical" },
          { key: "p75", label: "Slow" },
          { key: "p90", label: "Slowest 10%" },
        ]}
        zones={[
          { upTo: 2.5, label: "Good", tone: "good" },
          { upTo: 4, label: "Needs work", tone: "warn" },
          { label: "Poor", tone: "bad" },
        ]}
        score="p75"
        max={7}
        label={`Page load on ${device}`}
        formatValue={formatSeconds}
        formatAxis={(v) => `${v}s`}
        className="mt-5"
      />
    </Card>
  )
}
