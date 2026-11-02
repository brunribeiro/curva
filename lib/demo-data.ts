export type Range = "week" | "month" | "year"

export type RevenuePoint = { label: string; revenue: number }

const week: RevenuePoint[] = [
  { label: "Mon", revenue: 4210 },
  { label: "Tue", revenue: 5120 },
  { label: "Wed", revenue: 3980 },
  { label: "Thu", revenue: 6240 },
  { label: "Fri", revenue: 5480 },
  { label: "Sat", revenue: 7130 },
  { label: "Sun", revenue: 6580 },
]

const month: RevenuePoint[] = Array.from({ length: 30 }, (_, i) => ({
  label: `Oct ${i + 1}`,
  revenue: Math.round(
    5200 + 1400 * Math.sin(i / 3.1) + 800 * Math.sin(i / 1.3 + 1) + 60 * i
  ),
}))

const year: RevenuePoint[] = [
  118400, 126900, 121300, 139800, 147200, 142600, 158900, 166300, 151800, 172400, 181900,
  196200,
].map((revenue, i) => ({
  label: new Date(2026, i, 1).toLocaleString("en-US", { month: "short" }),
  revenue,
}))

export const revenue: Record<Range, { data: RevenuePoint[]; delta: number; period: string }> = {
  week: { data: week, delta: 12.4, period: "last week" },
  month: { data: month, delta: 8.1, period: "last month" },
  year: { data: year, delta: 23.7, period: "last year" },
}

export type OrdersPoint = { label: string; orders: number }

const ordersWeek = [182, 214, 168, 251, 236, 298, 274].map((orders, i) => ({
  label: week[i].label,
  orders,
}))

const ordersMonth = month.map((d, i) => ({
  label: d.label,
  orders: Math.round(210 + 50 * Math.sin(i / 2.3) + 30 * Math.sin(i / 1.1 + 2) + 2 * i),
}))

const ordersYear = [5480, 5920, 5610, 6340, 6890, 6620, 7310, 7720, 7050, 7980, 8410, 9120].map(
  (orders, i) => ({ label: year[i].label, orders })
)

export const orders: Record<Range, { data: OrdersPoint[]; period: string }> = {
  week: { data: ordersWeek, period: "week" },
  month: { data: ordersMonth, period: "month" },
  year: { data: ordersYear, period: "year" },
}

export type ChannelPoint = { label: string; online: number; marketplace: number; inPerson: number }

export const channels: ChannelPoint[] = [
  { label: "May", online: 42800, marketplace: 18400, inPerson: 12600 },
  { label: "Jun", online: 46100, marketplace: 21200, inPerson: 11800 },
  { label: "Jul", online: 44900, marketplace: 19800, inPerson: 13900 },
  { label: "Aug", online: 51200, marketplace: 23600, inPerson: 12400 },
  { label: "Sep", online: 55800, marketplace: 24900, inPerson: 14800 },
  { label: "Oct", online: 61300, marketplace: 28100, inPerson: 15200 },
]

export type CategoryPoint = { category: string; revenue: number; color: string }

const categoryColor: Record<string, string> = {
  Apparel: "var(--chart-1)",
  Electronics: "var(--chart-2)",
  Home: "var(--chart-3)",
  Beauty: "var(--chart-4)",
  Outdoor: "var(--chart-5)",
}

const categoryRows = (rows: [string, number][]): CategoryPoint[] =>
  rows.map(([category, revenue]) => ({ category, revenue, color: categoryColor[category] }))

export const categories: Record<Range, CategoryPoint[]> = {
  week: categoryRows([
    ["Apparel", 12400],
    ["Electronics", 9800],
    ["Home", 6200],
    ["Beauty", 4100],
  ]),
  month: categoryRows([
    ["Apparel", 48200],
    ["Electronics", 51600],
    ["Home", 27400],
    ["Beauty", 18900],
  ]),
  year: categoryRows([
    ["Apparel", 612000],
    ["Electronics", 548000],
    ["Home", 331000],
    ["Beauty", 214000],
    ["Outdoor", 126000],
  ]),
}

export type GoalPoint = {
  goal: string
  value: number
  target: number
  unit: "currency" | "count"
  color: string
}

export type GoalMonth = "sep" | "oct"

