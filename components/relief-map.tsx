'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { EmergencyReport, RiskColor } from '@/lib/triage/schema'

// Mapbox is loaded via dynamic import to avoid SSR issues
let mapboxgl: typeof import('mapbox-gl') | null = null

const MARKER_COLORS: Record<RiskColor, string> = {
  RED:    '#dc2626',
  ORANGE: '#f97316',
  YELLOW: '#eab308',
  GREEN:  '#16a34a',
  BLUE:   '#3b82f6',
}

interface Props {
  reports: EmergencyReport[]
}

interface ReportWithCoords {
  report: EmergencyReport
  lat: number
  lng: number
}

// Per-session cache so we don't re-geocode on every SWR refresh
const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function resolveCoords(
  report: EmergencyReport,
): Promise<{ lat: number; lng: number } | null> {
  if (report.latitude != null && report.longitude != null) {
    return { lat: report.latitude, lng: report.longitude }
  }

  const key = report.location_text.trim().toLowerCase()
  if (geocodeCache.has(key)) return geocodeCache.get(key)!

  try {
    const res = await fetch(
      `/api/geocode?q=${encodeURIComponent(report.location_text)}`,
    )
    if (!res.ok) {
      geocodeCache.set(key, null)
      return null
    }
    const data: { lat: number | null; lng: number | null } = await res.json()
    const result =
      data.lat != null && data.lng != null
        ? { lat: data.lat, lng: data.lng }
        : null
    geocodeCache.set(key, result)
    return result
  } catch {
    geocodeCache.set(key, null)
    return null
  }
}

export function ReliefMap({ reports }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const resolvedRef = useRef<ReportWithCoords[]>([])

  const drawMarkers = useCallback(() => {
    if (!mapRef.current || !mapboxgl) return

    // Remove old markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const items = resolvedRef.current
    if (items.length === 0) return

    items.forEach(({ report, lat, lng }) => {
      const color = MARKER_COLORS[report.risk_color] ?? '#3b82f6'

      // Custom pulsing dot for active life-risk reports
      const el = document.createElement('div')
      el.className = 'relief-map-marker'
      el.style.cssText = `
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: ${color};
        border: 2px solid rgba(255,255,255,0.8);
        box-shadow: 0 0 0 0 ${color}80;
        cursor: pointer;
        ${report.is_active && report.risk_level === 1 ? 'animation: relief-pulse 1.4s ease-out infinite;' : ''}
      `

      const popup = new mapboxgl!.Popup({ offset: 16, closeButton: false })
        .setHTML(
          `<div style="font-size:12px;line-height:1.5;max-width:220px;">
             <p style="margin:0 0 4px;font-weight:700;">${report.title}</p>
             <p style="margin:0 0 2px;color:#9ca3af;">${report.location_text}</p>
             <p style="margin:0;color:${color};font-weight:600;text-transform:uppercase;font-size:11px;">
               L${report.risk_level} ${report.risk_color}
               ${report.is_active ? '· ACTIVE' : '· RESOLVED'}
             </p>
             ${report.people_affected > 0 ? `<p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">${report.people_affected} affected</p>` : ''}
           </div>`,
        )

      const marker = new mapboxgl!.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    })

    // Fit bounds to all markers
    if (items.length === 1) {
      mapRef.current.flyTo({ center: [items[0].lng, items[0].lat], zoom: 13 })
    } else {
      const bounds = new mapboxgl!.LngLatBounds()
      items.forEach(({ lat, lng }) => bounds.extend([lng, lat]))
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 14 })
    }
  }, [])

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    async function init() {
      try {
        const mb = await import('mapbox-gl')
        if (cancelled) return
        mapboxgl = mb.default as typeof import('mapbox-gl')
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

        const map = new mapboxgl.Map({
          container: containerRef.current!,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [-58.4, -34.6], // default to Buenos Aires
          zoom: 10,
          attributionControl: false,
        })

        map.on('error', () => {
          // Suppress tile / style fetch errors in iframe preview
        })

        map.addControl(new mapboxgl!.NavigationControl({ showCompass: false }), 'bottom-right')
        map.addControl(
          new mapboxgl!.AttributionControl({ compact: true }),
          'bottom-left',
        )

        mapRef.current = map
      } catch {
        // Map failed to initialize (e.g. no token) — fail silently
      }
    }

    init()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Resolve coords & draw markers when reports change
  useEffect(() => {
    if (reports.length === 0) {
      resolvedRef.current = []
      drawMarkers()
      return
    }

    Promise.all(
      reports.map(async (r) => {
        const coords = await resolveCoords(r)
        return coords ? { report: r, ...coords } : null
      }),
    ).then((results) => {
      resolvedRef.current = results.filter(Boolean) as ReportWithCoords[]
      drawMarkers()
    })
  }, [reports, drawMarkers])

  return (
    <>
      {/* Keyframe injected once */}
      <style>{`
        @keyframes relief-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.7); }
          70%  { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
          100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
        }
        .mapboxgl-popup-content {
          background: #1c1c1e !important;
          color: #f9fafb !important;
          border: 1px solid rgba(255,255,255,.12) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          box-shadow: 0 4px 20px rgba(0,0,0,.5) !important;
        }
        .mapboxgl-popup-tip { display:none !important; }
      `}</style>
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
    </>
  )
}
