/**
 * Keep-alive — Netlify Scheduled Function (v2), runs daily.
 *
 * Supabase's free tier pauses a project after ~7 days of inactivity. One
 * authenticated-root request per day registers activity and keeps it awake.
 * (Netlify static hosting never sleeps, so this is purely for Supabase.)
 *
 * We hit the REST ROOT (`/rest/v1/`) rather than a table: with RLS on, an
 * unauthenticated table query is denied, but the API root returns 200 with just
 * the anon key and still counts as project activity. Internal pg_cron does NOT
 * reliably prevent the free-tier pause — the ping must be an external request.
 *
 * Env: reuses the app's VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (already set
 * on Netlify for the client build); falls back to unprefixed names.
 */

export default async (): Promise<Response> => {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    return new Response('Supabase env vars not set (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).', {
      status: 500,
    })
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, { headers: { apikey: key } })
    return new Response(`Keep-alive ping → ${res.status}`, { status: 200 })
  } catch (err) {
    return new Response(`Keep-alive request failed: ${String(err)}`, { status: 502 })
  }
}

// Daily cron (UTC). Netlify reads this exported config to schedule the function.
export const config = { schedule: '@daily' }