export const goals: Record<GoalMonth, GoalPoint[]> = {
  sep: [
    { goal: "Revenue", value: 198000, target: 250000, unit: "currency", color: "var(--chart-1)" },
    { goal: "Orders", value: 6850, target: 9000, unit: "count", color: "var(--chart-2)" },
    { goal: "New customers", value: 342, target: 400, unit: "count", color: "var(--chart-4)" },
  ],
  oct: [
    { goal: "Revenue", value: 236000, target: 250000, unit: "currency", color: "var(--chart-1)" },
    { goal: "Orders", value: 8120, target: 9000, unit: "count", color: "var(--chart-2)" },
    { goal: "New customers", value: 368, target: 400, unit: "count", color: "var(--chart-4)" },
  ],
}

export const budget: Record<GoalMonth, { spent: number; limit: number; plan: number }> = {
  sep: { spent: 8240, limit: 12000, plan: 9600 },
  oct: { spent: 10860, limit: 12000, plan: 9600 },
}

export type HourPoint = { hour: string; orders: number }

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`

const weekdayHours = [
  4, 2, 1, 1, 0, 2, 9, 22, 31, 26, 34, 58, 96, 88, 47, 33, 41, 72, 104, 97, 71, 44, 23, 11,
]
const weekendHours = [
  14, 8, 4, 2, 1, 1, 3, 9, 24, 52, 78, 92, 87, 74, 58, 49, 56, 88, 121, 128, 102, 73, 48, 27,
]

export const hours: Record<"weekdays" | "weekend", HourPoint[]> = {
  weekdays: weekdayHours.map((orders, h) => ({ hour: hourLabel(h), orders })),
  weekend: weekendHours.map((orders, h) => ({ hour: hourLabel(h), orders })),
}

export type BusyPoint = { day: string; slot: string; orders: number }

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const slots = Array.from({ length: 12 }, (_, i) => hourLabel(i + 10))

export const busy: BusyPoint[] = days.flatMap((day, d) =>
  slots.map((slot, s) => {
    const lunch = Math.exp(-((s - 2.5) ** 2) / 2.2)
    const dinner = Math.exp(-((s - 8.5) ** 2) / 3)
    const weekend = d >= 4 ? 1.35 + (d === 5 ? 0.2 : 0) : 1
    const wobble = 0.85 + 0.3 * Math.abs(Math.sin((d + 1) * (s + 3) * 1.7))
    return { day, slot, orders: Math.round((18 + 62 * lunch + 84 * dinner * weekend) * wobble) }
  })
)

export type ExpensePoint = { item: string; amount: number; color: string }

export const expenses: Record<GoalMonth, ExpensePoint[]> = {
  sep: [
    { item: "Payroll", amount: 18400, color: "var(--chart-1)" },
    { item: "Ingredients", amount: 12600, color: "var(--chart-2)" },
    { item: "Rent", amount: 6500, color: "var(--chart-3)" },
    { item: "Marketing", amount: 3200, color: "var(--chart-4)" },
    { item: "Utilities", amount: 1900, color: "var(--chart-5)" },
  ],
  oct: [
    { item: "Payroll", amount: 19100, color: "var(--chart-1)" },
    { item: "Ingredients", amount: 14900, color: "var(--chart-2)" },
    { item: "Rent", amount: 6500, color: "var(--chart-3)" },
    { item: "Marketing", amount: 5800, color: "var(--chart-4)" },
    { item: "Utilities", amount: 2100, color: "var(--chart-5)" },
  ],
}

export type ChannelStage = { quarter: string; dineIn: number; delivery: number; pickup: number }

export const channelFlow: Record<"2025" | "2026", ChannelStage[]> = {
  "2025": [
    { quarter: "Q1", dineIn: 41200, delivery: 18600, pickup: 9800 },
    { quarter: "Q2", dineIn: 45800, delivery: 22400, pickup: 11200 },
    { quarter: "Q3", dineIn: 43100, delivery: 27900, pickup: 12600 },
    { quarter: "Q4", dineIn: 49600, delivery: 31800, pickup: 14100 },
  ],
  "2026": [
    { quarter: "Q1", dineIn: 44800, delivery: 29600, pickup: 13900 },
    { quarter: "Q2", dineIn: 47200, delivery: 36400, pickup: 16800 },
    { quarter: "Q3", dineIn: 45900, delivery: 44100, pickup: 19200 },
    { quarter: "Q4", dineIn: 52300, delivery: 51800, pickup: 22600 },
  ],
}

export type TicketPoint = { day: string; ticket: number }

const ticketDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

export const tickets: Record<"lunch" | "dinner", TicketPoint[]> = {
  lunch: [18.4, 17.9, 19.2, 20.1, 22.6, 26.8, 24.3].map((ticket, i) => ({
    day: ticketDays[i],
    ticket,
  })),
  dinner: [31.2, 29.8, 32.4, 34.9, 41.7, 46.2, 38.5].map((ticket, i) => ({
    day: ticketDays[i],
    ticket,
  })),
}

export type GrowthPoint = { month: string; members: number; app: number }

export const growth: GrowthPoint[] = Array.from({ length: 24 }, (_, i) => {
  const date = new Date(2024, 10 + i, 1)
  const s = (x: number, mid: number, rate: number) => 1 / (1 + Math.exp(-(x - mid) / rate))
  return {
    month: date.toLocaleString("en-US", { month: "short" }),
    members: Math.round(120 + 4880 * s(i, 13, 3.4)),
    app: Math.round(60 + 3240 * s(i, 16, 2.6)),
  }
})

export type DailyPoint = { day: string; revenue: number }

export const daily: DailyPoint[] = Array.from({ length: 120 }, (_, i) => {
  const date = new Date(2026, 6, 3 + i)
  const weekday = date.getDay()
  const weekend = weekday === 5 || weekday === 6 ? 1.45 : weekday === 0 ? 1.2 : 1
  const noise = 0.82 + 0.36 * Math.abs(Math.sin(i * 2.31) * Math.cos(i * 0.73))
  return {
    day: date.toLocaleString("en-US", { month: "short", day: "numeric" }),
    revenue: Math.round((4200 + 22 * i) * weekend * noise),
  }
})

export type KpiRange = "7d" | "30d" | "90d"
export type KpiPoint = { day: string; value: number }
export type Kpi = {
  key: string
  label: string
  kind: "currency" | "count" | "ticket"
  /** How the period rolls up into the headline number. */
  rollup: "sum" | "mean"
  variant: "line" | "bars"
  color: string
  series: Record<KpiRange, KpiPoint[]>
}

const kpiSeries = (days: number, base: number, trend: number, seed: number): KpiPoint[] =>
  Array.from({ length: days }, (_, i) => {
    const date = new Date(2026, 9, 31 - (days - 1 - i))
    const weekday = date.getDay()
    const weekend = weekday === 5 || weekday === 6 ? 1.3 : 1
    const wobble = 0.86 + 0.28 * Math.abs(Math.sin((i + seed) * 1.93) * Math.cos((i + seed) * 0.61))
    return {
      day: date.toLocaleString("en-US", { month: "short", day: "numeric" }),
      value: base * (1 + trend * (i / days)) * weekend * wobble,
    }
  })

const kpiRanges = (base: number, trend: number, seed: number, round: (v: number) => number) =>
  Object.fromEntries(
    ([7, 30, 90] as const).map((days) => [
      `${days}d`,
      kpiSeries(days, base, trend, seed).map((p) => ({ ...p, value: round(p.value) })),
    ])
  ) as Record<KpiRange, KpiPoint[]>

export const kpis: Kpi[] = [
  {
    key: "revenue",
    label: "Revenue",
    kind: "currency",
    rollup: "sum",
    variant: "line",
    color: "var(--chart-1)",
    series: kpiRanges(5200, 0.24, 1, Math.round),
  },
  {
    key: "orders",
    label: "Orders",
    kind: "count",
    rollup: "sum",
    variant: "bars",
    color: "var(--chart-2)",
    series: kpiRanges(210, 0.18, 4, Math.round),
  },
  {
    key: "ticket",
    label: "Average ticket",
    kind: "ticket",
    rollup: "mean",
    variant: "line",
    color: "var(--chart-4)",
    series: kpiRanges(24.6, 0.06, 7, (v) => Math.round(v * 100) / 100),
  },
  {
    key: "customers",
    label: "New customers",
    kind: "count",
    rollup: "sum",
    variant: "bars",
    color: "var(--chart-3)",
    series: kpiRanges(18, 0.3, 11, Math.round),
  },
]

export type ScorePoint = { axis: string; downtown: number; riverside: number }

export const scores: Record<"now" | "before", ScorePoint[]> = {
  now: [
    { axis: "Speed", downtown: 86, riverside: 64 },
    { axis: "Quality", downtown: 78, riverside: 88 },
    { axis: "Value", downtown: 70, riverside: 82 },
    { axis: "Service", downtown: 91, riverside: 72 },
    { axis: "Cleanliness", downtown: 84, riverside: 90 },
    { axis: "Ambience", downtown: 62, riverside: 86 },
  ],
  before: [
    { axis: "Speed", downtown: 72, riverside: 58 },
    { axis: "Quality", downtown: 74, riverside: 81 },
    { axis: "Value", downtown: 76, riverside: 77 },
    { axis: "Service", downtown: 80, riverside: 69 },
    { axis: "Cleanliness", downtown: 79, riverside: 84 },
    { axis: "Ambience", downtown: 60, riverside: 79 },
  ],
}

export type FunnelPoint = { stage: string; people: number }

export const funnels: Record<"web" | "app", FunnelPoint[]> = {
  web: [
    { stage: "Visited menu", people: 12480 },
    { stage: "Added to cart", people: 6210 },
    { stage: "Started checkout", people: 3940 },
    { stage: "Paid", people: 3380 },
  ],
  app: [
    { stage: "Visited menu", people: 8960 },
    { stage: "Added to cart", people: 6120 },
    { stage: "Started checkout", people: 4870 },
    { stage: "Paid", people: 4510 },
  ],
}

export type SourcePoint = { source: string; orders: number; color: string }

export const sources: Record<GoalMonth, SourcePoint[]> = {
  sep: [
    { source: "Website", orders: 2840, color: "var(--chart-1)" },
    { source: "App", orders: 2210, color: "var(--chart-2)" },
    { source: "Walk-in", orders: 1630, color: "var(--chart-3)" },
    { source: "Phone", orders: 720, color: "var(--chart-4)" },
    { source: "Marketplace", orders: 940, color: "var(--chart-5)" },
  ],
  oct: [
    { source: "Website", orders: 2690, color: "var(--chart-1)" },
    { source: "App", orders: 3180, color: "var(--chart-2)" },
    { source: "Walk-in", orders: 1580, color: "var(--chart-3)" },
    { source: "Phone", orders: 540, color: "var(--chart-4)" },
    { source: "Marketplace", orders: 1120, color: "var(--chart-5)" },
  ],
}

// Operations: a period against the last, a day slot by slot, stores and pages.

const dayLabel = (offset: number) =>
  new Date(2026, 9, 3 + offset).toLocaleString("en-US", { month: "short", day: "numeric" })

export type TrendPoint = {
  day: string
  revenue: number
  lastRevenue: number
  orders: number
  lastOrders: number
}

export const trend: TrendPoint[] = Array.from({ length: 30 }, (_, i) => {
  const weekday = new Date(2026, 9, 3 + i).getDay()
  const weekend = weekday === 5 || weekday === 6 ? 1 : weekday === 0 ? 0.6 : 0
  const lift = i >= 15 ? 1 + Math.min(0.12, (i - 15) * 0.02) : 1
  const revenue = Math.round((4800 + 1500 * weekend + 260 * Math.sin(i / 1.7) + 18 * i) * lift)
  const lastRevenue = Math.round(4650 + 1400 * weekend + 240 * Math.sin(i / 2.1 + 1) + 6 * i)
  return {
    day: dayLabel(i),
    revenue,
    lastRevenue,
    orders: Math.round(revenue / (27.4 + 0.6 * Math.sin(i / 3))),
    lastOrders: Math.round(lastRevenue / 26.8),
  }
})

export const trendMarkers = [
  { at: dayLabel(6), label: "New menu photos" },
  { at: dayLabel(15), label: "Lunch combo" },
  { at: dayLabel(15), label: "Free delivery weekend" },
  { at: dayLabel(23), label: "Price update" },
]

export type SlotPoint = { slot: string; orders: number; wait: number | null; full: boolean }
export type BusyDay = {
  now?: string
  bands: { from: string; to: string; label: string }[]
  slots: SlotPoint[]
}

const gauss = (x: number, mu: number, sigma: number) => Math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))
const clock = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`
/** Pickup slots every 15 minutes, 11:00 to 21:45. */
const slotMinutes = Array.from({ length: 44 }, (_, i) => 660 + i * 15)

