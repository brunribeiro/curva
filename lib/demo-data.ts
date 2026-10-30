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
