import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  RefreshCw, Loader2, Mic, Users, BarChart2, Tag,
  ArrowLeftRight, ChevronDown, ChevronRight, Sparkles, Plus, Trash2,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Candidates', 'Pairs', 'Panels', 'Topics', 'Analytics'];

const STATUS_META = {
  candidate:       { label: 'Candidate',        color: 'text-[#71717A] border-white/10' },
  podcast_ready:   { label: 'Podcast Ready',    color: 'text-[#DC143C] border-[#DC143C]/30' },
  maybe_later:     { label: 'Maybe Later',      color: 'text-yellow-400 border-yellow-500/20' },
  not_fit_now:     { label: 'Not Fit Now',      color: 'text-[#3F3F46] border-white/5' },
  already_invited: { label: 'Already Invited',  color: 'text-blue-400 border-blue-500/20' },
  invited:         { label: 'Invited',          color: 'text-blue-400 border-blue-500/30' },
  booked:          { label: 'Booked',           color: 'text-emerald-400 border-emerald-500/30' },
  declined:        { label: 'Declined',         color: 'text-red-400/50 border-red-500/10' },
};

const PAIR_STATUS_META = {
  suggested:   { label: 'Suggested',   color: 'text-[#71717A] border-white/10' },
  shortlisted: { label: 'Shortlisted', color: 'text-emerald-400 border-emerald-500/30' },
  rejected:    { label: 'Rejected',    color: 'text-[#3F3F46] border-white/5' },
  invited:     { label: 'Invited',     color: 'text-blue-400 border-blue-500/20' },
  booked:      { label: 'Booked',      color: 'text-emerald-400 border-emerald-500/30' },
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status, meta }) {
  const m = (meta || STATUS_META)[status] || { label: status, color: 'text-[#71717A] border-white/10' };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${m.color}`}>
      {m.label}
    </span>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 50 ? 'text-emerald-400' : score >= 25 ? 'text-yellow-400' : 'text-[#71717A]';
  return <span className={`text-sm font-mono font-medium tabular-nums ${color}`}>{score}</span>;
}

function EmptyState({ icon: Icon, text, sub }) {
  return (
    <div className="text-center py-16 border border-white/8">
      <Icon className="w-7 h-7 text-[#3F3F46] mx-auto mb-3" />
      <p className="text-sm text-[#52525B]">{text}</p>
      {sub && <p className="text-xs text-[#3F3F46] mt-1">{sub}</p>}
    </div>
  );
}

// ─── Candidate Detail Dialog ──────────────────────────────────────────────────

function CandidateDetail({ candidateId, onClose }) {
  const [detail, setDetail]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ status: 'candidate', admin_notes: '', admin_boost: 0 });
  const [decisionNote, setDecisionNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/podcast/candidates/${candidateId}`);
      setDetail(data);
      setForm({
        status:      data.status      || 'candidate',
        admin_notes: data.admin_notes || '',
        admin_boost: data.admin_boost || 0,
      });
    } catch { toast.error('Failed to load candidate'); }
    finally { setLoading(false); }
  }, [candidateId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/podcast/candidates/${candidateId}`, form);
      toast.success('Saved');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  }

  async function addNote() {
    if (!decisionNote.trim()) return;
    setAddingNote(true);
    try {
      await api.post('/admin/podcast/decisions', {
        candidate_id: candidateId,
        action: form.status,
        notes:  decisionNote,
      });
      setDecisionNote('');
      load();
      toast.success('Note logged');
    } catch { toast.error('Failed to log note'); }
    finally { setAddingNote(false); }
  }

  if (loading) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl">
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
        </div>
      </DialogContent>
    </Dialog>
  );

  if (!detail) return null;
  const r = detail.rager || {};

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">{detail.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">

          {/* Person card */}
          <div className="bg-[#080808] border border-white/8 p-4 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={detail.status} meta={STATUS_META} />
              <ScoreBadge score={detail.score} />
              {detail.admin_boost > 0 && (
                <span className="text-[10px] text-yellow-400">+{detail.admin_boost} boost</span>
              )}
            </div>
            <p className="text-sm text-[#A1A1AA]">{[r.title, r.company].filter(Boolean).join(' · ')}</p>
            {r.bio && <p className="text-xs text-[#71717A] leading-relaxed line-clamp-3">{r.bio}</p>}
            {r.linkedin && (
              <a href={r.linkedin} target="_blank" rel="noreferrer"
                 className="text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors">
                LinkedIn ↗
              </a>
            )}
          </div>

          {/* Score breakdown */}
          <div>
            <button
              onClick={() => setShowBreakdown(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#A1A1AA] transition-colors"
            >
              {showBreakdown ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Score breakdown (raw: {detail.raw_score ?? detail.score})
            </button>
            {showBreakdown && Object.keys(detail.score_breakdown || {}).length > 0 && (
              <div className="mt-2 bg-[#080808] border border-white/8 p-4 space-y-2">
                {Object.entries(detail.score_breakdown).map(([key, val]) => (
                  <div key={key} className="flex items-start justify-between gap-4 text-xs">
                    <span className="text-[#71717A] capitalize">{key.replace(/_/g, ' ')}</span>
                    <div className="text-right">
                      <span className="text-[#A1A1AA] font-mono">
                        +{typeof val === 'object' ? val.points : val}
                      </span>
                      {typeof val === 'object' && val.count !== undefined && (
                        <span className="text-[#52525B] ml-1">({val.count})</span>
                      )}
                      {typeof val === 'object' && val.note && (
                        <span className="text-[#52525B] ml-1 block">{val.note}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Topics */}
          {detail.suggested_topics?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.suggested_topics.map(t => (
                  <span key={t} className="text-xs text-[#A1A1AA] bg-white/[0.03] border border-white/10 px-2 py-1">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested pairs */}
          {detail.suggested_pairs?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Top Pairs</p>
              <div className="space-y-1">
                {detail.suggested_pairs.map(pair => {
                  const other = pair.other_person || {};
                  return (
                    <div key={pair.id} className="flex items-center gap-3 bg-[#080808] border border-white/8 px-3 py-2 text-xs">
                      <span className="text-[#F5F5F0] flex-1">{other.name || '—'}</span>
                      <span className="text-[#52525B]">{other.company}</span>
                      <span className="text-[#71717A] font-mono tabular-nums">{pair.compatibility_score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dinner history */}
          {detail.dinner_history?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">
                Dinner History ({detail.dinner_history.length})
              </p>
              <div className="space-y-0">
                {detail.dinner_history.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-2 border-b border-white/5 last:border-0">
                    <span className="text-[#A1A1AA] flex-1 truncate">{d.event_title}</span>
                    {d.event_theme && (
                      <span className="text-[#52525B] italic truncate max-w-[110px]">"{d.event_theme}"</span>
                    )}
                    <span className={d.rsvp_status === 'yes' ? 'text-emerald-400' : 'text-[#71717A]'}>
                      {d.rsvp_status}
                    </span>
                    {d.preread_submitted && (
                      <span className="text-[#52525B]">pre-read ✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Advisory history */}
          {detail.advisory_history?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">
                Advisory History ({detail.advisory_history.length})
              </p>
              <div className="space-y-0">
                {detail.advisory_history.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs py-2 border-b border-white/5 last:border-0">
                    <span className="text-[#A1A1AA] flex-1 truncate">{a.topic}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${
                      a.status === 'confirmed' ? 'text-emerald-400' : 'text-[#71717A]'
                    }`}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin decision */}
          <div className="border-t border-white/8 pt-5 space-y-4">
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Admin Decision</p>

            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS_META).map(([s, m]) => (
                <button
                  key={s}
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    form.status === s
                      ? m.color + ' bg-white/5'
                      : 'text-[#3F3F46] border-white/8 hover:text-[#71717A]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-end gap-3">
              <div className="w-28">
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
                  Boost (0–20)
                </Label>
                <Input
                  type="number" min={0} max={20}
                  value={form.admin_boost}
                  onChange={e => setForm(f => ({ ...f, admin_boost: parseInt(e.target.value) || 0 }))}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm"
                />
              </div>
              <div className="flex-1">
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Notes</Label>
                <Textarea
                  value={form.admin_notes}
                  onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                  rows={2}
                  placeholder="Internal notes…"
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none"
                />
              </div>
            </div>

            <Button
              onClick={save} disabled={saving}
              className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>

          {/* Decision log */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Decision Log</p>
            <div className="flex gap-2 mb-3">
              <Input
                value={decisionNote}
                onChange={e => setDecisionNote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Log a note or decision…"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm flex-1"
              />
              <Button
                onClick={addNote} disabled={addingNote || !decisionNote.trim()}
                className="bg-white/8 hover:bg-white/15 text-[#A1A1AA] rounded-none h-8 px-3 text-xs"
              >
                {addingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </Button>
            </div>
            {detail.decisions?.length > 0 ? (
              <div className="space-y-1.5">
                {detail.decisions.map(d => (
                  <div key={d.id} className="bg-[#080808] border border-white/8 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[#52525B] font-mono">{d.created_at?.slice(0, 10)}</span>
                      <span className="text-[10px] uppercase text-[#71717A]">{d.action}</span>
                    </div>
                    {d.notes && <p className="text-[#A1A1AA]">{d.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#3F3F46]">No decisions logged yet</p>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Candidates Tab ───────────────────────────────────────────────────────────

function CandidatesTab() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState('all');
  const [selected, setSelected]     = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/podcast/candidates');
      setCandidates(data);
    } catch { toast.error('Failed to load candidates'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setRefreshing(true);
    try {
      const { data } = await api.post('/admin/podcast/candidates/refresh');
      toast.success(`Refreshed — ${data.created} new, ${data.updated} updated`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Refresh failed');
    } finally { setRefreshing(false); }
  }

  const counts = {};
  for (const c of candidates) counts[c.status] = (counts[c.status] || 0) + 1;

  const filtered = filter === 'all' ? candidates : candidates.filter(c => c.status === filter);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
              filter === 'all' ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
            }`}
          >
            All ({candidates.length})
          </button>
          {Object.entries(STATUS_META).map(([s, m]) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === s ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {m.label} ({counts[s] || 0})
            </button>
          ))}
        </div>
        <button
          onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors shrink-0"
        >
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh from DB
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Mic}
          text="No candidates yet"
          sub='Click "Refresh from DB" to generate from your Ragers'
        />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className="w-full text-left bg-[#080808] border border-white/8 hover:border-white/15 px-4 py-3 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-[#3F3F46] font-mono tabular-nums w-5 shrink-0 text-right">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium text-[#F5F5F0]">{c.name}</span>
                    <StatusBadge status={c.status} meta={STATUS_META} />
                  </div>
                  <p className="text-xs text-[#71717A]">
                    {[c.title, c.company].filter(Boolean).join(' · ')}
                  </p>
                  {c.suggested_topics?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {c.suggested_topics.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] text-[#52525B] bg-white/[0.02] border border-white/6 px-1.5 py-0.5">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ScoreBadge score={c.score} />
                  <ChevronRight className="w-4 h-4 text-[#3F3F46] group-hover:text-[#71717A] transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <CandidateDetail
          candidateId={selected}
          onClose={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Pairs Tab ────────────────────────────────────────────────────────────────

const PAIRS_PAGE_SIZE = 30;

function PairsTab() {
  const [pairs, setPairs]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGen]      = useState(false);
  const [filter, setFilter]       = useState('all');
  const [updating, setUpdating]   = useState(null);
  const [page, setPage]           = useState(1);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/podcast/pairs');
      setPairs(data);
    } catch { toast.error('Failed to load pairs'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGen(true);
    try {
      const { data } = await api.post('/admin/podcast/pairs/generate');
      toast.success(`${data.pairs_created} pairs generated`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed — refresh candidates first');
    } finally { setGen(false); }
  }

  async function setStatus(id, status) {
    setUpdating(id);
    try {
      await api.patch(`/admin/podcast/pairs/${id}`, { status });
      load();
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(null); }
  }

  const filtered   = filter === 'all' ? pairs : pairs.filter(p => p.status === filter);
  const pairPages  = Math.ceil(filtered.length / PAIRS_PAGE_SIZE);
  const pagedPairs = filtered.slice((page - 1) * PAIRS_PAGE_SIZE, page * PAIRS_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'suggested', 'shortlisted', 'rejected', 'invited', 'booked'].map(s => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === s ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={generate} disabled={generating}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Pairs
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} text="No pairs yet" sub="Generate pairs after refreshing candidates" />
      ) : (
        <div className="space-y-2">
          {pagedPairs.map(pair => (
            <div key={pair.id} className="bg-[#080808] border border-white/8 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-sm font-medium text-[#F5F5F0]">{pair.person_1_name}</span>
                    <ArrowLeftRight className="w-3 h-3 text-[#3F3F46] shrink-0" />
                    <span className="text-sm font-medium text-[#F5F5F0]">{pair.person_2_name}</span>
                    <StatusBadge status={pair.status} meta={PAIR_STATUS_META} />
                    <span className="text-xs font-mono text-[#52525B] tabular-nums ml-0.5">
                      {pair.compatibility_score}
                    </span>
                  </div>
                  <p className="text-xs text-[#52525B] mb-1.5">
                    {[pair.person_1_company, pair.person_2_company].filter(Boolean).join(' · ')}
                  </p>
                  {pair.reasons?.length > 0 && (
                    <ul className="text-xs text-[#71717A] space-y-0.5">
                      {pair.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0 pt-0.5">
                  {pair.status !== 'shortlisted' && (
                    <button
                      onClick={() => setStatus(pair.id, 'shortlisted')}
                      disabled={updating === pair.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-40 transition-colors"
                    >
                      Shortlist
                    </button>
                  )}
                  {pair.status !== 'rejected' && (
                    <button
                      onClick={() => setStatus(pair.id, 'rejected')}
                      disabled={updating === pair.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors"
                    >
                      Reject
                    </button>
                  )}
                  {pair.status === 'rejected' && (
                    <button
                      onClick={() => setStatus(pair.id, 'suggested')}
                      disabled={updating === pair.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Pairs pagination */}
          {pairPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <span className="text-[10px] text-[#52525B]">
                {(page - 1) * PAIRS_PAGE_SIZE + 1}–{Math.min(page * PAIRS_PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="text-[10px] px-3 py-1 border border-white/8 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-30 transition-colors">
                  Prev
                </button>
                <span className="text-[10px] text-[#52525B] px-2 py-1">{page}/{pairPages}</span>
                <button disabled={page === pairPages} onClick={() => setPage(p => p + 1)}
                  className="text-[10px] px-3 py-1 border border-white/8 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-30 transition-colors">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panels Tab ───────────────────────────────────────────────────────────────

function PanelsTab() {
  const [panels, setPanels]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [generating, setGen]      = useState(false);
  const [filter, setFilter]       = useState('all');
  const [updating, setUpdating]   = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/podcast/panels');
      setPanels(data);
    } catch { toast.error('Failed to load panels'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGen(true);
    try {
      const { data } = await api.post('/admin/podcast/panels/generate');
      toast.success(`${data.panels_created} panels generated`);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed — need 3+ candidates first');
    } finally { setGen(false); }
  }

  async function setStatus(id, status) {
    setUpdating(id);
    try {
      await api.patch(`/admin/podcast/panels/${id}`, { status });
      load();
    } catch { toast.error('Failed to update'); }
    finally { setUpdating(null); }
  }

  const filtered = filter === 'all' ? panels : panels.filter(p => p.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'suggested', 'shortlisted', 'rejected'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === s ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={generate} disabled={generating}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Panels
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} text="No panels yet" sub="Generate panels after refreshing candidates" />
      ) : (
        <div className="space-y-2">
          {filtered.map(panel => (
            <div key={panel.id} className="bg-[#080808] border border-white/8 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-sm font-medium text-[#F5F5F0]">{panel.title}</span>
                    <StatusBadge status={panel.status} meta={PAIR_STATUS_META} />
                    <span className="text-xs font-mono text-[#52525B] tabular-nums">{panel.score}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(panel.member_summaries || []).map(m => (
                      <span key={m.person_id}
                            className="text-xs text-[#A1A1AA] bg-white/[0.03] border border-white/8 px-2 py-0.5">
                        {m.name}{m.company ? ` · ${m.company}` : ''}
                      </span>
                    ))}
                  </div>
                  {panel.reasons?.length > 0 && (
                    <ul className="text-xs text-[#71717A] space-y-0.5">
                      {panel.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0 pt-0.5">
                  {panel.status !== 'shortlisted' && (
                    <button
                      onClick={() => setStatus(panel.id, 'shortlisted')}
                      disabled={updating === panel.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-40 transition-colors"
                    >
                      Shortlist
                    </button>
                  )}
                  {panel.status !== 'rejected' && (
                    <button
                      onClick={() => setStatus(panel.id, 'rejected')}
                      disabled={updating === panel.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors"
                    >
                      Reject
                    </button>
                  )}
                  {panel.status === 'rejected' && (
                    <button
                      onClick={() => setStatus(panel.id, 'suggested')}
                      disabled={updating === panel.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors"
                    >
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Topics Tab ───────────────────────────────────────────────────────────────

function TopicsTab() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [adding, setAdding]     = useState(false);
  const [deleting, setDeleting] = useState(null);

  async function load() {
    try {
      const { data: d } = await api.get('/admin/podcast/topics');
      setData(d);
    } catch { toast.error('Failed to load topics'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addManual() {
    if (!newTopic.trim()) return;
    setAdding(true);
    try {
      await api.post('/admin/podcast/topics', { topic: newTopic.trim(), source_type: 'manual' });
      setNewTopic('');
      load();
      toast.success('Signal added');
    } catch { toast.error('Failed to add'); }
    finally { setAdding(false); }
  }

  async function deleteSignal(id) {
    setDeleting(id);
    try {
      await api.delete(`/admin/podcast/topics/${id}`);
      load();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(null); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-8">

      {/* Aggregated */}
      <div>
        <h3 className="text-[10px] uppercase tracking-wider text-[#71717A] mb-3">
          Emerging Topics ({data.aggregated?.length || 0})
        </h3>
        {data.aggregated?.length === 0 ? (
          <p className="text-sm text-[#52525B]">No topics yet — refresh candidates first</p>
        ) : (
          <div className="space-y-2">
            {data.aggregated.map(item => (
              <div key={item.topic} className="bg-[#080808] border border-white/8 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#F5F5F0]">{item.topic}</span>
                  <span className="text-xs font-mono text-[#71717A] tabular-nums">{item.count} people</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.people.slice(0, 8).map(p => (
                    <span key={p.person_id}
                          className="text-[10px] text-[#52525B] bg-white/[0.02] border border-white/5 px-1.5 py-0.5">
                      {p.name}
                    </span>
                  ))}
                  {item.people.length > 8 && (
                    <span className="text-[10px] text-[#3F3F46]">+{item.people.length - 8} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual signals */}
      <div>
        <h3 className="text-[10px] uppercase tracking-wider text-[#71717A] mb-3">Manual Topic Signals</h3>
        <div className="flex gap-2 mb-3">
          <Input
            value={newTopic}
            onChange={e => setNewTopic(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addManual()}
            placeholder="e.g. B2B SaaS, D2C, Climate Tech…"
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm flex-1"
          />
          <Button
            onClick={addManual} disabled={adding || !newTopic.trim()}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-4 text-xs"
          >
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
          </Button>
        </div>
        {data.manual?.length === 0 ? (
          <p className="text-xs text-[#3F3F46]">No manual topics added</p>
        ) : (
          <div className="space-y-1">
            {data.manual.map(s => (
              <div key={s.id} className="flex items-center gap-3 bg-[#080808] border border-white/8 px-3 py-2 text-xs">
                <span className="text-[#A1A1AA] flex-1">{s.topic}</span>
                <span className="text-[#52525B] font-mono">{s.created_at?.slice(0, 10)}</span>
                <button
                  onClick={() => deleteSignal(s.id)} disabled={deleting === s.id}
                  className="text-[#3F3F46] hover:text-red-400 transition-colors"
                >
                  {deleting === s.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/podcast/analytics')
      .then(r => setStats(r.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>;
  if (!stats) return null;

  const maxTopicCount = stats.top_topics?.[0]?.count || 1;

  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Candidates', value: stats.total_candidates },
          { label: 'Podcast Ready',    value: stats.by_status?.podcast_ready || 0 },
          { label: 'Shortlisted Pairs',  value: stats.shortlisted_pairs },
          { label: 'Shortlisted Panels', value: stats.shortlisted_panels },
        ].map(item => (
          <div key={item.label} className="bg-[#080808] border border-white/8 p-4">
            <p className="text-2xl font-mono font-medium text-[#F5F5F0] mb-1 tabular-nums">{item.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Status breakdown */}
        <div className="bg-[#080808] border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">Candidate Status</p>
          <div className="space-y-2">
            {Object.entries(stats.by_status || {})
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <StatusBadge status={status} meta={STATUS_META} />
                  <span className="text-sm font-mono text-[#A1A1AA] tabular-nums">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Source breakdown */}
        <div className="bg-[#080808] border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">Source Breakdown</p>
          <div className="space-y-3">
            {[
              { label: 'Advisory only',  value: stats.source_breakdown?.from_advisory_only || 0 },
              { label: 'Dinner only',    value: stats.source_breakdown?.from_dinner_only    || 0 },
              { label: 'Both modules',   value: stats.source_breakdown?.from_both_modules   || 0 },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-[#71717A] text-xs">{row.label}</span>
                <span className="font-mono text-[#A1A1AA] tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Top topics */}
      {stats.top_topics?.length > 0 && (
        <div className="bg-[#080808] border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">Top Topics</p>
          <div className="space-y-2.5">
            {stats.top_topics.map(item => (
              <div key={item.topic} className="flex items-center gap-3">
                <span className="text-sm text-[#A1A1AA] w-44 truncate shrink-0">{item.topic}</span>
                <div
                  className="h-1.5 bg-[#DC143C]/30 shrink-0"
                  style={{ width: `${Math.max(8, (item.count / maxTopicCount) * 120)}px` }}
                />
                <span className="text-xs font-mono text-[#71717A] tabular-nums">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPodcastPage() {
  const [tab, setTab] = useState('Candidates');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-medium text-[#F5F5F0]">Podcast Intelligence</h1>
        <p className="text-sm text-[#71717A] mt-0.5">
          Who to invite · Why · With whom · On what topic
        </p>
      </div>

      <div className="flex border-b border-white/8 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-[#DC143C] text-[#F5F5F0]'
                : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Candidates' && <CandidatesTab />}
      {tab === 'Pairs'      && <PairsTab />}
      {tab === 'Panels'     && <PanelsTab />}
      {tab === 'Topics'     && <TopicsTab />}
      {tab === 'Analytics'  && <AnalyticsTab />}
    </div>
  );
}
