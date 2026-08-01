'use client'

import { useState } from 'react'
import type { EmergencyReport } from '@/lib/triage/schema'
import { ReportCard } from './report-card'
import { revalidateReports } from './dashboard'

interface FormState {
  full_name: string
  dni: string
  description: string
  location_text: string
  latitude: string
  longitude: string
  people_affected: string
  raw_transcript: string
}

const EMPTY_FORM: FormState = {
  full_name: '',
  dni: '',
  description: '',
  location_text: '',
  latitude: '',
  longitude: '',
  people_affected: '',
  raw_transcript: '',
}

const SAMPLE: FormState = {
  dni: '28345671',
  description:
    'A bus collided with a car at high speed. Approximately 4 people are injured on the ground. One person appears unconscious and is not responding. There is fuel leaking from the bus.',
  people_affected: '4',
  full_name: 'María López',
  location_text: 'Calle Rivadavia 1450, Buenos Aires, near the intersection with Callao',
  latitude: '-34.6083',
  longitude: '-58.3901',
  raw_transcript:
    'Reporter: María López, DNI 28345671\nLocation: Calle Rivadavia 1450, Buenos Aires\nSituation: Bus hit a car. ~4 injured. One unconscious. Fuel leaking.\nTime: 14:32',
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

export function TriageForm() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EmergencyReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim() || !form.dni.trim() || !form.people_affected.trim() || !form.location_text.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    // Build the Agent1Payload — required fields always sent, optional only when filled
    const payload: Record<string, unknown> = {
      dni:             form.dni.trim(),
      description:     form.description.trim(),
      people_affected: parseInt(form.people_affected, 10),
      location_text:   form.location_text.trim(),
    }
    if (form.full_name.trim())      payload.full_name      = form.full_name.trim()
    if (form.raw_transcript.trim()) payload.raw_transcript = form.raw_transcript.trim()
    if (form.latitude.trim())       payload.latitude       = parseFloat(form.latitude)
    if (form.longitude.trim())      payload.longitude      = parseFloat(form.longitude)

    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'Unknown error')
        return
      }

      setResult(json.report as EmergencyReport)
      setForm(EMPTY_FORM)
      revalidateReports()
    } catch (err) {
      setError('Network error — could not reach the API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">Fields marked <span className="text-destructive">*</span> are required.</p>
        <button
          type="button"
          onClick={() => setForm(SAMPLE)}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Load sample
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Required fields */}
        <fieldset className="flex flex-col gap-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Required
          </legend>

          <Field label="DNI" required>
            <input
              type="text"
              value={form.dni}
              onChange={set('dni')}
              placeholder="e.g. 28345671"
              className={inputClass}
              disabled={loading}
              required
            />
          </Field>

          <Field label="Description" required>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={4}
              placeholder="Describe the emergency situation as reported by the caller…"
              className={`${inputClass} resize-y leading-relaxed`}
              disabled={loading}
              required
            />
          </Field>

          <Field label="People affected" required>
            <input
              type="number"
              min={0}
              value={form.people_affected}
              onChange={set('people_affected')}
              placeholder="e.g. 4"
              className={inputClass}
              disabled={loading}
              required
            />
          </Field>

          <Field label="Address / landmark" required>
            <input
              type="text"
              value={form.location_text}
              onChange={set('location_text')}
              placeholder="e.g. Calle Rivadavia 1450, Buenos Aires"
              className={inputClass}
              disabled={loading}
              required
            />
          </Field>
        </fieldset>

        {/* Optional supplementary fields */}
        <fieldset className="flex flex-col gap-4">
          <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Supplementary (optional)
          </legend>

          <Field label="Full name">
            <input
              type="text"
              value={form.full_name}
              onChange={set('full_name')}
              placeholder="e.g. María López"
              className={inputClass}
              disabled={loading}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitude">
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={set('latitude')}
                placeholder="e.g. -34.6083"
                className={inputClass}
                disabled={loading}
              />
            </Field>
            <Field label="Longitude">
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={set('longitude')}
                placeholder="e.g. -58.3901"
                className={inputClass}
                disabled={loading}
              />
            </Field>
          </div>

          <Field label="Raw transcript">
            <textarea
              value={form.raw_transcript}
              onChange={set('raw_transcript')}
              rows={3}
              placeholder="Full verbatim WhatsApp conversation — stored for audit purposes only."
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
              disabled={loading}
            />
          </Field>
        </fieldset>

        <button
          type="submit"
          disabled={loading || !form.description.trim() || !form.dni.trim() || !form.people_affected.trim() || !form.location_text.trim()}
          className="self-start rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:opacity-90 transition-opacity"
        >
          {loading ? 'Classifying…' : 'Classify & Store Report'}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted-foreground">Generated report:</p>
          <ReportCard report={result} />
        </div>
      )}
    </section>
  )
}
