import { NextRequest, NextResponse } from 'next/server'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')

  if (!q) {
    return NextResponse.json({ error: 'Missing q param' }, { status: 400 })
  }

  if (!MAPBOX_TOKEN) {
    return NextResponse.json({ error: 'No Mapbox token configured' }, { status: 500 })
  }

  const encoded = encodeURIComponent(q)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?limit=1&access_token=${MAPBOX_TOKEN}`

  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) {
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 502 })
  }

  const data = await res.json()
  const feature = data.features?.[0]

  if (!feature) {
    return NextResponse.json({ lat: null, lng: null })
  }

  const [lng, lat] = feature.center as [number, number]
  return NextResponse.json({ lat, lng })
}
