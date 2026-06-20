import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Search, Plus, Pencil, Trash2,
  ShieldCheck, AlertTriangle, Filter,
  User, Calendar, Building2,
  Activity, TrendingUp, Clock, X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import type { Worker, CeiRecord } from '@/types';

// ── Types ──────────────────────────────────────────
interface WorkerStat extends Worker {
  avgReba: number
  avgCei:  number
  lastReba: number
  status: 'safe' | 'moderate' | 'high' | 'critical'
  recordCount: number
}
// ────────────────────────────────────────────────────

const DEPARTMENTS = ['All', 'Mining Unit A', 'Mining Unit B', 'Processing', 'Loading', 'Hauling']

function getStatus(reba: number): WorkerStat['status'] {
  if (reba >= 10) return 'critical'
  if (reba >= 7)  return 'high'
  if (reba >= 4)  return 'moderate'
  return 'safe'
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'safe':     return <Badge className="bg-emerald-100 text-emerald-600 hover:bg-emerald-100 text-[10px]">Safe</Badge>
    case 'moderate': return <Badge className="bg-amber-100 text-amber-600 hover:bg-amber-100 text-[10px]">Moderate</Badge>
    case 'high':     return <Badge className="bg-orange-100 text-orange-600 hover:bg-orange-100 text-[10px]">High</Badge>
    case 'critical': return <Badge className="bg-red-100 text-red-600 hover:bg-red-100 text-[10px]">Critical</Badge>
    default:         return null
  }
}

