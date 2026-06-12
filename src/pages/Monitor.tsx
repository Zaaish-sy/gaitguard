import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Camera, Play, Square, RotateCcw,
  Activity, TrendingUp, Layers, Maximize2,
  WifiOff, ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { RPI_URL } from '@/lib/supabase';
import type { Worker } from '@/types';

const RPI_BASE      = import.meta.env.VITE_RPI_URL ?? 'http://172.22.145.21:5000'
const LANDMARKS_URL = `${RPI_BASE}/landmarks`
const STREAM_URL    = `${RPI_BASE}/stream`

interface TelemetryLog {
  time:       string
  event:      string
  confidence: number
}

function calcReba(neck: number, trunk: number, shoulder: number, knee: number): number {
  let s = 1
  if (neck     > 20) s += 3; else if (neck     > 10) s += 2; else if (neck     > 0) s += 1
  if (trunk    > 60) s += 4; else if (trunk    > 30) s += 3; else if (trunk    > 15) s += 2
  if (shoulder > 90) s += 4; else if (shoulder > 45) s += 3; else if (shoulder > 20) s += 2
  if (knee     > 60) s += 3; else if (knee     > 30) s += 2; else if (knee     > 0) s += 1
  return Math.min(s, 15)
}

export default function Monitor() {
  const [workers,      setWorkers]      = useState<Worker[]>([])
  const [workerId,     setWorkerId]     = useState<string>('')
  const [isStreaming,  setIsStreaming]  = useState(false)
  const [streamOnline, setStreamOnline] = useState(false)
  const [angles,       setAngles]       = useState({ neck: 0, trunk: 0, shoulder: 0, knee: 0, hip: 0, elbow: 0 })
  const [rebaRpi,      setRebaRpi]      = useState<number>(0)
  const [ceiRpi,       setCeiRpi]       = useState<number>(0)
  const [logs,         setLogs]         = useState<TelemetryLog[]>([
    { time: '--:--:--', event: 'GaitGuard monitor initialized', confidence: 1.0 },
    { time: '--:--:--', event: 'Connecting to RPi4 stream...', confidence: 1.0 },
  ])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    supabase.from('workers').select('*').then(({ data }) => {
      setWorkers((data as Worker[]) || [])
      if (data?.length) setWorkerId(data[0].id)
    })
  }, [])

  // Poll landmarks dari RPi4
  useEffect(() => {
    if (!isStreaming) {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    async function fetchLandmarks() {
      try {
        const res = await fetch(LANDMARKS_URL, { signal: AbortSignal.timeout(2000) })
        if (!res.ok) throw new Error('bad response')
        const data = await res.json()
        // joint_angles tersedia setelah stream.py di-patch
        const ja = data.joint_angles ?? {}
        const hasAngles = Object.keys(ja).length > 0
        setAngles({
          neck:     Math.round(ja.neck     ?? 0),
          trunk:    Math.round(ja.trunk    ?? 0),
          shoulder: Math.round(ja.shoulder ?? 0),
          knee:     Math.round(ja.knee     ?? 0),
          hip:      Math.round(ja.hip      ?? 0),
          elbow:    Math.round(ja.elbow    ?? 0),
        })
        if (data.reba_score !== undefined) setRebaRpi(Math.round(data.reba_score))
        if (data.cei_value  !== undefined) setCeiRpi(data.cei_value)
        setStreamOnline(true)
        const t = new Date().toLocaleTimeString('en-US', { hour12: false })
        const eventMsg = hasAngles
          ? `neck=${ja.neck?.toFixed(1)}° trunk=${ja.trunk?.toFixed(1)}° shld=${ja.shoulder?.toFixed(1)}° knee=${ja.knee?.toFixed(1)}°`
          : `REBA=${data.reba_score ?? 0} CEI=${(data.cei_value ?? 0).toFixed(3)}`
        setLogs(prev => [{
          time:       t,
          event:      eventMsg,
          confidence: data.cei_value ?? 0,
        }, ...prev.slice(0, 19)])
      } catch {
        setStreamOnline(false)
        const t = new Date().toLocaleTimeString('en-US', { hour12: false })
        setLogs(prev => [{ time: t, event: 'Landmark feed unreachable', confidence: 0 }, ...prev.slice(0, 19)])
      }
    }
    fetchLandmarks()
    pollRef.current = setInterval(fetchLandmarks, 1000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [isStreaming])

  // Prioritaskan reba_score dari RPi4; fallback ke kalkulasi lokal
  const reba = (isStreaming && rebaRpi > 0) ? rebaRpi : calcReba(angles.neck, angles.trunk, angles.shoulder, angles.knee)

  const rebaColor = reba >= 8 ? 'text-red-500' : reba >= 4 ? 'text-amber-500' : 'text-emerald-500'
  const rebaLabel = reba >= 8 ? 'High Risk'     : reba >= 4 ? 'Moderate Risk'  : 'Low Risk'
  const rebaBadge = reba >= 8
    ? 'bg-red-100 text-red-600'
    : reba >= 4
    ? 'bg-amber-100 text-amber-600'
    : 'bg-emerald-100 text-emerald-600'

  const selectedWorker = workers.find(w => w.id === workerId)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Skeletal Monitor</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time pose estimation · RPi4 + Logitech</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Stream status */}
          <Badge className={streamOnline && isStreaming
            ? 'bg-emerald-100 text-emerald-600 border-0'
            : 'bg-red-100 text-red-500 border-0'
          }>
            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
              streamOnline && isStreaming ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'
            }`} />
            {streamOnline && isStreaming ? 'Stream Online' : 'Stream Offline'}
          </Badge>

          {/* Worker selector */}
          <div className="relative">
            <select
              value={workerId}
              onChange={e => setWorkerId(e.target.value)}
              className="appearance-none text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-slate-700 outline-none cursor-pointer"
            >
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Video Feed */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-blue-100/60 shadow-sm overflow-hidden bg-white/80 backdrop-blur-sm">
            <CardContent className="p-0">
              <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-10" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }} />

                {/* MJPEG stream */}
                {isStreaming && (
                  <img
                    src={STREAM_URL}
                    alt="Camera stream"
                    className="absolute inset-0 w-full h-full object-cover"
                    onLoad={() => setStreamOnline(true)}
                    onError={() => setStreamOnline(false)}
                  />
                )}

                {/* Skeleton overlay dihapus — stream.py sudah render skeleton langsung di video */}

                {/* Offline state */}
                {!isStreaming && (
                  <div className="text-center z-10">
                    <Camera className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">Camera stream inactive</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {selectedWorker ? `Ready: ${selectedWorker.name}` : 'Click Start to begin monitoring'}
                    </p>
                  </div>
                )}

                {/* Stream offline overlay */}
                {isStreaming && !streamOnline && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/80 z-20">
                    <WifiOff className="w-8 h-8 text-slate-500" />
                    <p className="text-slate-400 text-xs">RPi4 unreachable · {RPI_URL}</p>
                  </div>
                )}

                {/* REC badge */}
                {isStreaming && streamOnline && (
                  <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
                    <Badge className="bg-red-500/80 text-white border-0 text-xs animate-pulse">REC</Badge>
                    <span className="text-white/70 text-xs font-mono">{selectedWorker?.name}</span>
                  </div>
                )}

                <div className="absolute bottom-3 right-3 z-20">
                  <Button variant="ghost" size="icon" className="w-8 h-8 bg-black/30 text-white hover:bg-black/50">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Controls */}
              <div className="p-3 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setIsStreaming(!isStreaming)}
                    className={isStreaming ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}
                  >
                    {isStreaming
                      ? <><Square className="w-3.5 h-3.5 mr-1.5" />Stop</>
                      : <><Play  className="w-3.5 h-3.5 mr-1.5" />Start</>
                    }
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    onClick={() => setAngles({ neck: 0, trunk: 0, shoulder: 0, knee: 0, hip: 0, elbow: 0 })}
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
                  </Button>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Telemetry Log */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm font-semibold">Telemetry Log</CardTitle>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  {isStreaming ? 'polling 1s' : 'paused'}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-slate-50">
                    <span className="text-slate-400 font-mono w-20">{log.time}</span>
                    <span className="text-slate-600 flex-1 ml-2 truncate">{log.event}</span>
                    <Badge variant="outline" className={`text-[10px] h-5 ml-2 ${
                      log.confidence === 0 ? 'border-red-100 text-red-400' : 'border-blue-100 text-blue-600'
                    }`}>
                      {log.confidence === 0 ? 'ERR' : `${(log.confidence * 100).toFixed(0)}%`}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* CEI Index */}
          {(() => {
            const cei = isStreaming && ceiRpi > 0 ? ceiRpi : 0
            const ceiPct   = Math.round(cei * 100)
            const ceiColor = cei >= 0.67 ? 'text-red-500'  : cei >= 0.33 ? 'text-amber-500'  : 'text-emerald-500'
            const ceiBar   = cei >= 0.67 ? 'bg-red-400'    : cei >= 0.33 ? 'bg-amber-400'    : 'bg-emerald-400'
            const ceiBadge = cei >= 0.67 ? 'bg-red-100 text-red-600' : cei >= 0.33 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
            const ceiLabel = cei >= 0.67 ? 'High Risk'     : cei >= 0.33 ? 'Moderate Risk'   : 'Low Risk'
            return (
              <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <CardTitle className="text-sm font-semibold">CEI Index</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-center mb-3">
                    <motion.p
                      key={ceiPct}
                      className={`text-4xl font-bold ${ceiColor}`}
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200 }}
                    >
                      {cei.toFixed(3)}
                    </motion.p>
                    <Badge className={`mt-2 ${ceiBadge}`}>{ceiLabel}</Badge>
                    <p className="text-[10px] text-slate-400 mt-1">{ceiPct}% / 100%</p>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <motion.div
                      className={`h-full rounded-full ${ceiBar}`}
                      animate={{ width: `${ceiPct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Low Risk',  range: '0.00 – 0.33', color: 'bg-emerald-400' },
                      { label: 'Moderate',  range: '0.33 – 0.67', color: 'bg-amber-400'   },
                      { label: 'High Risk', range: '0.67 – 1.00', color: 'bg-red-400'     },
                    ].map(t => (
                      <div key={t.label} className="flex items-center gap-2 text-[10px] text-slate-500">
                        <div className={`w-2 h-2 rounded-sm flex-shrink-0 ${t.color}`} />
                        <span className="flex-1">{t.label}</span>
                        <span className="font-mono text-slate-400">{t.range}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-100">
                    <TrendingUp className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] text-slate-400">
                      {isStreaming && ceiRpi > 0 ? 'Live dari RPi4' : 'Menunggu data...'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* REBA Score */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">Current REBA Score</p>
                <motion.p
                  key={reba}
                  className={`text-4xl font-bold ${rebaColor}`}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  {reba}
                </motion.p>
                <Badge className={`mt-2 ${rebaBadge}`}>{rebaLabel}</Badge>
                <div className="mt-3 flex items-center justify-center gap-1">
                  {[...Array(12)].map((_, n) => (
                    <div key={n} className={`w-2 h-3 rounded-sm ${
                      n < reba
                        ? reba >= 8 ? 'bg-red-400' : reba >= 4 ? 'bg-amber-400' : 'bg-emerald-400'
                        : 'bg-slate-200'
                    }`} />
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{reba}/15</p>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </motion.div>
  )
}