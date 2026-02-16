'use client'

import { useEffect, useRef } from 'react'

interface LocationMapProps {
  latitude: number
  longitude: number
  locationName: string
  deviceName: string
  installedAt?: string
}

function LocationMap({ 
  latitude, 
  longitude, 
  locationName, 
  deviceName,
  installedAt 
}: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)

  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return

    // Load Leaflet dynamically
    const loadLeaflet = async () => {
      // Add Leaflet CSS
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id = 'leaflet-css'
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
        link.crossOrigin = ''
        document.head.appendChild(link)
      }

      // Load Leaflet library from CDN
      if (!(window as any).L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
          script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
          script.crossOrigin = ''
          script.onload = resolve
          script.onerror = reject
          document.head.appendChild(script)
        })
      }

      const L = (window as any).L

      if (!L || !mapRef.current) return

      // Clean up existing map
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
      }

      // Create map centered on the location
      const map = L.map(mapRef.current).setView([latitude, longitude], 13)

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // Add marker with popup
      const popupContent = `
        <div style="min-width: 150px;">
          <strong style="font-size: 14px;">${deviceName}</strong><br/>
          <span style="color: #666; font-size: 12px;">${locationName}</span>
          ${installedAt ? `<br/><span style="color: #666; font-size: 11px;">📍 ${installedAt}</span>` : ''}
        </div>
      `
      
      L.marker([latitude, longitude])
        .addTo(map)
        .bindPopup(popupContent)
        .openPopup()

      leafletMapRef.current = map

      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => {
        map.invalidateSize()
      }, 100)
    }

    loadLeaflet()

    // Cleanup on unmount
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  }, [latitude, longitude, locationName, deviceName, installedAt])

  return (
    <div 
      ref={mapRef} 
      className="h-[300px] w-full rounded-lg overflow-hidden border border-border"
      style={{ zIndex: 0 }}
    />
  )
}

export default LocationMap
