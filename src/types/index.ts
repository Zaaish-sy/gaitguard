// ─── Tipe utama GaitGuard ─────────────────────────────────────────────────
// Sinkron dengan tabel Supabase & pydantic models di FastAPI backend

export interface Worker {
  id:        string
  name:      string
  position:  string | null
  device_id: string | null
}

export interface CeiRecord {
  id:               string
  worker_id:        string
  reba_score:       number
  cei_value:        number
  shift_date:       string
  timestamp_device: string | null
  joint_angles:     Record<string, number> | null
}

export interface ActiveSession {
  id:          string
  worker_id:   string
  worker_name: string
  shift_info:  string
  scanned_at:  string
  is_active:   boolean
  ended_at:    string | null
}

export interface ScanLog {
  id:          string
  worker_id:   string
  worker_name: string
  shift_info:  string
  scanned_at:  string
  scan_source: string
  status:      string
}