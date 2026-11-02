import { ChannelsCard, OrdersCard } from "@/components/site/bar-cards"
import { DailyCard, FlowCard, GrowthCard, TicketCard } from "@/components/site/expressive-cards"
import { InstallCommand } from "@/components/site/install-command"
import { RevenueCard } from "@/components/site/revenue-card"
import { FunnelCard, KpiRow, ScoreCard, SourcesCard } from "@/components/site/scorecard-cards"
import { CategoryCard, GoalsCard } from "@/components/site/round-cards"
import { BudgetCard, BusyCard, ExpensesCard, HoursCard } from "@/components/site/shape-cards"
import { ThemeToggle } from "@/components/site/theme-toggle"

const features = [
  {
    title: "Morphs between datasets",
    text: "Switch week to year and the curve reshapes in place, whatever the number of points.",
  },
  {
    title: "Rides the curve",
    text: "The active point glides along the line on a spring instead of jumping between values.",
  },
  {
    title: "Your theme, your code",
    text: "Reads the shadcn/ui tokens and installs as source you own, not a package you wrap.",
  },
  {
    title: "Accessible by default",
    text: "Arrow keys walk the data, values are announced, and reduced motion is respected.",
  },
]

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <span className="flex items-center gap-2 font-semibold tracking-tight">
          <svg viewBox="0 0 24 24" className="size-5 text-chart-1" fill="none" aria-hidden>
            <path
              d="M3 17c3.5 0 4.5-10 9-10s5.5 10 9 10"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
            />
          </svg>
          Curva
        </span>
        <ThemeToggle />
      </header>

      <main>
        <section className="pt-14 pb-10 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Charts that move with your data
          </h1>
          <p className="mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
            Animated chart components for shadcn/ui. Copy them into your project and own every
            line.
          </p>
          <div className="mt-8 max-w-xl">
            <InstallCommand items={["area-chart"]} />
          </div>
        </section>

        <RevenueCard />

        <section className="pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Bar charts</h2>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            Side by side or stacked. Bars slide to their new slots, grow in from the baseline, and
            restack when a series leaves.
          </p>
          <div className="mt-6 max-w-xl">
            <InstallCommand items={["bar-chart"]} />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <OrdersCard />
            <ChannelsCard />
          </div>
        </section>

        <section className="pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Donut and radial charts</h2>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            Parts of a whole and progress toward goals. Rings pour in, segments reshape and make
            room, and the legend and center follow wherever you point.
          </p>
          <div className="mt-6 max-w-xl">
            <InstallCommand items={["donut-chart", "radial-chart"]} />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <CategoryCard />
            <GoalsCard />
          </div>
        </section>

        <section className="pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Beyond lines and bars</h2>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            For numbers a line can&apos;t hold: a budget against its limit, the shape of a day, the
            busiest hours of the week, where the money went.
          </p>
          <div className="mt-6 max-w-xl">
            <InstallCommand items={["gauge-chart", "polar-bar-chart", "heatmap-chart", "split-bar"]} />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <BudgetCard />
            <HoursCard />
            <div className="lg:col-span-2">
              <BusyCard />
            </div>
            <div className="lg:col-span-2">
              <ExpensesCard />
            </div>
          </div>
        </section>

        <section className="pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Flows, glass and ranges</h2>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            Bands that flow from stage to stage, capsules that fill like glass, growth drawn in
            dots, and a histogram you brush to ask about any stretch of time.
          </p>
          <div className="mt-6 max-w-xl">
            <InstallCommand items={["flow-chart", "capsule-bar-chart", "dot-matrix-chart", "range-histogram"]} />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <FlowCard />
            </div>
            <TicketCard />
            <GrowthCard />
            <div className="lg:col-span-2">
              <DailyCard />
            </div>
          </div>
        </section>

        <section className="pt-20">
          <h2 className="text-2xl font-semibold tracking-tight">Scorecards and funnels</h2>
          <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
            Sparklines that hand their numbers to a headline, a radar for comparing, a waffle for
            dividing and a funnel for converting.
          </p>
          <div className="mt-6 max-w-xl">
            <InstallCommand items={["sparkline", "radar-chart", "waffle-chart", "funnel-chart"]} />
          </div>
          <div className="mt-8 grid gap-4">
            <KpiRow />
            <div className="grid gap-4 lg:grid-cols-2">
              <ScoreCard />
              <SourcesCard />
            </div>
            <FunnelCard />
          </div>
        </section>

        <section className="grid gap-x-8 gap-y-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title}>
              <h2 className="text-sm font-medium">{f.title}</h2>
              <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="flex h-16 items-center border-t text-sm text-muted-foreground">
        <p>
          MIT licensed. Built by{" "}
          <a href="https://brunoribei.ro" className="text-foreground underline-offset-4 hover:underline">
            Bruno Ribeiro
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
