import { generateText, Output } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  TriageOutputSchema,
  RISK_LEVEL_TO_COLOR,
  escalateRiskLevel,
  type Agent1Payload,
  type EmergencyReport,
  type TriageOutput,
} from './schema'

// Cheapest Gemini model available via Google AI Studio
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})
const MODEL_ID = 'gemini-2.0-flash-lite'
const MODEL = google(MODEL_ID)

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Agent 2 — the Triage Classification Specialist in a humanitarian emergency response system.

Your only responsibility is to read a structured emergency report collected by the intake bot (Agent 1) and assign the correct risk classification. You do NOT extract names, locations, or any other data — that has already been done.

TRIAGE RISK LEVELS (1–5 COLOR PATTERN)

- Level 1 – RED    (Vital / Critical Emergency): Imminent life risk. Unconscious victims, cardiac/respiratory arrest, major fires, structural collapse, multiple severe victims, or confirmed deaths.
- Level 2 – ORANGE (Very Urgent): Potential severe risk. Serious injuries, severe pain, situations that can rapidly escalate to Level 1.
- Level 3 – YELLOW (Urgent): Stable, no imminent life risk. Moderate injuries, closed fractures, controlled incidents with few people affected.
- Level 4 – GREEN  (Low Urgency): Minor injuries or incidents. People not directly endangered, requiring basic assistance only.
- Level 5 – BLUE   (Non-Urgent / Informational): No injuries, no active danger. Informational or precautionary report.

CLASSIFICATION RULES
1. Base your classification solely on the "description" and "people_affected" fields provided.
2. Apply a conservative bias: if there is any indication of life-threatening risk or confirmed deaths, assign Level 1 (RED) without exception.
3. Classification is context-driven, not keyword-matched — analyse the full description together with the number of people involved.
4. The title must be at most 7 words, direct and descriptive (e.g. "Bus collision with multiple injuries").
5. The reason must be a single sentence justifying the classification.`

// ── Zone key ─────────────────────────────────────────────────────────────────

/**
 * Normalises a location string into a short zone key used for deduplication.
 * Strips accents, lowercases, removes punctuation, keeps the first 3 tokens.
 */
export function buildZoneKey(location: string): string {
  return location
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('_')
}

// ── Situation summary ─────────────────────────────────────────────────────────

/**
 * Builds a human-readable situation summary string for a unified event.
 * This is the string that operators and downstream systems (e.g. map overlays)
 * consume to understand the current state of an active zone.
 *
 * Priority rule: life risk always leads.
 */
export function buildSituationSummary(event: {
  title: string
  risk_level: number
  risk_color: string
  report_count: number
  people_affected: number
  location_text: string
  reason: string
  is_active: boolean
}): string {
  const priority = event.risk_level === 1 ? '[LIFE RISK — PRIORITY] ' : ''
  const reportLabel = event.report_count === 1 ? '1 report' : `${event.report_count} reports`
  const status = event.is_active ? 'ACTIVE' : 'RESOLVED'

  return (
    `${priority}${event.title} | ` +
    `${event.risk_color} (Level ${event.risk_level}) | ` +
    `${reportLabel} received | ` +
    `${event.people_affected} people affected | ` +
    `Zone: ${event.location_text} | ` +
    `Status: ${status} | ` +
    `Reason: ${event.reason}`
  )
}

// ── Dev bypass ────────────────────────────────────────────────────────────────

/**
 * When NEXT_PUBLIC_DEV_BYPASS_AI=true, skip the AI Gateway and return a
 * deterministic mock classification so the full pipeline (deduplication,
 * Supabase insert, escalation, frontend feed) can be tested without a
 * working API key or credit card on file.
 * This flag must NEVER be set in production.
 */
function mockClassify(payload: Agent1Payload): TriageOutput {
  const desc = payload.description.toLowerCase()
  const isLifeRisk =
    desc.includes('unconscious') ||
    desc.includes('collapse') ||
    desc.includes('fire') ||
    desc.includes('cardiac') ||
    desc.includes('dead') ||
    desc.includes('death') ||
    payload.people_affected >= 10

  const isSevere =
    desc.includes('injur') ||
    desc.includes('bleed') ||
    desc.includes('fracture') ||
    desc.includes('crash') ||
    desc.includes('collision') ||
    payload.people_affected >= 5

  const risk_level = isLifeRisk ? 1 : isSevere ? 2 : payload.people_affected >= 2 ? 3 : 4
  const colorMap: Record<number, TriageOutput['risk_color']> = {
    1: 'RED', 2: 'ORANGE', 3: 'YELLOW', 4: 'GREEN', 5: 'BLUE',
  }

  return {
    title:      `[DEV] ${payload.description.split(' ').slice(0, 5).join(' ')}`,
    risk_level,
    risk_color: colorMap[risk_level],
    reason:     `[DEV BYPASS] Mock classification based on keyword heuristics — not AI-generated.`,
  }
}

// ── AI classification ─────────────────────────────────────────────────────────

/**
 * Classifies an emergency report using generateText + Output.object().
 * Only the description and people_affected are forwarded to the model —
 * all other fields were already collected by Agent 1.
 */
export async function classifyEmergency(payload: Agent1Payload): Promise<{
  output: TriageOutput
  modelUsed: string
}> {
  // Dev bypass — skips AI Gateway for local testing
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AI === 'true') {
    console.log('[triage] DEV BYPASS active — using mock classification')
    return { output: mockClassify(payload), modelUsed: 'mock/dev-bypass' }
  }

  const context = [
    `Description: ${payload.description}`,
    `People affected: ${payload.people_affected}`,
  ].join('\n')

  const { output } = await generateText({
    model: MODEL,
    output: Output.object({ schema: TriageOutputSchema }),
    system: SYSTEM_PROMPT,
    prompt: `Classify the following emergency report:\n\n${context}`,
  })

  if (!output) throw new Error('Model returned no structured output')

  return { output, modelUsed: MODEL_ID }
}

// ── Escalation after merge ───────────────────────────────────────────────────

/**
 * Given an existing event that has just received a new duplicate report,
 * returns the updated risk_level and risk_color after applying escalation rules.
 * Life risk (RED/1) is always the ceiling — it cannot be escalated further.
 */
export function applyEscalation(existing: EmergencyReport): {
  risk_level: number
  risk_color: string
} {
  const newCount = existing.report_count + 1
  const newLevel = escalateRiskLevel(existing.risk_level, newCount)
  const newColor = RISK_LEVEL_TO_COLOR[newLevel] ?? 'RED'
  return { risk_level: newLevel, risk_color: newColor }
}
