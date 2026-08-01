import { TriageForm } from '@/components/triage-form'
import { Dashboard } from '@/components/dashboard'

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      {/* Top bar */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-base font-semibold tracking-tight">ReliefMap</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Triage Processor — Agent 2
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-green-500 inline-block" />
            Kapso webhook ready
          </span>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — intake form */}
        <aside className="w-[420px] shrink-0 border-r border-border overflow-y-auto px-6 py-6 flex flex-col gap-0">
          <div className="mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Manual intake
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Simulate a Kapso payload — fill in the fields Agent 1 would collect and submit to classify.
            </p>
          </div>
          <TriageForm />
        </aside>

        {/* Right — reports feed + map */}
        <Dashboard />
      </div>
    </div>
  )
}
