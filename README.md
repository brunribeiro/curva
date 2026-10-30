# Curva

Animated chart components for [shadcn/ui](https://ui.shadcn.com). They install as source you own, read your theme's tokens, and move with your data.

## Install

```bash
npx shadcn@latest add <registry-url>/r/area-chart.json
```

This adds `components/ui/area-chart.tsx` and `lib/curva.ts`, plus `motion` and `d3-shape`.

## Use

```tsx
import { AreaChart } from "@/components/ui/area-chart"

<AreaChart data={data} index="day" value="revenue" label="Revenue" />
```

| Prop | Type | Default |
| --- | --- | --- |
| `data` | `T[]` | |
| `index` | key of `T`, the label of each point | |
| `value` | key of `T`, the number of each point | |
| `label` | accessible name and series name | |
| `color` | any CSS color | `var(--chart-1)` |
| `formatValue` | `(n) => string`, tooltip and screen readers | `1,234.5` |
| `formatAxis` | `(n) => string`, y-axis | `1.2K` |
| `showXAxis` / `showYAxis` / `showGrid` | `boolean` | `true` |
| `onActiveChange` | `(point, index) => void` | |

Size it with `className` (it defaults to `h-60 w-full`).

## How it moves

- **Entrance:** the curve rises from the baseline in a left-to-right wave the first time it scrolls into view.
- **Morphing:** new `data` reshapes the curve in place, even when the number of points changes and even mid-animation.
- **Gliding:** the active point rides along the curve on a spring, the region to its right goes quiet, and the tooltip and axis labels count to their new values.
- **Reduced motion:** with `prefers-reduced-motion`, every change happens instantly.

## Accessibility

The chart is a focusable group. Arrow keys, Home and End walk the points, Escape clears, the active value is announced through `aria-live`, and a visually hidden table carries the full dataset.

## Develop

```bash
pnpm dev             # showcase at localhost:3000
pnpm registry:build  # writes public/r/*.json
pnpm typecheck && pnpm lint
```

Chart sources live in `registry/curva/`. Imports of `@/registry/curva/lib/*` become `@/lib/*` when installed.

## License

MIT © Bruno Ribeiro