export const busyDays: Record<"today" | "yesterday", BusyDay> = {
  today: {
    now: "19:15",
    bands: [
      { from: "12:15", to: "12:30", label: "Paused" },
      { from: "17:30", to: "18:15", label: "Margherita sold out" },
    ],
    slots: slotMinutes.map((m) => {
      const raw = 1.5 + 10.5 * gauss(m, 750, 38) + 13 * gauss(m, 1140, 50) + 1.6 * Math.sin(m / 17)
      const later = m > 1155
      const paused = m >= 735 && m <= 750
      const orders = Math.max(0, Math.round(raw * (later ? 0.35 : paused ? 0.3 : 1)))
      const unmeasured = m < 690 || later || (m >= 840 && m <= 870)
      return {
        slot: clock(m),
        orders,
        wait: unmeasured ? null : Math.round(8 + raw * 1.6 + 2 * Math.sin(m / 23)),
        full: !later && orders >= 11,
      }
    }),
  },
  yesterday: {
    bands: [{ from: "13:00", to: "13:45", label: "Offline" }],
    slots: slotMinutes.map((m) => {
      const raw = 1 + 8.5 * gauss(m, 760, 45) + 11.5 * gauss(m, 1155, 60) + 1.4 * Math.sin(m / 13)
      const offline = m >= 780 && m <= 825
      const orders = offline ? 0 : Math.max(0, Math.round(raw))
      return {
        slot: clock(m),
        orders,
        wait: m < 720 || offline ? null : Math.round(7 + raw * 1.4 + 2 * Math.sin(m / 19)),
        full: orders >= 11,
      }
    }),
  },
}

