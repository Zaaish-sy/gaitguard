import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode, CheckCircle2, XCircle,
  Clock, User, Play, Square, History,
  Camera, WifiOff, RefreshCw, Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import type { ActiveSession, ScanLog } from '@/types';

const RPI_URL     = import.meta.env.VITE_RPI_URL     || 'http://10.185.142.21:5000';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function Scan() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [scanLogs,      setScanLogs]      = useState<ScanLog[]>([]);
  const [rpiOnline,     setRpiOnline]     = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [actionMsg,     setActionMsg]     = useState('');
  const [showStream,    setShowStream]    = useState(false);
  const [streamError,   setStreamError]  = useState(false);

  // ── Ping RPi4 (/landmarks ringan, tidak minta video) ──────────────────
  const pingRPi = useCallback(async () => {
    try {
      const res = await fetch(`${RPI_URL}/landmarks`, {
        signal: AbortSignal.timeout(2000),
      });
      setRpiOnline(res.ok);
      if (res.ok) setStreamError(false);
    } catch {
      setRpiOnline(false);
    }
  }, []);

  // ── Fetch data Supabase ───────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [{ data: sessions }, { data: logs }] = await Promise.all([
      supabase.from('active_sessions')
        .select('*').eq('is_active', true)
        .order('scanned_at', { ascending: false }).limit(1),
      supabase.from('scan_logs')
        .select('*').order('scanned_at', { ascending: false }).limit(15),
    ]);
    setActiveSession((sessions as ActiveSession[])?.[0] ?? null);
    setScanLogs((logs as ScanLog[]) || []);
    setLoading(false);
  }, []);

  // ── Polling setiap 3 detik (Supabase) + 5 detik (RPi ping) ───────────
  useEffect(() => {
    fetchAll();
    pingRPi();
    const supabaseId = setInterval(fetchAll, 3000);
    const pingId     = setInterval(pingRPi, 5000);
    return () => { clearInterval(supabaseId); clearInterval(pingId); };
  }, [fetchAll, pingRPi]);

  // ── End session via FastAPI backend ──────────────────────────────────
  async function endSession() {
    try {
      await fetch(`${BACKEND_URL}/scan/end-session`, {
        method: 'POST',
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // fallback: update langsung ke Supabase
      await supabase.from('active_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('is_active', true);
    }
    setActiveSession(null);
    setActionMsg('Sesi diakhiri.');
    setTimeout(() => setActionMsg(''), 3000);
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  const completedCount = scanLogs.filter(l => l.status === 'success').length;
  const failedCount    = scanLogs.filter(l => l.status !== 'success').length;

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
          <h1 className="text-xl font-bold text-slate-800">Worker Scan</h1>
          <p className="text-sm text-slate-500 mt-0.5">QR-based session management · Supabase + RPi4</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={rpiOnline
            ? 'bg-emerald-100 text-emerald-600 border-0'
            : 'bg-red-100 text-red-500 border-0'
          }>
            {rpiOnline
              ? <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />RPi4 Online</>
              : <><WifiOff className="w-3 h-3 mr-1" />RPi4 Offline</>}
          </Badge>
          <Button variant="outline" size="icon" onClick={() => { fetchAll(); pingRPi(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Toast */}
      {actionMsg && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
          {actionMsg}
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { value: activeSession ? 1 : 0, label: 'Active Sessions', color: 'text-blue-600' },
          { value: completedCount, label: 'Successful Scans',        color: 'text-emerald-600' },
          { value: failedCount,    label: 'Failed',                  color: 'text-red-500' },
        ].map(({ value, label, color }) => (
          <Card key={label} className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-[10px] text-slate-500 mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Scanner Panel */}
        <div className="space-y-4">
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-sm font-semibold">QR Scanner</CardTitle>
                <Badge variant="outline" className="ml-auto text-[10px] border-slate-200">
                  Logitech + RPi4
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {/* Scanner Viewport */}
              <div className="relative aspect-square max-w-sm mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-xl overflow-hidden flex items-center justify-center">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                  backgroundSize: '30px 30px',
                }} />

                {/* Corner brackets */}
                <div className="absolute inset-8 border-2 border-blue-400/40 rounded-lg pointer-events-none">
                  {['-top-1 -left-1 border-t-2 border-l-2 rounded-tl-lg',
                    '-top-1 -right-1 border-t-2 border-r-2 rounded-tr-lg',
                    '-bottom-1 -left-1 border-b-2 border-l-2 rounded-bl-lg',
                    '-bottom-1 -right-1 border-b-2 border-r-2 rounded-br-lg',
                  ].map((cls, i) => (
                    <div key={i} className={`absolute ${cls} w-5 h-5 border-blue-400`} />
                  ))}
                </div>

                {/* Live stream dari RPi4 */}
                {showStream && rpiOnline && !streamError ? (
                  <>
                    <img
                      src={`${RPI_URL}/stream`}
                      alt="RPi4 stream"
                      className="absolute inset-0 w-full h-full object-cover rounded-xl"
                      onError={() => setStreamError(true)}
                    />
                    {/* LIVE badge overlay */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-white text-[10px] font-semibold tracking-wide">LIVE</span>
                    </div>
                  </>
                ) : (
                  /* Idle / offline state */
                  <div className="text-center z-10 px-4">
                    {!rpiOnline ? (
                      <>
                        <XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
                        <p className="text-white text-sm font-medium">RPi4 Offline</p>
                        <p className="text-slate-400 text-xs mt-1 font-mono">{RPI_URL}</p>
                        <p className="text-slate-500 text-[10px] mt-2">Pastikan stream.py berjalan di RPi4</p>
                      </>
                    ) : streamError ? (
                      <>
                        <Radio className="w-14 h-14 text-amber-400 mx-auto mb-3" />
                        <p className="text-white text-sm font-medium">Stream Error</p>
                        <p className="text-slate-400 text-xs mt-1">Gagal load video dari RPi4</p>
                      </>
                    ) : (
                      <>
                        <QrCode className="w-16 h-16 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400 text-sm">RPi4 online & siap</p>
                        <p className="text-slate-500 text-xs mt-1">Klik "Lihat Stream" untuk melihat kamera</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="flex justify-center gap-2 mt-4">
                {rpiOnline ? (
                  showStream ? (
                    <Button onClick={() => setShowStream(false)} variant="outline" className="border-slate-200">
                      <Square className="w-4 h-4 mr-1.5" /> Sembunyikan Stream
                    </Button>
                  ) : (
                    <Button onClick={() => { setShowStream(true); setStreamError(false); }}
                      className="bg-blue-500 hover:bg-blue-600">
                      <Play className="w-4 h-4 mr-1.5" /> Lihat Stream
                    </Button>
                  )
                ) : (
                  <Button disabled className="bg-slate-200 text-slate-400 cursor-not-allowed">
                    <WifiOff className="w-4 h-4 mr-1.5" /> RPi4 Offline
                  </Button>
                )}
              </div>

              {/* How it works */}
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 space-y-2">
                {[
                  '01 · Buka Flutter app → halaman QR Worker',
                  '02 · Arahkan QR ke kamera Logitech di RPi4',
                  '03 · Sistem decode & set active session',
                  '04 · CEI mulai diakumulasi untuk shift ini',
                ].map((s, i) => (
                  <p key={i} className="text-[11px] text-blue-700">{s}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sessions & History */}
        <div className="space-y-4">
          {/* Active Session */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Active Session</CardTitle>
                {activeSession && (
                  <Badge className="ml-auto bg-emerald-100 text-emerald-600 text-[10px] animate-pulse">
                    LIVE
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-24 rounded-lg bg-slate-50 animate-pulse" />
              ) : activeSession ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-100 bg-emerald-50/30">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-600 text-sm">
                    {getInitials(activeSession.worker_name)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{activeSession.worker_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{activeSession.shift_info || 'Shift aktif'}</p>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 mt-0.5">
                      <Clock className="w-3 h-3" /> {formatTime(activeSession.scanned_at)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-red-500 hover:text-red-600"
                    onClick={endSession}>
                    <Square className="w-3 h-3 mr-1" /> End
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Belum ada sesi aktif</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Scan QR untuk memulai</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan History */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-500" />
                <CardTitle className="text-sm font-semibold">Scan History</CardTitle>
                <span className="ml-auto text-[10px] text-slate-400">15 terbaru</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {scanLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada riwayat scan.</p>
                ) : scanLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      {log.status === 'success'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <XCircle className="w-4 h-4 text-red-400" />}
                      <div>
                        <p className="text-sm text-slate-700">{log.worker_name}</p>
                        <p className="text-[10px] text-slate-400">{log.shift_info || '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 font-mono">{formatTime(log.scanned_at)}</p>
                      <Badge className={`text-[9px] h-4 mt-0.5 ${
                        log.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                      }`}>{log.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}