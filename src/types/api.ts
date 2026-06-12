/**
 * api.ts — GaitGuard API Client
 *
 * VITE_BACKEND_URL  = FastAPI laptop (cei, scan, alert)  default: localhost:8000
 * VITE_RPI_URL      = Flask RPi4 (video stream + landmarks)  default: 172.22.145.21:5000
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
export const RPI_URL = import.meta.env.VITE_RPI_URL || 'http://10.185.142.21:5000'

// ─── Helper ────────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit, timeoutMs = 5000): Promise<T> {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json() as Promise<T>
}

// ─── Types ────────────────────────────────────────────────────────────────

export interface JointAngles {
  neck: number; trunk: number; hip: number
  knee: number; shoulder: number; elbow: number
}

export interface CEIPayload {
  worker_id:    string
  reba_score:   number
  cei_value:    number
  timestamp?:   string
  joint_angles?: JointAngles
}

export interface AlertPayload {
  worker_id:   string
  worker_name: string
  cei_value:   number
  reba_score:  number
  fcm_token:   string
  area?:       string
}

export interface WorkerRow {
  id: string; name: string; position: string | null; device_id: string | null
}

export interface CEIRow {
  id: string; worker_id: string; reba_score: number; cei_value: number
  shift_date: string; timestamp_device: string | null
  joint_angles: Record<string, number> | null
}

export interface ActiveSessionRow {
  id: string; worker_id: string; worker_name: string
  shift_info: string; scanned_at: string
  is_active: boolean; ended_at: string | null
}

export interface ScanLogRow {
  id: string; worker_id: string; worker_name: string
  shift_info: string; scanned_at: string; scan_source: string; status: string
}

export interface LandmarksResponse {
  keypoints:  { name: string; x: number; y: number; score: number }[]
  reba_score: number
  cei_value:  number
  worker:     { id: string | null; name: string | null }
  timestamp:  number
}

// ─── /cei (FastAPI laptop) ────────────────────────────────────────────────

export const postCEI = (record: CEIPayload) =>
  apiFetch<{ status: string; data: unknown[] }>(
    `${BACKEND_URL}/cei/update`, { method: 'POST', body: JSON.stringify(record) }
  )

export const getWorkers = () =>
  apiFetch<{ status: string; data: WorkerRow[] }>(`${BACKEND_URL}/cei/workers`)

export const getCEIRecords = (worker_id?: string) => {
  const qs = worker_id ? `?worker_id=${encodeURIComponent(worker_id)}` : ''
  return apiFetch<{ status: string; data: CEIRow[] }>(`${BACKEND_URL}/cei/records${qs}`)
}

// ─── /scan (FastAPI laptop) ───────────────────────────────────────────────
// Catatan: start-session dipanggil otomatis oleh stream.py di RPi4.
// Frontend hanya perlu get_active, get_logs, end_session.

export const getActiveScan = () =>
  apiFetch<{ status: string; active: ActiveSessionRow | null }>(
    `${BACKEND_URL}/scan/active`
  )

export const getScanLogs = (limit = 20) =>
  apiFetch<{ status: string; data: ScanLogRow[] }>(
    `${BACKEND_URL}/scan/logs?limit=${limit}`
  )

export const endSession = () =>
  apiFetch<{ status: string; message: string }>(
    `${BACKEND_URL}/scan/end-session`, { method: 'POST' }
  )

// ─── /alert (FastAPI laptop) ──────────────────────────────────────────────

export const triggerAlert = (payload: AlertPayload) =>
  apiFetch<{ status: string; message: string; fcm_response?: string }>(
    `${BACKEND_URL}/alert/trigger`, { method: 'POST', body: JSON.stringify(payload) }
  )

// ─── RPi4 Flask endpoints ─────────────────────────────────────────────────

/** GET /landmarks — realtime REBA/CEI + keypoints dari pose detection */
export const getLandmarks = () =>
  apiFetch<LandmarksResponse>(`${RPI_URL}/landmarks`, {}, 2000)

/** URL stream video MJPEG — gunakan langsung sebagai src di <img> */
export const STREAM_URL = `${RPI_URL}/stream`

// ─── Health checks ────────────────────────────────────────────────────────

export const pingBackend = async (): Promise<boolean> => {
  try {
    const d = await apiFetch<{ status: string }>(`${BACKEND_URL}/`, {}, 2000)
    return d.status === 'GaitGuard API running'
  } catch { return false }
}

export const pingRPi = async (): Promise<boolean> => {
  try {
    await apiFetch(`${RPI_URL}/landmarks`, {}, 2000)
    return true
  } catch { return false }
}