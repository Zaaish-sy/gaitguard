import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Info, ZoomIn, ZoomOut, RotateCcw, RefreshCw, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/lib/supabase';
import type { Worker, CeiRecord } from '@/types';

interface JointNode {
  id: string;
  name: string;
  x: number;
  y: number;
  stress: number;
}

const BASE_NODES: Omit<JointNode, 'stress'>[] = [
  { id: 'neck',       name: 'Neck',        x: 200, y: 40  },
  { id: 'l-shoulder', name: 'L Shoulder',  x: 160, y: 70  },
  { id: 'r-shoulder', name: 'R Shoulder',  x: 240, y: 70  },
  { id: 'l-elbow',    name: 'L Elbow',     x: 130, y: 120 },
  { id: 'r-elbow',    name: 'R Elbow',     x: 270, y: 120 },
  { id: 'l-wrist',    name: 'L Wrist',     x: 110, y: 160 },
  { id: 'r-wrist',    name: 'R Wrist',     x: 290, y: 160 },
  { id: 'trunk',      name: 'Lower Back',  x: 200, y: 110 },
  { id: 'l-hip',      name: 'L Hip',       x: 175, y: 155 },
  { id: 'r-hip',      name: 'R Hip',       x: 225, y: 155 },
  { id: 'l-knee',     name: 'L Knee',      x: 165, y: 230 },
  { id: 'r-knee',     name: 'R Knee',      x: 235, y: 230 },
  { id: 'l-ankle',    name: 'L Ankle',     x: 160, y: 300 },
  { id: 'r-ankle',    name: 'R Ankle',     x: 240, y: 300 },
];

// Map joint_angles keys ke node IDs
const JOINT_MAP: Record<string, string[]> = {
  neck:     ['neck'],
  shoulder: ['l-shoulder', 'r-shoulder'],
  elbow:    ['l-elbow', 'r-elbow'],
  trunk:    ['trunk'],
  hip:      ['l-hip', 'r-hip'],
  knee:     ['l-knee', 'r-knee'],
};

const JOINT_LIMITS: Record<string, number> = {
  neck: 20, shoulder: 45, elbow: 90, trunk: 60, hip: 60, knee: 60,
};

function angleToStress(joint: string, angle: number): number {
  const limit = JOINT_LIMITS[joint] ?? 60;
  return Math.min(Math.round((angle / (limit * 1.5)) * 100), 100);
}

function getStressColor(s: number) {
  if (s >= 80) return '#EF4444';
  if (s >= 60) return '#F97316';
  if (s >= 40) return '#FBBF24';
  if (s >= 20) return '#34D399';
  return '#10B981';
}

function getStressLabel(s: number) {
  if (s >= 80) return 'Critical';
  if (s >= 60) return 'High';
  if (s >= 40) return 'Moderate';
  if (s >= 20) return 'Low';
  return 'Minimal';
}

