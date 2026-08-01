'use client'

import dynamic from 'next/dynamic'
import useSWR, { mutate } from 'swr'
import { useState } from 'react'
import type { EmergencyReport, RiskColor } from '@/lib/triage/schema'
import { ReportCard } from './report-card'

// Load map client-side only — mapbox-gl uses browser APIs
const ReliefMap = dynamic(
  () => import('./relief-map').then((m) => m.ReliefMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted/30 animate-pulse rounded-lg" /> },
)

export const REPORTS_KEY = '/api/reports'

const COLORS: Array<{ label: string; value: RiskColor | '' }> = [
  { label: 'All',    value: '' },
  { label: 'RED',    value: 'RED' },
  { label: 'ORANGE', value: 'ORANGE' },
  { label: 'YELLOW', value: 'YELLOW' },
  { label: 'GREEN',  value: 'GREEN' },
  { label: 'BLUE',   value: 'BLUE' },
]

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Failed to fetch reports')
    return r.json()
  })

export function revalidateReports() {
  mutate(REPORTS_KEY)
}

export function Dashboard() {
  const [filter, setFilter] = useState<RiskColor | ''>('')

  const swrKey = filter
    ? `${REPORTS_KEY}?risk_color=${filter}&limit=50`
    : `${REPORTS_KEY}?limit=50`

  const { data, error, isLoading, isValidating } = useSWR<{ reports: EmergencyReport[] }>(
    swrKey,
    fetcher,
    { refreshInterval: 30_000 },
  )

  const reports = data?.reports ?? []

  const sorted = [...reports].sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
    if (a.risk_level !== b.risk_level) return a.risk_level - b.risk_level
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const activeCount = reports.filter((r) => r.is_active).length
  const mergedCount = reports.filter((r) => r.report_count > 1).length

  return (
    <main className="flex flex-1 overflow-hidden min-w-0">
      {/* Reports feed */}
      <section className="w-[400px] shrink-0 border-r border-border overflow-y-auto px-5 py-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unified Events
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Live feed · auto-refreshes every 30s
              {activeCount > 0 && (
                <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white">
                  {activeCount} ACTIVE
                </span>
              )}
              {mergedCount > 0 && (
                <span className="ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  {mergedCount} MERGED
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium border transition-colors ${
                  filter === c.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label || 'All'}
              </button>
            ))}
          </div>
        </div>

        {isValidating && !isLoading && (
          <p className="text-xs text-muted-foreground animate-pulse">Refreshing…</p>
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {String(error)}
          </div>
        )}

        {!isLoading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <p className="text-sm text-muted-foreground">No reports yet.</p>
            <p className="text-xs text-muted-foreground">
              Submit a report via the form or wait for Kapso to send one.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-card h-32 animate-pulse" />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3">
          {sorted.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      </section>

      {/* Live map */}
      <div className="flex-1 flex flex-col min-w-0 p-4 gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live Map
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {reports.length === 0
                ? 'Waiting for reports…'
                : `${reports.length} event${reports.length === 1 ? '' : 's'} plotted`}
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap">
            {(['RED','ORANGE','YELLOW','GREEN','BLUE'] as RiskColor[]).map((c) => (
              <span key={c} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span
                  className="inline-block size-2.5 rounded-full border border-white/20"
                  style={{ background: { RED:'#dc2626', ORANGE:'#f97316', YELLOW:'#eab308', GREEN:'#16a34a', BLUE:'#3b82f6' }[c] }}
                />
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex-1 rounded-lg overflow-hidden border border-border">
          <ReliefMap reports={sorted} />
        </div>
      </div>
    </main>
  )
}
