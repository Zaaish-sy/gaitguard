import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Send, Loader2, User, AlertTriangle,
  CheckCircle2, Clock, Sparkles, ChevronDown, ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { GROQ_KEY } from '@/lib/supabase';
import type { Worker, CeiRecord } from '@/types';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface WorkerAlert {
  worker: string;
  issue: string;
  severity: 'critical' | 'warning';
}

const QUICK_PROMPTS = [
  'Analisis risiko punggung bawah',
  'Rekomendasi istirahat untuk tugas angkat',
  'Tips koreksi postur bahu',
  'Interpretasi REBA score tinggi',
];

const THRESHOLDS: Record<string, { warn: number; danger: number }> = {
  neck: { warn: 20, danger: 45 }, trunk: { warn: 20, danger: 60 },
  shoulder: { warn: 20, danger: 45 }, elbow: { warn: 60, danger: 100 },
  hip: { warn: 60, danger: 90 }, knee: { warn: 30, danger: 60 },
};

function getRiskLevel(joint: string, angle: number | null) {
  const t = THRESHOLDS[joint];
  if (!t || angle === null) return 'low';
  if (angle >= t.danger) return 'high';
  if (angle >= t.warn) return 'medium';
  return 'low';
}

function formatMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    if (/^\*\*\d\./.test(line) || (line.startsWith('**') && line.endsWith('**'))) {
      return <p key={i} className="font-semibold text-slate-800 mt-3 mb-1">{line.replace(/\*\*/g, '')}</p>;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return <div key={i} className="flex gap-2 ml-3 my-0.5">
        <span className="text-blue-400 mt-0.5">›</span>
        <span className="text-slate-600 text-xs leading-relaxed">{line.slice(2)}</span>
      </div>;
    }
    if (line.trim() === '') return <div key={i} className="h-1" />;
    return <p key={i} className="text-slate-600 text-xs leading-relaxed my-0.5">{line}</p>;
  });
}

