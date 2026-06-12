import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, AlertCircle, Calendar, BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, AreaChart, Area, Cell,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { Worker, CeiRecord } from '@/types';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const REBA_RANGES = [
  { range: '1-2',  label: 'Negligible', min: 1,  max: 2,  color: '#10B981' },
  { range: '3-4',  label: 'Low',        min: 3,  max: 4,  color: '#34D399' },
  { range: '5-6',  label: 'Medium',     min: 5,  max: 6,  color: '#FBBF24' },
  { range: '7-8',  label: 'High',       min: 7,  max: 8,  color: '#F97316' },
  { range: '9-10', label: 'Very High',  min: 9,  max: 10, color: '#EF4444' },
  { range: '11+',  label: 'Critical',   min: 11, max: 99, color: '#DC2626' },
]

export default function Analytics() {
  const [workers,  setWorkers]  = useState<Worker[]>([])
  const [records,  setRecords]  = useState<CeiRecord[]>([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('cei_records').select('*').order('shift_date', { ascending: true }),
    ])
    setWorkers((w as Worker[]) || [])
    setRecords((r as CeiRecord[]) || [])
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    await fetchAll()
    setTimeout(() => setSyncing(false), 800)
  }

  // ── Derived stats ──────────────────────────────
  const avgCEI = records.length
    ? parseFloat((records.reduce((s, r) => s + r.cei_value, 0) / records.length).toFixed(2))
    : 0

  const avgREBA = records.length
    ? parseFloat((records.reduce((s, r) => s + r.reba_score, 0) / records.length).toFixed(1))
    : 0

  const atRiskWorkers = workers.filter(wk => {
    const wRecs = records.filter(r => r.worker_id === wk.id)
    if (!wRecs.length) return false
    const last = wRecs[wRecs.length - 1]
    return last.reba_score >= 7
  }).length

  // Peak hour dari shift_date
  const hourCounts: Record<string, number> = {}
  records.forEach(r => {
    if (!r.shift_date) return
    const h = new Date(r.shift_date).getHours()
    const key = `${String(h).padStart(2, '0')}:00`
    hourCounts[key] = (hourCounts[key] || 0) + 1
  })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '--:--'

  // ── Radar: avg joint angles dari joint_angles field ──
  const jointSums: Record<string, number> = {}
  const jointCounts: Record<string, number> = {}
  records.forEach(r => {
    if (!r.joint_angles) return
    Object.entries(r.joint_angles).forEach(([k, v]) => {
      jointSums[k]   = (jointSums[k]   || 0) + (v as number)
      jointCounts[k] = (jointCounts[k] || 0) + 1
    })
  })
  const JOINT_LIMITS: Record<string, number> = {
    neck: 20, trunk: 60, shoulder: 45, elbow: 90, hip: 60, knee: 60
  }
  const radarData = Object.keys(JOINT_LIMITS).map(k => ({
    joint:   k.charAt(0).toUpperCase() + k.slice(1),
    current: jointCounts[k] ? parseFloat((jointSums[k] / jointCounts[k]).toFixed(1)) : 0,
    limit:   JOINT_LIMITS[k],
  }))

  // ── REBA distribution ──
  const rebaDistribution = REBA_RANGES.map(range => ({
    ...range,
    count: records.filter(r => r.reba_score >= range.min && r.reba_score <= range.max).length,
  }))

  // ── CEI trend per shift_date ──
  const dateCEI: Record<string, number[]> = {}
  records.forEach(r => {
    if (!r.shift_date) return
    const date = r.shift_date.slice(0, 10)
    if (!dateCEI[date]) dateCEI[date] = []
    dateCEI[date].push(r.cei_value)
  })
  const ceiTrend = Object.entries(dateCEI)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, vals]) => ({
      time:     date.slice(5), // MM-DD
      cei:      parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)),
      safeLimit: 0.8,
    }))

  // ── Worker CEI ranking ──
  const workerCEI = workers.map(wk => {
    const wRecs = records.filter(r => r.worker_id === wk.id)
    const avg   = wRecs.length
      ? parseFloat((wRecs.reduce((s, r) => s + r.cei_value, 0) / wRecs.length).toFixed(3))
      : 0
    return {
      name: wk.name.split(' ').slice(0, 2).join(' '),
      cei:  avg,
      dept: wk.position || 'Field Worker',
    }
  }).sort((a, b) => b.cei - a.cei)

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-blue-50" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-blue-50" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-72 rounded-xl bg-blue-50" />)}
      </div>
    </div>
  )

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">CEI Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Comprehensive ergonomic risk analysis · {records.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs border-blue-200 text-blue-600">
            <Calendar className="w-3 h-3 mr-1" /> All Time
          </Badge>
          <button
            onClick={handleSync}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.div>

      {/* Top Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'Avg CEI',
            value: avgCEI,
            sub:   `Skala 0–1, batas >0.8`,
            color: avgCEI >= 0.8 ? 'text-red-500' : avgCEI >= 0.6 ? 'text-amber-500' : 'text-emerald-500',
            icon:  TrendingUp,
            bg:    'bg-amber-50', iconColor: 'text-amber-500',
          },
          {
            label: 'Workers at Risk',
            value: atRiskWorkers,
            sub:   `dari ${workers.length} total pekerja`,
            color: 'text-slate-800',
            icon:  AlertCircle,
            bg:    'bg-red-50', iconColor: 'text-red-500',
          },
          {
            label: 'Avg REBA Score',
            value: avgREBA,
            sub:   `Skala 1–15`,
            color: avgREBA >= 7 ? 'text-red-500' : avgREBA >= 4 ? 'text-amber-500' : 'text-emerald-500',
            icon:  BarChart3,
            bg:    'bg-blue-50', iconColor: 'text-blue-500',
          },
        ].map((s, i) => (
          <Card key={i} className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
              </div>
              <div className={`p-3 rounded-xl ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Radar: Joint Stress Profile */}
        <motion.div variants={itemVariants}>
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Joint Stress Profile</CardTitle>
              <p className="text-xs text-slate-400">Avg angle vs safety limit per joint</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="joint" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Radar name="Avg Current" dataKey="current" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} strokeWidth={2} />
                  <Radar name="Safety Limit" dataKey="limit" stroke="#10B981" fill="#10B981" fillOpacity={0.1} strokeWidth={1.5} strokeDasharray="4 4" />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        {/* REBA Distribution */}
        <motion.div variants={itemVariants}>
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">REBA Risk Distribution</CardTitle>
              <p className="text-xs text-slate-400">Jumlah records per kategori risiko</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={rebaDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {rebaDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CEI Trend */}
        <motion.div variants={itemVariants}>
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">CEI Trend per Shift Date</CardTitle>
              <p className="text-xs text-slate-400">Rata-rata CEI harian · 8 hari terakhir</p>
            </CardHeader>
            <CardContent>
              {ceiTrend.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-slate-400">
                  Tidak ada data trend tersedia.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={ceiTrend}>
                    <defs>
                      <linearGradient id="ceiGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} domain={[0, 1]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E2E8F0' }} />
                    <Area type="monotone" dataKey="cei"      stroke="#3B82F6" strokeWidth={2} fill="url(#ceiGradient)" name="Avg CEI" />
                    <Area type="monotone" dataKey="safeLimit" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="5 5" fill="none" name="Safe Limit (0.8)" />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Worker CEI Ranking */}
        <motion.div variants={itemVariants}>
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Worker CEI Ranking</CardTitle>
              <p className="text-xs text-slate-400">Rata-rata CEI per pekerja — tertinggi ke terendah</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workerCEI.map((worker, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        i === 0 ? 'bg-red-100 text-red-600' :
                        i === 1 ? 'bg-orange-100 text-orange-600' :
                        i === 2 ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{worker.name}</p>
                        <p className="text-[10px] text-slate-400">{worker.dept}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${
                            worker.cei >= 0.8 ? 'bg-red-400' :
                            worker.cei >= 0.6 ? 'bg-amber-400' :
                            'bg-emerald-400'
                          }`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(worker.cei * 100, 100)}%` }}
                          transition={{ duration: 0.8, delay: i * 0.05 }}
                        />
                      </div>
                      <span className={`text-xs font-mono font-semibold ${
                        worker.cei >= 0.8 ? 'text-red-600' :
                        worker.cei >= 0.6 ? 'text-amber-600' :
                        'text-emerald-600'
                      }`}>
                        {worker.cei}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

      </div>
    </motion.div>
  )
}