export default function Workers() {
  const [workers,   setWorkers]   = useState<Worker[]>([])
  const [records,   setRecords]   = useState<CeiRecord[]>([])
  const [search,    setSearch]    = useState('')
  const [deptFilter,setDeptFilter]= useState('All')
  const [loading,   setLoading]   = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isDelOpen, setIsDelOpen] = useState(false)
  const [delTarget, setDelTarget] = useState<string | null>(null)
  const [newWorker, setNewWorker] = useState({ name: '', device_id: '', position: '' })
  const [saving,    setSaving]    = useState(false)
  const [detailWorker, setDetailWorker] = useState<WorkerStat | null>(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: w }, { data: r }] = await Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('cei_records').select('*').order('shift_date', { ascending: false }),
    ])
    setWorkers((w as Worker[]) || [])
    setRecords((r as CeiRecord[]) || [])
    setLoading(false)
  }

  // Enrich workers dengan stats dari cei_records
  const workerStats: WorkerStat[] = workers.map(wk => {
    const wRecs   = records.filter(r => r.worker_id === wk.id)
    const avgReba = wRecs.length ? wRecs.reduce((s, r) => s + r.reba_score, 0) / wRecs.length : 0
    const avgCei  = wRecs.length ? wRecs.reduce((s, r) => s + r.cei_value,  0) / wRecs.length : 0
    const lastReba = wRecs[0]?.reba_score ?? 0
    return {
      ...wk,
      avgReba:     parseFloat(avgReba.toFixed(1)),
      avgCei:      parseFloat(avgCei.toFixed(2)),
      lastReba,
      status:      getStatus(lastReba),
      recordCount: wRecs.length,
    }
  })

  const filtered = workerStats.filter(w => {
    const q = search.toLowerCase()
    const matchSearch = w.name.toLowerCase().includes(q) ||
      (w.device_id || '').toLowerCase().includes(q) ||
      (w.position || '').toLowerCase().includes(q)
    const matchDept = deptFilter === 'All' || (w.position || '').includes(deptFilter)
    return matchSearch && matchDept
  })

  async function handleAdd() {
    if (!newWorker.name) return
    setSaving(true)
    const { error } = await supabase.from('workers').insert({
      name:      newWorker.name,
      device_id: newWorker.device_id || null,
      position:  newWorker.position  || null,
    })
    if (!error) {
      await fetchAll()
      setNewWorker({ name: '', device_id: '', position: '' })
      setIsAddOpen(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('workers').delete().eq('id', id)
    await fetchAll()
    setIsDelOpen(false)
    setDelTarget(null)
  }

  const safeCount    = workerStats.filter(w => w.status === 'safe').length
  const atRiskCount  = workerStats.filter(w => w.status === 'high' || w.status === 'critical').length
  const deptCount    = new Set(workers.map(w => w.position || 'Unassigned')).size

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-blue-50" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-blue-50" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-blue-50" />)}
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Workers Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage and monitor all personnel</p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-500 hover:bg-blue-600">
              <Plus className="w-4 h-4 mr-1.5" /> Add Worker
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Worker</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  placeholder="Enter full name"
                  value={newWorker.name}
                  onChange={e => setNewWorker({ ...newWorker, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Device ID</Label>
                <Input
                  placeholder="e.g. DEV-001"
                  value={newWorker.device_id}
                  onChange={e => setNewWorker({ ...newWorker, device_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Position / Department</Label>
                <Select onValueChange={v => setNewWorker({ ...newWorker, position: v })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.filter(d => d !== 'All').map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAdd}
                disabled={saving || !newWorker.name}
                className="w-full bg-blue-500 hover:bg-blue-600"
              >
                {saving ? 'Saving...' : 'Add Worker'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Workers', value: workers.length,  icon: Users,         color: 'blue' },
          { label: 'Safe',          value: safeCount,        icon: ShieldCheck,   color: 'emerald' },
          { label: 'At Risk',       value: atRiskCount,      icon: AlertTriangle, color: 'red' },
          { label: 'Departments',   value: deptCount,        icon: Building2,     color: 'violet' },
        ].map((stat, i) => (
          <Card key={i} className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${
                stat.color === 'blue'    ? 'bg-blue-50 text-blue-600' :
                stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' :
                stat.color === 'red'     ? 'bg-red-50 text-red-500' :
                'bg-violet-50 text-violet-500'
              }`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{stat.value}</p>
                <p className="text-[10px] text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, device ID, position..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white border-slate-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-44 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENTS.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(worker => (
          <motion.div
            key={worker.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card
              className="border-blue-100/60 shadow-sm hover:shadow-md transition-all bg-white/80 backdrop-blur-sm group cursor-pointer"
              onClick={() => setDetailWorker(worker)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-600">
                      {worker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{worker.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{worker.device_id || worker.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  {getStatusBadge(worker.status)}
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {worker.position || 'Field Worker'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {worker.recordCount} records
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-slate-400">Last REBA</p>
                    <p className={`text-sm font-bold ${
                      worker.lastReba >= 10 ? 'text-red-500' :
                      worker.lastReba >= 7  ? 'text-orange-500' :
                      worker.lastReba >= 4  ? 'text-amber-500' :
                      'text-emerald-500'
                    }`}>
                      {worker.lastReba}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Avg CEI</p>
                    <p className="text-sm font-bold text-slate-700">{worker.avgCei}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon"
                      className="w-7 h-7 text-slate-400 hover:text-blue-500"
                      onClick={(e) => { e.stopPropagation() }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="w-7 h-7 text-slate-400 hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); setDelTarget(worker.id); setIsDelOpen(true) }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No workers found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Worker detail dialog */}
      <Dialog open={!!detailWorker} onOpenChange={(open) => !open && setDetailWorker(null)}>
        <DialogContent className="sm:max-w-lg">
          {detailWorker && (() => {
            const wRecs = records
              .filter(r => r.worker_id === detailWorker.id)
              .slice(0, 10)
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-sm font-bold text-blue-600">
                      {detailWorker.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-base font-semibold text-slate-800">{detailWorker.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono font-normal">
                        {detailWorker.device_id || detailWorker.id.slice(0, 8)}
                      </p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  {/* Info dasar */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {detailWorker.position || 'Field Worker'}
                    </div>
                    <div className="flex items-center justify-end">
                      {getStatusBadge(detailWorker.status)}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-blue-50/60 p-3 text-center">
                      <Activity className="w-4 h-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-slate-800">{detailWorker.avgReba}</p>
                      <p className="text-[10px] text-slate-500">Avg REBA</p>
                    </div>
                    <div className="rounded-xl bg-violet-50/60 p-3 text-center">
                      <TrendingUp className="w-4 h-4 text-violet-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-slate-800">{detailWorker.avgCei}</p>
                      <p className="text-[10px] text-slate-500">Avg CEI</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50/60 p-3 text-center">
                      <Calendar className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                      <p className="text-lg font-bold text-slate-800">{detailWorker.recordCount}</p>
                      <p className="text-[10px] text-slate-500">Total Records</p>
                    </div>
                  </div>

                  {/* Last REBA highlight */}
                  <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <ShieldCheck className="w-4 h-4 text-slate-400" />
                      Last REBA Score
                    </div>
                    <p className={`text-lg font-bold ${
                      detailWorker.lastReba >= 10 ? 'text-red-500' :
                      detailWorker.lastReba >= 7  ? 'text-orange-500' :
                      detailWorker.lastReba >= 4  ? 'text-amber-500' :
                      'text-emerald-500'
                    }`}>
                      {detailWorker.lastReba}
                    </p>
                  </div>

                  {/* Recent records */}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Recent Records
                    </p>
                    {wRecs.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Belum ada data CEI untuk worker ini.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {wRecs.map(rec => (
                          <div
                            key={rec.id}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
                          >
                            <span className="text-slate-500">{rec.shift_date}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-600">
                                REBA <span className="font-semibold text-slate-800">{rec.reba_score}</span>
                              </span>
                              <span className="text-slate-600">
                                CEI <span className="font-semibold text-slate-800">{rec.cei_value}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => setDetailWorker(null)}>
                    <X className="w-4 h-4 mr-1.5" /> Tutup
                  </Button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={isDelOpen} onOpenChange={setIsDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Worker?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 py-2">
            Tindakan ini tidak bisa dibatalkan. Semua data CEI worker ini akan tetap tersimpan.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setIsDelOpen(false)}>Cancel</Button>
            <Button
              className="bg-red-500 hover:bg-red-600"
              onClick={() => delTarget && handleDelete(delTarget)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </motion.div>
  )
}