export default function Recommendations() {
  const [workers,    setWorkers]    = useState<Worker[]>([]);
  const [records,    setRecords]    = useState<CeiRecord[]>([]);
  const [workerId,   setWorkerId]   = useState('all');
  const [messages,   setMessages]   = useState<Message[]>([{
    id: 0, role: 'assistant',
    content: 'Halo! Saya adalah AI ergonomic advisor untuk GaitGuard. Saya dapat menganalisis data postur, merekomendasikan intervensi, dan membantu interpretasi REBA score. Apa yang ingin Anda ketahui?',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [fetching,   setFetching]   = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('workers').select('*'),
      supabase.from('cei_records').select('*').order('shift_date', { ascending: false }),
    ]).then(([{ data: w }, { data: r }]) => {
      setWorkers((w as Worker[]) || []);
      setRecords((r as CeiRecord[]) || []);
      setFetching(false);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Hitung context data untuk AI
  function buildContext() {
    let filteredRecords = records;
    let workerName = 'semua pekerja';
    if (workerId !== 'all') {
      filteredRecords = records.filter(r => r.worker_id === workerId);
      workerName = workers.find(w => w.id === workerId)?.name || workerId;
    }

    const avgCEI = filteredRecords.length
      ? (filteredRecords.reduce((s, r) => s + r.cei_value, 0) / filteredRecords.length).toFixed(3) : '0';
    const avgREBA = filteredRecords.length
      ? (filteredRecords.reduce((s, r) => s + r.reba_score, 0) / filteredRecords.length).toFixed(1) : '0';

    const joints = Object.keys(THRESHOLDS);
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};
    filteredRecords.forEach(r => {
      if (!r.joint_angles) return;
      joints.forEach(j => {
        const v = r.joint_angles![j];
        if (v != null) { sums[j] = (sums[j] || 0) + v; counts[j] = (counts[j] || 0) + 1; }
      });
    });
    const jointSummary = joints.map(j => {
      const avg = counts[j] ? sums[j] / counts[j] : null;
      return `- ${j}: ${avg !== null ? avg.toFixed(1) + '°' : 'N/A'} (${getRiskLevel(j, avg)})`;
    }).join('\n');

    return { workerName, avgCEI, avgREBA, jointSummary, recordCount: filteredRecords.length };
  }

  async function handleSend(text: string) {
    if (!text.trim() || loading) return;
    const ctx = buildContext();
    const userMsg: Message = {
      id: messages.length, role: 'user', content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const systemPrompt = `Kamu adalah AI safety advisor untuk sistem monitoring ergonomi pekerja tambang batu bara PT Kideco (GaitGuard).

Konteks data saat ini (${ctx.workerName}, ${ctx.recordCount} records):
- CEI rata-rata: ${ctx.avgCEI} (skala 0–1, >0.8 = high risk)
- REBA rata-rata: ${ctx.avgREBA} (skala 1–15, >7 = high risk)
- Sudut sendi rata-rata:
${ctx.jointSummary}

Berikan jawaban dalam Bahasa Indonesia yang praktis dan actionable untuk supervisor lapangan. Gunakan format yang jelas dengan poin-poin konkret.`;

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 800,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.slice(1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
        }),
      });
      const json = await res.json();
      const reply = json.choices?.[0]?.message?.content || 'Maaf, tidak ada respons dari AI.';
      setMessages(prev => [...prev, {
        id: prev.length, role: 'assistant', content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: prev.length, role: 'assistant',
        content: 'Error: Gagal menghubungi Groq AI. Periksa koneksi dan GROQ_API_KEY.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    }
    setLoading(false);
  }

  // Priority alerts dari records terbaru REBA >= 7
  const priorityAlerts: WorkerAlert[] = records
    .filter(r => r.reba_score >= 7)
    .slice(0, 4)
    .map(r => {
      const wk = workers.find(w => w.id === r.worker_id);
      return {
        worker: wk?.name ?? 'Unknown',
        issue: `REBA ${r.reba_score} — ${r.reba_score >= 10 ? 'Risiko sangat tinggi' : 'Risiko tinggi, perlu tindakan'}`,
        severity: r.reba_score >= 10 ? 'critical' : 'warning' as const,
      };
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col space-y-4" style={{ height: 'calc(100vh - 7rem)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Action Guides</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI-powered ergonomic recommendations · Groq LLaMA 3.3</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Worker filter */}
          <div className="relative">
            <select
              value={workerId}
              onChange={e => setWorkerId(e.target.value)}
              disabled={fetching}
              className="appearance-none text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Semua Pekerja</option>
              {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <Badge className="bg-violet-100 text-violet-600 border-0">
            <Sparkles className="w-3 h-3 mr-1" /> Groq AI
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Chat Area */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm flex flex-col flex-1 min-h-0">
            <CardContent className="p-0 flex flex-col flex-1 min-h-0">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div ref={scrollRef} className="space-y-4">
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.role === 'user'
                          ? 'bg-blue-500'
                          : 'bg-gradient-to-br from-violet-500 to-purple-600'
                      }`}>
                        {msg.role === 'user'
                          ? <User className="w-4 h-4 text-white" />
                          : <Sparkles className="w-4 h-4 text-white" />}
                      </div>
                      <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-blue-500 text-white rounded-tr-sm'
                            : 'bg-slate-100 text-slate-700 rounded-tl-sm'
                        }`}>
                          {msg.role === 'assistant'
                            ? <div className="space-y-0.5">{formatMarkdown(msg.content)}</div>
                            : msg.content}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {msg.timestamp}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-slate-100 rounded-2xl rounded-tl-sm p-3">
                        <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </ScrollArea>

              {/* Quick Prompts */}
              {messages.length === 1 && !loading && (
                <div className="px-4 pb-2">
                  <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide">Quick prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS.map(p => (
                      <Button key={p} variant="outline" size="sm"
                        className="text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                        onClick={() => handleSend(p)}
                      >{p}</Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t border-slate-100">
                <div className="flex gap-2">
                  <Input
                    placeholder="Tanya tentang postur, REBA, atau rekomendasi..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend(input)}
                    className="flex-1 bg-slate-50 border-slate-200"
                    disabled={loading}
                  />
                  <Button
                    onClick={() => handleSend(input)}
                    disabled={loading || !input.trim()}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel */}
        <div className="space-y-4 overflow-auto">
          {/* Priority Alerts dari Supabase */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <CardTitle className="text-sm font-semibold">Priority Alerts</CardTitle>
                <Badge className="ml-auto bg-slate-100 text-slate-500 text-[9px]">Live</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {fetching ? (
                <div className="space-y-2 animate-pulse">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-lg bg-slate-50" />)}
                </div>
              ) : priorityAlerts.length === 0 ? (
                <div className="text-center py-4">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-400">Tidak ada alert kritis</p>
                </div>
              ) : priorityAlerts.map((alert, i) => (
                <div key={i} className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{alert.worker}</span>
                    <Badge className={`text-[9px] h-4 ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                    }`}>{alert.severity}</Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">{alert.issue}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Best Practices */}
          <Card className="border-blue-100/60 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Best Practices</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                'Pertahankan posisi tulang belakang netral saat mengangkat',
                'Jaga beban tetap dekat dengan pusat tubuh',
                'Rotasi tugas setiap 30–45 menit',
                'Gunakan alat bantu mekanik untuk beban >20kg',
                'Laporkan ketidaknyamanan segera — intervensi dini lebih efektif',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-emerald-600">{i + 1}</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}