export default function Home() {
  return (
    <main className="min-h-screen bg-background font-mono text-foreground flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl flex flex-col gap-8">

        {/* Identity */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">ReliefMap</span>
          <h1 className="text-2xl font-semibold tracking-tight">Agent 2 — Triage Processor</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            Backend service. Receives structured emergency payloads from Kapso (Agent 1),
            classifies urgency with Gemini, deduplicates by zone, and persists unified events to Supabase.
            No user interface — interact via the API endpoints below.
          </p>
        </div>

        {/* Endpoints */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Endpoints</span>

          <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-0.5 text-xs font-bold bg-green-600/20 text-green-400 border border-green-600/30">POST</span>
              <code className="text-sm">/api/triage</code>
            </div>
            <p className="text-xs text-muted-foreground">
              Receives an Agent 1 payload. Checks for duplicates in the same zone (2h window), merges or creates a new event, classifies with Gemini, and stores in Supabase.
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Required body fields:{' '}
              <code className="text-foreground">dni</code>,{' '}
              <code className="text-foreground">description</code>,{' '}
              <code className="text-foreground">people_affected</code>,{' '}
              <code className="text-foreground">location_text</code>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-0.5 text-xs font-bold bg-blue-600/20 text-blue-400 border border-blue-600/30">GET</span>
              <code className="text-sm">/api/reports</code>
            </div>
            <p className="text-xs text-muted-foreground">
              Returns stored emergency events ordered by recency. Consumed by the frontend dashboard to display the live feed.
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Query params:{' '}
              <code className="text-foreground">risk_color</code>,{' '}
              <code className="text-foreground">limit</code>,{' '}
              <code className="text-foreground">offset</code>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Status</span>
          <div className="rounded-lg border border-border bg-card p-4 grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
            <span className="text-muted-foreground">Database</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-green-500 inline-block" />Supabase connected</span>
            <span className="text-muted-foreground">Model</span>
            <span>gemini-2.0-flash-lite</span>
            <span className="text-muted-foreground">Deduplication</span>
            <span>Zone-based · 2h window</span>
            <span className="text-muted-foreground">Escalation</span>
            <span>3 reports +1 level · 5 reports +2 levels</span>
            <span className="text-muted-foreground">Life risk rule</span>
            <span className="text-red-400">RED always takes priority</span>
          </div>
        </div>

      </div>
    </main>
  )
}
