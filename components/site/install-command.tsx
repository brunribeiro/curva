"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"

export function InstallCommand({ item }: { item: string }) {
  const [origin, setOrigin] = React.useState("https://curva.dev")
  const [copied, setCopied] = React.useState(false)
  const command = `npx shadcn@latest add ${origin}/r/${item}.json`

  React.useEffect(() => {
    // The registry is served from wherever this site runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin)
  }, [])

  const copy = async () => {
    await navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border bg-card py-1.5 pr-1.5 pl-4 font-mono text-[13px] text-muted-foreground">
      <span className="text-foreground/40 select-none">$</span>
      <code className="min-w-0 flex-1 truncate">{command}</code>
      <button
        onClick={copy}
        className="relative h-8 w-16 shrink-0 rounded-lg bg-muted font-sans text-xs font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? "copied" : "copy"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="block"
          >
            {copied ? "Copied" : "Copy"}
          </motion.span>
        </AnimatePresence>
        <span aria-live="polite" className="sr-only">
          {copied ? "Command copied" : ""}
        </span>
      </button>
    </div>
  )
}
