import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import {
  Users, AlertTriangle, ShieldCheck,
  TrendingDown, Activity, ChevronRight,
  Clock, User, RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import type { Worker, CeiRecord } from '@/types';

// ── Types ──────────────────────────────────────────
interface WorkerStat extends Worker {
  avgReba: number
  avgCei: number
  lastReba: number
  status: 'danger' | 'warning' | 'safe'
}
// ────────────────────────────────────────────────────

function getStatus(reba: number): 'danger' | 'warning' | 'safe' {
  if (reba >= 8) return 'danger'
  if (reba >= 4) return 'warning'
  return 'safe'
}

function AnimatedCounter({ value, duration = 1.5 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = value / (duration * 60);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{count}</span>;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function Dashboard() {
  const navigate = useNavigate()
  const [workers,  setWorkers]  = useState<Worker[]>([])
  const [records,  setRecords]  = useState<CeiRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('cei_records')
        .select('*')
        .order('shift_date', { ascending: false }),
    ])
    setWorkers((w as Worker[]) || [])
    setRecords((r as CeiRecord[]) || [])
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    await fetchAll()
    setTimeout(() => setSyncing(false), 1000)
  }

  // Derived stats
  const workerStats: WorkerStat[] = workers.map(wk => {
    const wRecs  = records.filter(r => r.worker_id === wk.id)
    const avgReba = wRecs.length ? wRecs.reduce((s, r) => s + r.reba_score, 0) / wRecs.length : 0
    const avgCei  = wRecs.length ? wRecs.reduce((s, r) => s + r.cei_value,  0) / wRecs.length : 0
    const latest  = wRecs[0]
    return {
      ...wk,
      avgReba:  parseFloat(avgReba.toFixed(1)),
      avgCei:   parseFloat(avgCei.toFixed(2)),
      lastReba: latest?.reba_score ?? 0,
      status:   getStatus(latest?.reba_score ?? 0),
    }
  })

  const totalWorkers = workerStats.length
  const avgRebaAll   = totalWorkers
    ? parseFloat((workerStats.reduce((s, w) => s + w.avgReba, 0) / totalWorkers).toFixed(1))
    : 0
  const safeRate     = totalWorkers
    ? parseFloat(((workerStats.filter(w => w.status === 'safe').length / totalWorkers) * 100).toFixed(1))
    : 0
  const dangerCount  = workerStats.filter(w => w.status === 'danger').length

  const stats = [
    { label: 'Active Workers',   value: totalWorkers, change: `${totalWorkers} terdaftar`, icon: Users,         color: 'blue' },
    { label: 'High Risk Alerts', value: dangerCount,  change: `REBA ≥ 8`,                 icon: AlertTriangle, color: 'red' },
    { label: 'Safe Posture Rate',value: safeRate,     change: `${safeRate}% aman`,         icon: ShieldCheck,   color: 'emerald', isPercent: true },
    { label: 'Avg REBA Score',   value: avgRebaAll,   change: `Skala 1–15`,               icon: TrendingDown,  color: 'amber' },
  ]

  // Recent high-risk alerts
  const postureAlerts = records
    .filter(r => r.reba_score >= 7)
    .slice(0, 3)
    .map(r => {
      const wk  = workers.find(w => w.id === r.worker_id)
      const sev = r.reba_score >= 10 ? 'critical' : 'warning'
      return {
        id:       r.id,
        worker:   wk?.name ?? 'Unknown',
        issue:    `REBA ${r.reba_score} — High ergonomic risk detected`,
        duration: r.shift_date,
        severity: sev,
        pct:      Math.min((r.reba_score / 15) * 100, 100),
      }
    })

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-2xl bg-blue-100" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-blue-50" />)}
      </div>
    </div>
  )

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 p-6 text-white shadow-lg shadow-blue-200">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-white/20 text-white border-0 text-xs">PT Kideco</Badge>
              <Badge className="bg-white/20 text-white border-0 text-xs">Ergonomics Division</Badge>
            </div>
            <h1 className="text-2xl font-bold mb-1">Dashboard Overview</h1>
            <p className="text-blue-100 text-sm">Real-time ergonomic monitoring across all work sites</p>
          </div>
          <button
            onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} variants={itemVariants}>
            <Card className="border-blue-100/60 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {'isPercent' in stat && stat.isPercent
                        ? `${stat.value}%`
                        : <AnimatedCounter value={typeof stat.value === 'number' ? stat.value : 0} />
                      }
                    </p>
                    <p className="text-xs font-medium text-blue-500">{stat.change}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl ${
                    stat.color === 'blue'    ? 'bg-blue-50 text-blue-600' :
                    stat.color === 'red'     ? 'bg-red-50 text-red-500' :
                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' :
                    'bg-amber-50 text-amber-500'
                  }`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Worker Risk Stream */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-base font-semibold">Worker Risk Stream</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">Live</Badge>
                  <button onClick={() => navigate('/workers')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                    View all →
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {workerStats.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Tidak ada data pekerja.</p>
                ) : workerStats.map((wk) => (
                  <motion.div
                    key={wk.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50/80 hover:bg-blue-50/50 transition-colors group cursor-pointer"
                    onClick={() => navigate('/workers')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{wk.name}</p>
                        <p className="text-xs text-slate-400">{wk.position || 'Field Worker'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge className={`text-[10px] ${
                          wk.status === 'danger'  ? 'bg-red-100 text-red-600 hover:bg-red-100' :
                          wk.status === 'warning' ? 'bg-amber-100 text-amber-600 hover:bg-amber-100' :
                          'bg-emerald-100 text-emerald-600 hover:bg-emerald-100'
                        }`}>
                          {wk.status === 'danger' ? 'High' : wk.status === 'warning' ? 'Moderate' : 'Safe'}
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-1">REBA: {wk.lastReba}</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-500">CEI: {wk.avgCei}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> avg {wk.avgReba}/15
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Posture Alerts */}
        <motion.div variants={itemVariants}>
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <CardTitle className="text-base font-semibold">Posture Alerts</CardTitle>
                </div>
                <button onClick={() => navigate('/recommendations')} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
                  View guides →
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {postureAlerts.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No critical alerts</p>
                </div>
              ) : postureAlerts.map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">{alert.worker}</span>
                    <Badge className={`text-[10px] ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{alert.issue}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{alert.duration}</span>
                    <Progress value={alert.pct} className="w-20 h-1.5" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </motion.div>
  )
}