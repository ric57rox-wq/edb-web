/**
 * Weather auto-lookup. Browser Geolocation → Open-Meteo (free, no API key), with
 * hPa→inHg converted locally (Open-Meteo ignores pressure-unit params and always
 * returns hPa). Only ever called from an explicit "Use current location" tap, so
 * the geolocation permission prompt is user-initiated.
 */

export interface WeatherReading {
  temp?: number // °F
  windSpeed?: number // mph
  windDir?: string // compass
  humidity?: number // %
  pressure?: number // inHg
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

function degToCompass(deg?: number): string | undefined {
  if (deg == null || !Number.isFinite(deg)) return undefined
  return COMPASS[Math.round(deg / 22.5) % 16]
}

const hpaToInHg = (hpa: number) => Math.round(hpa * 0.0295299830714 * 100) / 100
const round1 = (n: number) => Math.round(n * 10) / 10

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not available on this device.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new Error(err.message)), {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 300_000,
    })
  })
}

export async function fetchCurrentWeather(): Promise<WeatherReading> {
  const pos = await getPosition()
  const { latitude, longitude } = pos.coords
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: 'temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
  })
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
  if (!res.ok) throw new Error(`Weather lookup failed (${res.status}).`)
  const json = (await res.json()) as { current?: Record<string, number> }
  const c = json.current
  if (!c) throw new Error('No weather data returned.')
  return {
    temp: c.temperature_2m != null ? round1(c.temperature_2m) : undefined,
    humidity: c.relative_humidity_2m != null ? Math.round(c.relative_humidity_2m) : undefined,
    pressure: c.surface_pressure != null ? hpaToInHg(c.surface_pressure) : undefined,
    windSpeed: c.wind_speed_10m != null ? round1(c.wind_speed_10m) : undefined,
    windDir: degToCompass(c.wind_direction_10m),
  }
}