export default function Heatmap() {
  const [workers,       setWorkers]       = useState<Worker[]>([]);
  const [workerId,      setWorkerId]      = useState('all');
  const [jointNodes,    setJointNodes]    = useState<JointNode[]>(BASE_NODES.map(n => ({ ...n, stress: 0 })));
  const [selectedJoint, setSelectedJoint] = useState<JointNode | null>(null);
  const [zoom,          setZoom]          = useState(1);
  const [modulator,     setModulator]     = useState([100]);
  const [loading,       setLoading]       = useState(true);
  const [syncing,       setSyncing]       = useState(false);

  useEffect(() => {
    supabase.from('workers').select('*').then(({ data }) => {
      setWorkers((data as Worker[]) || []);
    });
  }, []);

  useEffect(() => { fetchHeatmap(); }, [workerId]);

  async function fetchHeatmap() {
    setSyncing(true);
    let q = supabase
      .from('cei_records')
      .select('joint_angles, reba_score')
      .not('joint_angles', 'is', null);
    if (workerId !== 'all') q = q.eq('worker_id', workerId);
    const { data } = await q;

    if (!data || data.length === 0) {
      setJointNodes(BASE_NODES.map(n => ({ ...n, stress: 0 })));
      setLoading(false);
      setSyncing(false);
      return;
    }

    // Rata-rata angle per joint key
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    type HeatmapRow = { joint_angles: Record<string, number> | null; reba_score: number }
    data.forEach((row: HeatmapRow) => {
      if (!row.joint_angles) return;
      Object.entries(row.joint_angles).forEach(([k, v]) => {
        sums[k]   = (sums[k]   || 0) + (v as number);
        counts[k] = (counts[k] || 0) + 1;
      });
    });

    // Map ke stress per node
    const stressMap: Record<string, number> = {};
    Object.entries(JOINT_MAP).forEach(([joint, nodeIds]) => {
      const avg = counts[joint] ? sums[joint] / counts[joint] : 0;
      const stress = angleToStress(joint, avg);
      nodeIds.forEach(id => { stressMap[id] = stress; });
    });

    // Wrist tidak ada di joint_angles → set 20% default
    ['l-wrist', 'r-wrist', 'l-ankle', 'r-ankle'].forEach(id => {
      if (!(id in stressMap)) stressMap[id] = 15;
    });

    setJointNodes(BASE_NODES.map(n => ({ ...n, stress: stressMap[n.id] ?? 0 })));
    setLoading(false);
    setSyncing(false);
  }

  const adjustedNodes = jointNodes.map(j => ({
    ...j,
    stress: Math.min(100, Math.round((j.stress * modulator[0]) / 100)),
  }));

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
          <h1 className="text-xl font-bold text-slate-800">Stress Heatmap</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Body joint stress dari data ergonomi real · {loading ? '...' : `${adjustedNodes.length} joints`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Worker selector */}
          <div className="relative">
            <select
              value={workerId}
              onChange={e => { setWorkerId(e.target.value); setSelectedJoint(null); }}
              className="appearance-none text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Semua Pekerja</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <Button variant="outline" size="icon" onClick={() => { setSyncing(true); fetchHeatmap(); }}>
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(z + 0.1, 1.5))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setZoom(1); setModulator([100]); }}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap Visualization */}
        <div className="lg:col-span-2">
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <CardTitle className="text-sm font-semibold">Body Heat Distribution</CardTitle>
                  {syncing && <Badge className="bg-blue-100 text-blue-600 text-[9px]">Updating...</Badge>}
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  {[['Low','emerald'],['Mod','amber'],['High','orange'],['Crit','red']].map(([l, c]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full bg-${c}-400`} />
                      <span className="text-slate-500">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <svg
                  width={400 * zoom}
                  height={360 * zoom}
                  viewBox="0 0 400 360"
                  className="transition-all duration-200"
                >
                  <defs>
                    <radialGradient id="bodyGrad" cx="50%" cy="40%" r="50%">
                      <stop offset="0%" stopColor="#F8FAFC" />
                      <stop offset="100%" stopColor="#F1F5F9" />
                    </radialGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Body outline */}
                  <ellipse cx="200" cy="180" rx="70" ry="140" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1.5" />
                  <circle cx="200" cy="50" r="28" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1.5" />
                  <rect x="155" y="75" width="90" height="100" rx="20" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1.5" />
                  <rect x="165" y="170" width="70" height="50" rx="15" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1.5" />
                  <rect x="160" y="215" width="35" height="80" rx="10" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1.5" />
                  <rect x="205" y="215" width="35" height="80" rx="10" fill="url(#bodyGrad)" stroke="#E2E8F0" strokeWidth="1.5" />

                  {/* Heat zones */}
                  {adjustedNodes.map(joint => (
                    <circle
                      key={joint.id}
                      cx={joint.x} cy={joint.y}
                      r={12 + (joint.stress / 100) * 18}
                      fill={getStressColor(joint.stress)}
                      opacity={0.25}
                      className="pointer-events-none"
                    />
                  ))}

                  {/* Joint nodes */}
                  {adjustedNodes.map(joint => (
                    <g key={joint.id} className="cursor-pointer" onClick={() => setSelectedJoint(joint)}>
                      <circle
                        cx={joint.x} cy={joint.y}
                        r={joint.stress >= 80 ? 7 : joint.stress >= 60 ? 6 : 5}
                        fill={getStressColor(joint.stress)}
                        stroke="white" strokeWidth="2"
                        filter={joint.stress >= 60 ? 'url(#glow)' : undefined}
                      />
                      {joint.stress >= 60 && (
                        <circle cx={joint.x} cy={joint.y} r={10}
                          fill="none" stroke={getStressColor(joint.stress)}
                          strokeWidth="1" opacity="0.5"
                        >
                          <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                        </circle>
                      )}
                    </g>
                  ))}

                  {/* Labels */}
                  {adjustedNodes.filter(j => j.stress >= 60).map(joint => (
                    <text key={`label-${joint.id}`}
                      x={joint.x + 12} y={joint.y - 8}
                      fontSize="9" fill={getStressColor(joint.stress)} fontWeight="600"
                    >
                      {joint.name}
                    </text>
                  ))}
                </svg>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="space-y-4">
          {/* Stress Modulator */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Stress Modulator</CardTitle>
              <p className="text-xs text-slate-400">Simulate stress levels</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-slate-500">Intensity</span>
                  <span className="text-xs font-mono font-semibold text-blue-600">{modulator[0]}%</span>
                </div>
                <Slider value={modulator} onValueChange={setModulator} min={50} max={150} step={5} />
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-600 leading-relaxed">
                  Data stress dihitung dari rata-rata joint angles di database. Modulator untuk simulasi skenario.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Joint Detail */}
          {selectedJoint ? (
            <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{selectedJoint.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Stress Level</span>
                  <Badge style={{
                    backgroundColor: `${getStressColor(selectedJoint.stress)}20`,
                    color: getStressColor(selectedJoint.stress),
                    border: `1px solid ${getStressColor(selectedJoint.stress)}40`,
                  }}>
                    {getStressLabel(selectedJoint.stress)}
                  </Badge>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: getStressColor(selectedJoint.stress) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${selectedJoint.stress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-lg font-bold text-slate-700">{selectedJoint.stress}%</p>
                    <p className="text-[10px] text-slate-400">Stress Index</p>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50">
                    <p className="text-lg font-bold" style={{ color: getStressColor(selectedJoint.stress) }}>
                      {getStressLabel(selectedJoint.stress)}
                    </p>
                    <p className="text-[10px] text-slate-400">Category</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <Flame className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Klik joint node untuk lihat detail</p>
              </CardContent>
            </Card>
          )}

          {/* Summary dari data real */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Heatmap Summary</CardTitle>
              <p className="text-xs text-slate-400">Berdasarkan data Supabase</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Critical Zones', count: adjustedNodes.filter(j => j.stress >= 80).length, color: 'text-red-500' },
                { label: 'High Stress',    count: adjustedNodes.filter(j => j.stress >= 60 && j.stress < 80).length, color: 'text-orange-500' },
                { label: 'Moderate',       count: adjustedNodes.filter(j => j.stress >= 40 && j.stress < 60).length, color: 'text-amber-500' },
                { label: 'Low/Minimal',    count: adjustedNodes.filter(j => j.stress < 40).length, color: 'text-emerald-500' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <span className={`text-sm font-bold ${item.color}`}>{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}