export type StoreDay = { day: string; state: "open" | "short" | "long" | "none"; detail: string }

const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`)
const storeDays = (pattern: string[]): StoreDay[] =>
  pattern
    .join("")
    .padEnd(30, "o")
    .slice(0, 30)
    .split("")
    .map((c, i) => {
      const state = c === "s" ? "short" : c === "l" ? "long" : c === "n" ? "none" : "open"
      const detail =
        state === "short"
          ? `Paused ${minutes(10 + ((i * 7) % 18))}`
          : state === "long"
            ? `Paused ${minutes(45 + ((i * 13) % 50))}`
            : state === "none"
              ? "Not recorded yet"
              : "Taking orders all day"
      return { day: dayLabel(i), state, detail }
    })

export const storeHistory: Record<"downtown" | "riverside", StoreDay[]> = {
  downtown: storeDays(["nn", "oooooo", "s", "oooooooooo", "l", "oooo", "s", "ooooo"]),
  riverside: storeDays(["n", "oooo", "s", "ooo", "l", "s", "ooooooo", "l", "oooooo", "s", "ooo", "s"]),
}

export type ItemSales = { item: string; sold: number }

export const topItems: Record<"week" | "last", ItemSales[]> = {
  week: [
    { item: "Margherita", sold: 412 },
    { item: "Pepperoni", sold: 388 },
    { item: "Garlic knots", sold: 301 },
    { item: "Spicy honey", sold: 264 },
    { item: "Caesar salad", sold: 189 },
    { item: "Tiramisu", sold: 142 },
  ],
  last: [
    { item: "Pepperoni", sold: 401 },
    { item: "Margherita", sold: 366 },
    { item: "Caesar salad", sold: 244 },
    { item: "Garlic knots", sold: 238 },
    { item: "Tiramisu", sold: 171 },
    { item: "Spicy honey", sold: 120 },
  ],
}

export type StoreWeek = {
  store: string
  lastAverage: number
  average: number
  lastOrders: number
  orders: number
}

export const storeWeeks: StoreWeek[] = [
  { store: "Downtown", lastAverage: 27.4, average: 29.1, lastOrders: 1240, orders: 1318 },
  { store: "Riverside", lastAverage: 31.2, average: 30.4, lastOrders: 860, orders: 902 },
  { store: "Midtown", lastAverage: 24.8, average: 26.9, lastOrders: 1105, orders: 1032 },
  { store: "Harbor", lastAverage: 33.5, average: 35.2, lastOrders: 640, orders: 711 },
  { store: "Airport", lastAverage: 22.1, average: 21.6, lastOrders: 1420, orders: 1388 },
  { store: "University", lastAverage: 19.9, average: 22.3, lastOrders: 980, orders: 1150 },
]

export type PageLoad = { page: string; p50: number; p75: number; p90: number }

export const pageLoads: Record<"mobile" | "desktop", PageLoad[]> = {
  mobile: [
    { page: "Home", p50: 1.8, p75: 2.4, p90: 3.6 },
    { page: "Menu", p50: 2.3, p75: 3.1, p90: 4.8 },
    { page: "Item", p50: 1.4, p75: 1.9, p90: 2.9 },
    { page: "Cart", p50: 1.1, p75: 1.5, p90: 2.2 },
    { page: "Checkout", p50: 2.9, p75: 4.3, p90: 6.1 },
    { page: "Order status", p50: 1.2, p75: 1.7, p90: 2.6 },
  ],
  desktop: [
    { page: "Home", p50: 1.1, p75: 1.5, p90: 2.3 },
    { page: "Menu", p50: 1.5, p75: 2.0, p90: 3.0 },
    { page: "Item", p50: 0.9, p75: 1.2, p90: 1.8 },
    { page: "Cart", p50: 0.8, p75: 1.0, p90: 1.5 },
    { page: "Checkout", p50: 1.9, p75: 2.7, p90: 3.9 },
    { page: "Order status", p50: 0.8, p75: 1.1, p90: 1.7 },
  ],
}
