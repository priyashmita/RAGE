import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Loader2, Plus, ChevronRight, ChevronLeft, Users, Mic,
  X, Check, RefreshCw, Download, Trash2, Sparkles,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS  = ['Seasons', 'People'];
const ROLES = ['founder', 'investor', 'operator', 'expert', 'advisor', 'other'];

const ROLE_COLOR = {
  founder:  'text-[#DC143C]',
  investor: 'text-blue-400',
  operator: 'text-emerald-400',
  expert:   'text-yellow-400',
  advisor:  'text-purple-400',
  other:    'text-[#71717A]',
};

const SEASON_STATUS_COLOR = {
  planning: 'text-[#71717A]',
  active:   'text-emerald-400',
  complete: 'text-[#52525B]',
};

const EPISODE_STATUS_COLOR = {
  planning:  'text-[#71717A]',
  inviting:  'text-blue-400',
  confirmed: 'text-emerald-400',
  recorded:  'text-purple-400',
  published: 'text-[#DC143C]',
};

const RSVP_COLOR = {
  pending: 'text-[#71717A]',
  yes:     'text-emerald-400',
  no:      'text-red-400',
};

// ─── Shared small components ──────────────────────────────────────────────────

function RoleBadge({ role }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium ${ROLE_COLOR[role] || 'text-[#71717A]'}`}>
      {role}
    </span>
  );
}

function StatusPill({ status, colorMap }) {
  const color = (colorMap || {})[status] || 'text-[#71717A]';
  return (
    <span className={`text-[10px] uppercase tracking-wider ${color}`}>{status}</span>
  );
}

function ScorePill({ score }) {
  const color = score >= 50 ? 'text-emerald-400' : score >= 25 ? 'text-yellow-400' : 'text-[#71717A]';
  return <span className={`text-xs font-mono tabular-nums ${color}`}>{score}</span>;
}

function EmptyState({ icon: Icon, text, sub }) {
  return (
    <div className="text-center py-16 border border-white/8">
      <Icon className="w-7 h-7 text-[#3F3F46] mx-auto mb-3" />
      <p className="text-sm text-[#52525B]">{text}</p>
      {sub && <p className="text-xs text-[#3F3F46] mt-1 max-w-xs mx-auto">{sub}</p>}
    </div>
  );
}

function Breadcrumb({ items }) {
  return (
    <div className="flex items-center gap-1.5 mb-5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 text-[#3F3F46]" />}
          {item.onClick ? (
            <button onClick={item.onClick}
              className="text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors">
              {item.label}
            </button>
          ) : (
            <span className="text-xs text-[#A1A1AA]">{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SEASONS TAB — SEASONS LIST
// ─────────────────────────────────────────────────────────────────────────────

function CreateSeasonDialog({ open, onClose, onCreated }) {
  const [name, setName]   = useState('');
  const [theme, setTheme] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setName(''); setTheme(''); } }, [open]);

  async function save() {
    if (!name.trim()) { toast.error('Season name is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/podcast/seasons', { name: name.trim(), theme: theme.trim() });
      toast.success(`${data.name} created`);
      onCreated(data);
      onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">New Season</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
              Season Name *
            </Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Season 1 — Women in Deep Tech"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
              onKeyDown={e => e.key === 'Enter' && save()} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
              Theme / Description
            </Label>
            <Input value={theme} onChange={e => setTheme(e.target.value)}
              placeholder="e.g. Founders disrupting traditional industries"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-white/8">
          <Button onClick={save} disabled={saving || !name.trim()}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Season'}
          </Button>
          <button onClick={onClose} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3 transition-colors">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI SUGGEST SEASONS DIALOG
// ─────────────────────────────────────────────────────────────────────────────

function AISuggestDialog({ open, onClose, onCreated }) {
  const [text,     setText]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);   // { seasons: [...] }
  const [selected, setSelected] = useState({});     // { "season:0": true, "ep:0:1": true, ... }
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) { setText(''); setResult(null); setSelected({}); }
  }, [open]);

  async function generate() {
    if (!text.trim()) { toast.error('Paste some content first'); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/admin/podcast/suggest-seasons', { text });
      setResult(data);
      // Pre-select all
      const sel = {};
      (data.seasons || []).forEach((s, si) => {
        sel[`s:${si}`] = true;
        (s.episodes || []).forEach((_, ei) => { sel[`e:${si}:${ei}`] = true; });
      });
      setSelected(sel);
    } catch (err) { toast.error(err?.response?.data?.detail || 'AI failed'); }
    finally { setLoading(false); }
  }

  async function createSelected() {
    if (!result) return;
    setCreating(true);
    const created = [];
    try {
      for (let si = 0; si < result.seasons.length; si++) {
        if (!selected[`s:${si}`]) continue;
        const s = result.seasons[si];
        const { data: season } = await api.post('/admin/podcast/seasons', {
          name: s.name, theme: s.theme,
        });
        created.push(season);
        for (let ei = 0; ei < (s.episodes || []).length; ei++) {
          if (!selected[`e:${si}:${ei}`]) continue;
          await api.post(`/admin/podcast/seasons/${season.id}/episodes`, {
            topic: s.episodes[ei].topic,
          });
        }
      }
      toast.success(`Created ${created.length} season${created.length !== 1 ? 's' : ''}`);
      onCreated();
      onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed to create'); }
    finally { setCreating(false); }
  }

  function toggleSeason(si) {
    const on = !selected[`s:${si}`];
    setSelected(prev => {
      const next = { ...prev, [`s:${si}`]: on };
      // toggle all episodes of this season too
      (result?.seasons[si]?.episodes || []).forEach((_, ei) => {
        next[`e:${si}:${ei}`] = on;
      });
      return next;
    });
  }

  function toggleEp(si, ei) {
    setSelected(prev => ({ ...prev, [`e:${si}:${ei}`]: !prev[`e:${si}:${ei}`] }));
  }

  const anySelected = result &&
    result.seasons.some((s, si) => selected[`s:${si}`]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#DC143C]" /> Generate Seasons with AI
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 mt-2">
            <p className="text-xs text-[#52525B] leading-relaxed">
              Paste notes from dinners, closed table sessions, interviews, articles, or any content
              about the women you work with. AI will suggest season themes and episode topics.
            </p>
            <Textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Paste your content here — dinner notes, interview transcripts, article excerpts, ideas..."
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[220px] resize-none"
            />
            <div className="flex gap-3 pt-2 border-t border-white/8">
              <Button onClick={generate} disabled={loading || !text.trim()}
                className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm flex items-center gap-2">
                {loading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
              </Button>
              <button onClick={onClose} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <p className="text-xs text-[#52525B]">
              Check the seasons and episodes you want to create, then click Create.
            </p>

            {result.seasons.map((s, si) => (
              <div key={si} className="border border-white/10 bg-[#080808]">
                {/* Season header */}
                <button
                  onClick={() => toggleSeason(si)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors">
                  <span className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center transition-colors ${
                    selected[`s:${si}`] ? 'border-[#DC143C] bg-[#DC143C]' : 'border-white/20'
                  }`}>
                    {selected[`s:${si}`] && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#F5F5F0] tracking-wide">{s.name}</p>
                    {s.theme && <p className="text-xs text-[#52525B] mt-0.5">{s.theme}</p>}
                  </div>
                </button>

                {/* Episode list */}
                <div className="border-t border-white/8 px-4 py-2 space-y-1">
                  {(s.episodes || []).map((ep, ei) => (
                    <button
                      key={ei}
                      onClick={() => toggleEp(si, ei)}
                      className="w-full flex items-center gap-3 py-1.5 text-left hover:text-[#F5F5F0] transition-colors group">
                      <span className={`w-3.5 h-3.5 border flex-shrink-0 flex items-center justify-center transition-colors ${
                        selected[`e:${si}:${ei}`] ? 'border-[#DC143C] bg-[#DC143C]' : 'border-white/15'
                      }`}>
                        {selected[`e:${si}:${ei}`] && <Check className="w-2 h-2 text-white" />}
                      </span>
                      <span className="text-[10px] text-[#3F3F46] font-mono w-6 shrink-0">E{ei + 1}</span>
                      <span className="text-xs text-[#A1A1AA] group-hover:text-[#F5F5F0] transition-colors">{ep.topic}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-3 pt-3 border-t border-white/8">
              <Button onClick={createSelected} disabled={creating || !anySelected}
                className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm flex items-center gap-2">
                {creating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating...</>
                  : 'Create Selected'}
              </Button>
              <button onClick={() => setResult(null)}
                className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3 transition-colors">
                ← Back
              </button>
              <button onClick={onClose}
                className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3 transition-colors ml-auto">
                Cancel
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function SeasonsList({ onSelectSeason }) {
  const [seasons, setSeasons]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAI,    setShowAI]    = useState(false);
  const [deleting, setDeleting]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/podcast/seasons');
      setSeasons(data);
    } catch { toast.error('Failed to load seasons'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteSeason(id, name) {
    if (!window.confirm(`Delete "${name}" and all its episodes?`)) return;
    setDeleting(id);
    try {
      await api.delete(`/admin/podcast/seasons/${id}`);
      setSeasons(s => s.filter(x => x.id !== id));
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setDeleting(null); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-[#71717A]">
          {seasons.length > 0
            ? `${seasons.length} season${seasons.length !== 1 ? 's' : ''}`
            : 'No seasons yet'}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAI(true)}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/10 text-[#71717A] hover:text-[#DC143C] hover:border-[#DC143C]/30 transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Generate with AI
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Season
          </button>
        </div>
      </div>

      <CreateSeasonDialog open={showCreate} onClose={() => setShowCreate(false)}
        onCreated={s => setSeasons(prev => [...prev, s])} />
      <AISuggestDialog open={showAI} onClose={() => setShowAI(false)}
        onCreated={() => load()} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : seasons.length === 0 ? (
        <EmptyState icon={Mic} text="No seasons yet"
          sub="Create a season, then add episode topics. The system will suggest guests from the people pool." />
      ) : (
        <div className="space-y-2">
          {seasons.map(s => (
            <div key={s.id}
              className="bg-[#080808] border border-white/8 hover:border-white/15 px-5 py-4 transition-colors group flex items-center gap-4">
              <button className="flex-1 text-left" onClick={() => onSelectSeason(s)}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-medium text-[#F5F5F0]">{s.name}</span>
                  <StatusPill status={s.status} colorMap={SEASON_STATUS_COLOR} />
                </div>
                {s.theme && (
                  <p className="text-xs text-[#52525B] mb-1">{s.theme}</p>
                )}
                <p className="text-[10px] text-[#3F3F46]">
                  {s.episode_count} episode{s.episode_count !== 1 ? 's' : ''}
                </p>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <ChevronRight className="w-4 h-4 text-[#3F3F46] group-hover:text-[#71717A] transition-colors" />
                <button onClick={() => deleteSeason(s.id, s.name)}
                  disabled={deleting === s.id}
                  className="p-1 text-[#3F3F46] hover:text-red-400 transition-colors">
                  {deleting === s.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SEASON DETAIL — EPISODE LIST
// ─────────────────────────────────────────────────────────────────────────────

function CreateEpisodeDialog({ open, seasonId, onClose, onCreated }) {
  const [topic, setTopic] = useState('');
  const [date,  setDate]  = useState('');
  const [time,  setTime]  = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setTopic(''); setDate(''); setTime(''); } }, [open]);

  async function save() {
    if (!topic.trim()) { toast.error('Topic is required'); return; }
    setSaving(true);
    try {
      const { data } = await api.post(`/admin/podcast/seasons/${seasonId}/episodes`, {
        topic: topic.trim(), date, time,
      });
      onCreated(data);
      onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">New Episode</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
              Topic / Theme *
            </Label>
            <Input value={topic} onChange={e => setTopic(e.target.value)}
              placeholder="e.g. AI in Healthcare, Women in Climate Tech"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
                Recording Date
              </Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
                Time
              </Label>
              <Input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5 pt-4 border-t border-white/8">
          <Button onClick={save} disabled={saving || !topic.trim()}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add Episode'}
          </Button>
          <button onClick={onClose} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3 transition-colors">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SeasonDetail({ season, onBack, onSelectEpisode }) {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/podcast/seasons/${season.id}/episodes`);
      setEpisodes(data);
    } catch { toast.error('Failed to load episodes'); }
    finally { setLoading(false); }
  }, [season.id]);

  useEffect(() => { load(); }, [load]);

  async function deleteEpisode(id, topic) {
    if (!window.confirm(`Delete episode "${topic}"?`)) return;
    setDeleting(id);
    try {
      await api.delete(`/admin/podcast/episodes/${id}`);
      setEpisodes(e => e.filter(x => x.id !== id));
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setDeleting(null); }
  }

  const confirmed = (ep) => (ep.guests || []).filter(g => g.rsvp === 'yes').length;
  const total     = (ep) => (ep.guests || []).length;

  return (
    <div>
      <Breadcrumb items={[
        { label: 'Seasons', onClick: onBack },
        { label: season.name },
      ]} />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-medium text-[#F5F5F0]">{season.name}</h2>
          {season.theme && <p className="text-xs text-[#52525B] mt-0.5">{season.theme}</p>}
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Episode
        </button>
      </div>

      <CreateEpisodeDialog open={showCreate} seasonId={season.id}
        onClose={() => setShowCreate(false)}
        onCreated={ep => { setEpisodes(prev => [...prev, ep]); }} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : episodes.length === 0 ? (
        <EmptyState icon={Mic} text="No episodes yet"
          sub='Add an episode topic. The system will suggest guests from the people pool.' />
      ) : (
        <div className="space-y-2">
          {episodes.map(ep => (
            <div key={ep.id}
              className="bg-[#080808] border border-white/8 hover:border-white/15 px-5 py-4 transition-colors group flex items-center gap-4">
              <button className="flex-1 text-left" onClick={() => onSelectEpisode(ep)}>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-[10px] text-[#3F3F46] font-mono">
                    E{ep.episode_number}
                  </span>
                  <span className="text-sm font-medium text-[#F5F5F0]">{ep.topic}</span>
                  <StatusPill status={ep.status} colorMap={EPISODE_STATUS_COLOR} />
                </div>
                <div className="flex items-center gap-3 text-xs text-[#52525B]">
                  {ep.date && <span>{ep.date}{ep.time ? ` · ${ep.time}` : ''}</span>}
                  <span className={total(ep) === 0
                    ? 'text-[#3F3F46]'
                    : confirmed(ep) === 4
                      ? 'text-emerald-400'
                      : 'text-yellow-400'}>
                    {total(ep) === 0 ? 'No guests yet'
                      : `${confirmed(ep)} confirmed · ${total(ep)} selected`}
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-2 shrink-0">
                <ChevronRight className="w-4 h-4 text-[#3F3F46] group-hover:text-[#71717A] transition-colors" />
                <button onClick={() => deleteEpisode(ep.id, ep.topic)}
                  disabled={deleting === ep.id}
                  className="p-1 text-[#3F3F46] hover:text-red-400 transition-colors">
                  {deleting === ep.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// EPISODE DETAIL — SUGGESTIONS + CONFIRMED GUESTS
// ─────────────────────────────────────────────────────────────────────────────

function AddFromPoolDialog({ open, episodeId, confirmedIds, onClose, onAdded }) {
  const [people, setPeople]   = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding]   = useState(null);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setLoading(true);
    api.get('/admin/podcast/people')
      .then(r => setPeople(r.data))
      .catch(() => toast.error('Failed to load people'))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = people.filter(p => {
    if (confirmedIds.has(p.id)) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) ||
           (p.company || '').toLowerCase().includes(q);
  });

  async function add(personId) {
    setAdding(personId);
    try {
      const { data } = await api.post(`/admin/podcast/episodes/${episodeId}/guests`, {
        person_id: personId, source: 'manual',
      });
      onAdded(data);
      onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setAdding(null); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">Add from People Pool</DialogTitle>
        </DialogHeader>
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or company…"
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm mt-2" />
        <div className="flex-1 overflow-y-auto mt-2 space-y-1 min-h-0">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-[#52525B]" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-[#52525B] text-center py-8">
              {people.length === 0 ? 'No people in pool yet' : 'No matches'}
            </p>
          ) : (
            filtered.map(p => (
              <div key={p.id}
                className="flex items-center justify-between px-3 py-2.5 bg-[#080808] border border-white/5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#F5F5F0]">{p.name || '(unnamed)'}</span>
                    <RoleBadge role={p.role} />
                  </div>
                  {(p.title || p.company) && (
                    <p className="text-xs text-[#52525B]">
                      {[p.title, p.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <button onClick={() => add(p.id)} disabled={adding === p.id}
                  className="text-xs px-3 py-1 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors disabled:opacity-40">
                  {adding === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EpisodeDetail({ episode: initialEp, seasonName, onBack }) {
  const [ep, setEp]                   = useState(initialEp);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(true);
  const [noOne, setNoOne]             = useState(false);
  const [confirming, setConfirming]   = useState(null);
  const [removing, setRemoving]       = useState(null);
  const [inviting, setInviting]       = useState(false);
  const [showPool, setShowPool]       = useState(false);

  const loadSuggestions = useCallback(async () => {
    setLoadingSugg(true);
    try {
      const { data } = await api.get(`/admin/podcast/episodes/${ep.id}/suggestions`);
      setSuggestions(data.suggestions || []);
      setNoOne(data.no_one_available || false);
    } catch { toast.error('Failed to load suggestions'); }
    finally { setLoadingSugg(false); }
  }, [ep.id]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const guests      = ep.guests || [];
  const confirmedIds = new Set(guests.map(g => g.person_id));
  const guestCount  = guests.length;

  async function confirmGuest(personId) {
    setConfirming(personId);
    try {
      const { data } = await api.post(`/admin/podcast/episodes/${ep.id}/guests`, {
        person_id: personId, source: 'suggested',
      });
      setEp(data);
      // reload suggestions to exclude this person
      const r = await api.get(`/admin/podcast/episodes/${ep.id}/suggestions`);
      setSuggestions(r.data.suggestions || []);
      setNoOne(r.data.no_one_available || false);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setConfirming(null); }
  }

  async function removeGuest(personId) {
    setRemoving(personId);
    try {
      const { data } = await api.delete(`/admin/podcast/episodes/${ep.id}/guests/${personId}`);
      setEp(data);
      // reload suggestions to re-include this person
      const r = await api.get(`/admin/podcast/episodes/${ep.id}/suggestions`);
      setSuggestions(r.data.suggestions || []);
      setNoOne(r.data.no_one_available || false);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setRemoving(null); }
  }

  async function updateRsvp(personId, rsvp) {
    try {
      const { data } = await api.patch(
        `/admin/podcast/episodes/${ep.id}/guests/${personId}/rsvp`, { rsvp }
      );
      setEp(data);
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
  }

  async function sendInvites() {
    setInviting(true);
    try {
      const { data } = await api.post(`/admin/podcast/episodes/${ep.id}/invite`);
      setEp(data);
      toast.success('Invites marked as sent');
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setInviting(false); }
  }

  return (
    <div>
      <Breadcrumb items={[
        { label: 'Seasons', onClick: () => onBack('list') },
        { label: seasonName, onClick: () => onBack('season') },
        { label: `E${ep.episode_number} · ${ep.topic}` },
      ]} />

      {/* Episode header */}
      <div className="mb-6 pb-4 border-b border-white/8">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-medium text-[#F5F5F0]">{ep.topic}</h2>
          <StatusPill status={ep.status} colorMap={EPISODE_STATUS_COLOR} />
        </div>
        {(ep.date || ep.time) && (
          <p className="text-xs text-[#52525B] mt-1">
            {[ep.date, ep.time].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Suggestions ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-[#52525B]">
              Suggested Guests
            </p>
            <button onClick={loadSuggestions} disabled={loadingSugg}
              className="text-[#3F3F46] hover:text-[#71717A] transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSugg ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingSugg ? (
            <div className="flex justify-center py-12 border border-white/8">
              <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
            </div>
          ) : noOne || suggestions.length === 0 ? (
            <div className="border border-white/8 px-5 py-8 text-center">
              <Users className="w-6 h-6 text-[#3F3F46] mx-auto mb-2" />
              <p className="text-sm text-[#52525B] mb-1">No one in database for this topic</p>
              <p className="text-xs text-[#3F3F46] mb-4">
                Add people to the People pool or add someone directly below.
              </p>
              {guestCount < 4 && (
                <button onClick={() => setShowPool(true)}
                  className="text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
                  Add from Pool
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map(s => {
                const isConfirmed = confirmedIds.has(s.person_id);
                const isFull      = guestCount >= 4;
                return (
                  <div key={s.person_id}
                    className={`border px-4 py-3 ${isConfirmed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/8 bg-[#080808]'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-medium text-[#F5F5F0]">
                            {s.name || '(unnamed)'}
                          </span>
                          <RoleBadge role={s.role} />
                          <ScorePill score={s.suggestion_score} />
                          {s.topic_bonus > 0 && (
                            <span className="text-[10px] text-[#DC143C]">
                              +{s.topic_bonus} topic match
                            </span>
                          )}
                        </div>
                        {(s.title || s.company) && (
                          <p className="text-xs text-[#52525B] truncate">
                            {[s.title, s.company].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {s.known_for && (
                          <p className="text-[10px] text-[#3F3F46] truncate mt-0.5">{s.known_for}</p>
                        )}
                      </div>
                      {isConfirmed ? (
                        <span className="text-[10px] text-emerald-400 shrink-0 mt-0.5">Confirmed</span>
                      ) : (
                        <button
                          onClick={() => confirmGuest(s.person_id)}
                          disabled={confirming === s.person_id || isFull}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-30 transition-colors shrink-0">
                          {confirming === s.person_id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Check className="w-3 h-3" />}
                          {isFull ? 'Full' : 'Confirm'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {guestCount < 4 && (
                <button onClick={() => setShowPool(true)}
                  className="w-full text-xs py-2.5 border border-dashed border-white/10 text-[#3F3F46] hover:text-[#71717A] hover:border-white/20 transition-colors">
                  + Add someone not in this list
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Confirmed Guests ────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-wider text-[#52525B]">
              Confirmed Guests
              <span className={`ml-2 font-mono ${guestCount === 4 ? 'text-emerald-400' : 'text-[#71717A]'}`}>
                {guestCount}/4
              </span>
            </p>
            {guestCount > 0 && ep.status === 'planning' && (
              <button onClick={sendInvites} disabled={inviting}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-[#DC143C]/40 text-[#DC143C] hover:bg-[#DC143C]/10 transition-colors disabled:opacity-40">
                {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Send Invites
              </button>
            )}
          </div>

          {guests.length === 0 ? (
            <div className="border border-dashed border-white/10 px-5 py-10 text-center">
              <p className="text-xs text-[#3F3F46]">
                Confirm guests from the suggestions list
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {guests.map(g => (
                <div key={g.person_id}
                  className="border border-white/8 bg-[#080808] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-sm font-medium text-[#F5F5F0]">{g.name || '(unnamed)'}</span>
                        <RoleBadge role={g.role} />
                        {g.source === 'manual' && (
                          <span className="text-[9px] text-[#52525B] border border-white/10 px-1">manual</span>
                        )}
                      </div>
                      {(g.title || g.company) && (
                        <p className="text-xs text-[#52525B]">
                          {[g.title, g.company].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        {/* RSVP selector */}
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-[#3F3F46]">RSVP:</span>
                          {['pending', 'yes', 'no'].map(v => (
                            <button key={v} onClick={() => updateRsvp(g.person_id, v)}
                              className={`text-[10px] px-2 py-0.5 border transition-colors ${
                                g.rsvp === v
                                  ? `${RSVP_COLOR[v]} border-current`
                                  : 'text-[#3F3F46] border-white/5 hover:text-[#71717A]'
                              }`}>
                              {v}
                            </button>
                          ))}
                        </div>
                        {g.invited_at && (
                          <span className="text-[10px] text-blue-400">invited</span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeGuest(g.person_id)}
                      disabled={removing === g.person_id}
                      className="p-1 text-[#3F3F46] hover:text-red-400 transition-colors shrink-0 mt-0.5">
                      {removing === g.person_id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}

              {guestCount < 4 && (
                <button onClick={() => setShowPool(true)}
                  className="w-full text-xs py-2.5 border border-dashed border-white/10 text-[#3F3F46] hover:text-[#71717A] hover:border-white/20 transition-colors">
                  + Add guest manually
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AddFromPoolDialog
        open={showPool}
        episodeId={ep.id}
        confirmedIds={confirmedIds}
        onClose={() => setShowPool(false)}
        onAdded={updatedEp => {
          setEp(updatedEp);
          loadSuggestions();
        }}
      />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// SEASONS TAB — navigation controller
// ─────────────────────────────────────────────────────────────────────────────

function SeasonsTab() {
  const [view, setView]       = useState('list');   // 'list' | 'season' | 'episode'
  const [season, setSeason]   = useState(null);
  const [episode, setEpisode] = useState(null);

  function goToSeason(s)  { setSeason(s); setView('season'); }
  function goToEpisode(ep) { setEpisode(ep); setView('episode'); }

  function goBack(target) {
    if (target === 'season') { setEpisode(null); setView('season'); }
    else                     { setSeason(null); setEpisode(null); setView('list'); }
  }

  if (view === 'list')    return <SeasonsList onSelectSeason={goToSeason} />;
  if (view === 'season')  return <SeasonDetail season={season} onBack={() => goBack('list')} onSelectEpisode={goToEpisode} />;
  if (view === 'episode') return <EpisodeDetail episode={episode} seasonName={season?.name} onBack={goBack} />;
  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// PEOPLE TAB (pool management)
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.15em] text-[#52525B] font-semibold mt-5 mb-3 pb-1.5 border-b border-white/5">
      {children}
    </p>
  );
}

function FieldLabel({ children, hint }) {
  return (
    <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">
      {children}
      {hint && <span className="normal-case tracking-normal text-[#3F3F46] ml-1.5 font-normal">{hint}</span>}
    </Label>
  );
}

function FI({ children }) { return <div>{children}</div>; }

function ChipInput({ value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (!v || value.includes(v)) { setDraft(''); return; }
    onChange([...value, v]);
    setDraft('');
  }
  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map(chip => (
            <span key={chip} className="flex items-center gap-1 text-xs text-[#A1A1AA] bg-white/[0.03] border border-white/10 pl-2 pr-1 py-0.5">
              {chip}
              <button onClick={() => onChange(value.filter(c => c !== chip))}
                className="text-[#3F3F46] hover:text-red-400 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
        <button onClick={add} disabled={!draft.trim()}
          className="text-[10px] px-3 border border-white/15 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-30 transition-colors h-8">
          Add
        </button>
      </div>
    </div>
  );
}

const EMPTY_PERSON_FORM = {
  name: '', title: '', company: '', location: '', linkedin: '',
  bio: '', known_for: '', current_focus: '',
  role: 'other', tags: [], expertise: [], viewpoints: [],
  admin_boost: 0,
};

function personToForm(data) {
  return {
    name:          data.name          || '',
    title:         data.title         || '',
    company:       data.company       || '',
    location:      data.location      || '',
    linkedin:      data.linkedin      || '',
    bio:           data.bio           || '',
    known_for:     data.known_for     || '',
    current_focus: data.current_focus || '',
    role:          data.role          || 'other',
    tags:          data.tags          || [],
    expertise:     data.expertise     || [],
    viewpoints:    data.viewpoints    || [],
    admin_boost:   data.admin_boost   || 0,
  };
}

function PersonProfileForm({ form, setForm, isLinked = false }) {
  const f = (field, val) => setForm(prev => ({ ...prev, [field]: val }));
  return (
    <div>
      {isLinked ? (
        <>
          <SectionLabel>Identity — synced from Rager profile</SectionLabel>
          <div className="bg-[#080808] border border-white/8 p-3 space-y-0.5 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-[#F5F5F0] font-medium">{form.name || '—'}</span>
              {form.title && <span className="text-xs text-[#71717A]">· {form.title}</span>}
            </div>
            {form.company && <p className="text-xs text-[#71717A]">{form.company}</p>}
            {form.linkedin && (
              <a href={form.linkedin} target="_blank" rel="noreferrer"
                className="text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors inline-block">
                LinkedIn ↗
              </a>
            )}
            <p className="text-[10px] text-[#3F3F46] pt-1">Edit the Rager profile to update identity.</p>
          </div>
        </>
      ) : (
        <>
          <SectionLabel>Identity</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <FI>
              <FieldLabel>Name *</FieldLabel>
              <Input value={form.name} onChange={e => f('name', e.target.value)}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </FI>
            <FI>
              <FieldLabel>Title</FieldLabel>
              <Input value={form.title} onChange={e => f('title', e.target.value)}
                placeholder="e.g. Founder & CEO"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </FI>
            <FI>
              <FieldLabel>Company</FieldLabel>
              <Input value={form.company} onChange={e => f('company', e.target.value)}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </FI>
            <FI>
              <FieldLabel>Location</FieldLabel>
              <Input value={form.location} onChange={e => f('location', e.target.value)}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </FI>
          </div>
          <div className="mt-3">
            <FieldLabel>LinkedIn URL</FieldLabel>
            <Input value={form.linkedin} onChange={e => f('linkedin', e.target.value)}
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
          </div>
          <SectionLabel>About</SectionLabel>
          <FI>
            <FieldLabel>Bio</FieldLabel>
            <Textarea value={form.bio} onChange={e => f('bio', e.target.value)}
              rows={3} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none" />
          </FI>
        </>
      )}
      {isLinked && form.bio && (
        <>
          <SectionLabel>About</SectionLabel>
          <p className="text-xs text-[#52525B] leading-relaxed mb-3 line-clamp-3">{form.bio}</p>
        </>
      )}
      <div className="space-y-3 mt-3">
        <FI>
          <FieldLabel>Known for</FieldLabel>
          <Input value={form.known_for} onChange={e => f('known_for', e.target.value)}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
        </FI>
        <FI>
          <FieldLabel>Current focus</FieldLabel>
          <Input value={form.current_focus} onChange={e => f('current_focus', e.target.value)}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
        </FI>
      </div>
      <SectionLabel>Classification</SectionLabel>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <FI>
          <FieldLabel>Role</FieldLabel>
          <select value={form.role} onChange={e => f('role', e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2">
            {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
          </select>
        </FI>
        <FI>
          <FieldLabel hint="0–20">Admin boost</FieldLabel>
          <Input type="number" min={0} max={20} value={form.admin_boost}
            onChange={e => f('admin_boost', parseInt(e.target.value) || 0)}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
        </FI>
      </div>
      <div className="space-y-4">
        <FI>
          <FieldLabel>Tags</FieldLabel>
          <ChipInput value={form.tags} onChange={v => f('tags', v)} placeholder="e.g. Climate, D2C" />
        </FI>
        <FI>
          <FieldLabel>Expertise</FieldLabel>
          <ChipInput value={form.expertise} onChange={v => f('expertise', v)} placeholder="e.g. Supply chain finance" />
        </FI>
        <FI>
          <FieldLabel>Viewpoints</FieldLabel>
          <ChipInput value={form.viewpoints} onChange={v => f('viewpoints', v)} placeholder="e.g. Believes bootstrapping first" />
        </FI>
      </div>
    </div>
  );
}

function AddPersonDialog({ open, onClose, onAdded }) {
  const [form, setForm]     = useState({ ...EMPTY_PERSON_FORM });
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm({ ...EMPTY_PERSON_FORM }); }, [open]);

  async function save() {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      await api.post('/admin/podcast/people', { ...form, source: 'manual' });
      toast.success('Person added');
      onAdded(); onClose();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">Add Person</DialogTitle>
        </DialogHeader>
        <PersonProfileForm form={form} setForm={setForm} isLinked={false} />
        <div className="flex gap-2 mt-5 pt-4 border-t border-white/8">
          <Button onClick={save} disabled={saving || !form.name.trim()}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </Button>
          <button onClick={onClose} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3 transition-colors">
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PersonDetailDialog({ personId, onClose, onSaved }) {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ ...EMPTY_PERSON_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/podcast/people/${personId}`);
      setPerson(data);
      setForm(personToForm(data));
    } catch { toast.error('Failed to load person'); }
    finally { setLoading(false); }
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/podcast/people/${personId}`, form);
      toast.success('Saved');
      onSaved?.(); load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function archive() {
    if (!window.confirm('Archive this person?')) return;
    try {
      await api.delete(`/admin/podcast/people/${personId}`);
      toast.success('Archived');
      onSaved?.(); onClose();
    } catch { toast.error('Failed'); }
  }

  if (loading) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl">
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      </DialogContent>
    </Dialog>
  );
  if (!person) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium flex items-center gap-2 flex-wrap">
            <span>{person.name || '(unnamed)'}</span>
            <RoleBadge role={person.role} />
            {person.rager_id && (
              <span className="text-[10px] text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 font-normal tracking-wider uppercase">
                Synced from Rager
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <PersonProfileForm form={form} setForm={setForm} isLinked={!!person.rager_id} />
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/8">
          <Button onClick={save} disabled={saving}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
          </Button>
          <button onClick={archive} className="text-xs text-red-500/50 hover:text-red-400 transition-colors px-2">
            Archive
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SelectRagersDialog({ open, alreadyImportedIds, onClose, onImported }) {
  const [ragers, setRagers]   = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setLoading(true);
    api.get('/admin/ragers')
      .then(r => setRagers(r.data.filter(r => !alreadyImportedIds.has(r.id))))
      .catch(() => toast.error('Failed to load ragers'))
      .finally(() => setLoading(false));
  }, [open, alreadyImportedIds]);

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function importSelected() {
    setSaving(true);
    let ok = 0, fail = 0;
    for (const ragerId of selected) {
      try {
        await api.post('/admin/podcast/people', { rager_id: ragerId, role: 'other', source: 'rager' });
        ok++;
      } catch { fail++; }
    }
    if (ok)   toast.success(`${ok} imported`);
    if (fail) toast.error(`${fail} failed`);
    setSaving(false);
    onImported(); onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">Import Ragers</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 mt-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-[#52525B]" /></div>
          ) : ragers.length === 0 ? (
            <p className="text-xs text-[#52525B] text-center py-8">All ragers already imported</p>
          ) : (
            ragers.map(r => (
              <button key={r.id} onClick={() => toggle(r.id)}
                className={`w-full text-left px-3 py-2.5 border transition-colors ${
                  selected.has(r.id) ? 'border-[#DC143C]/40 bg-[#DC143C]/5' : 'border-white/5 hover:border-white/15'
                }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 border rounded-none shrink-0 flex items-center justify-center ${
                    selected.has(r.id) ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/20'
                  }`}>
                    {selected.has(r.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div>
                    <span className="text-sm text-[#F5F5F0]">{r.name}</span>
                    {r.company && <span className="text-xs text-[#52525B] ml-2">{r.company}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
        {selected.size > 0 && (
          <div className="pt-3 border-t border-white/8">
            <Button onClick={importSelected} disabled={saving}
              className="w-full bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 text-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Import ${selected.size} selected`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PeopleTab() {
  const [people, setPeople]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showAdd, setShowAdd]     = useState(false);
  const [showSelect, setShowSelect] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/podcast/people');
      setPeople(data);
    } catch { toast.error('Failed to load people'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function importAll() {
    setImporting(true);
    try {
      const { data } = await api.post('/admin/podcast/people/import-ragers');
      toast.success(`${data.created} imported, ${data.skipped} skipped`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Import failed'); }
    finally { setImporting(false); }
  }

  const alreadyImportedIds = new Set(people.filter(p => p.rager_id).map(p => p.rager_id));

  const filtered = people.filter(p => {
    if (filterRole !== 'all' && p.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) ||
             (p.company || '').toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <p className="text-sm text-[#71717A]">
          {people.length > 0 ? `${people.length} people in pool` : 'No people yet'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Manual
          </button>
          <button onClick={() => setShowSelect(true)}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
            <Users className="w-3.5 h-3.5" /> Import Ragers
          </button>
          <button onClick={importAll} disabled={importing}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Import All
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name or company…"
          className="bg-[#080808] border-white/10 text-[#F5F5F0] h-8 rounded-none text-sm w-56" />
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="bg-[#080808] border border-white/10 text-[#71717A] h-8 rounded-none text-xs px-2">
          <option value="all">All roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(filterRole !== 'all' || search) && (
          <button onClick={() => { setFilterRole('all'); setSearch(''); }}
            className="text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors">
            Clear
          </button>
        )}
      </div>

      <AddPersonDialog open={showAdd} onClose={() => setShowAdd(false)} onAdded={load} />
      <SelectRagersDialog open={showSelect} alreadyImportedIds={alreadyImportedIds}
        onClose={() => setShowSelect(false)} onImported={load} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 && people.length === 0 ? (
        <EmptyState icon={Users} text="No people yet"
          sub='Add manually or import from Ragers. These people form the guest pool for episode suggestions.' />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} text="No results" sub="Try adjusting filters" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p, idx) => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className="w-full text-left bg-[#080808] border border-white/8 hover:border-white/15 px-4 py-3 transition-colors group">
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-[#3F3F46] font-mono w-5 text-right shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium text-[#F5F5F0]">{p.name || '(unnamed)'}</span>
                    <RoleBadge role={p.role} />
                    {p.rager_id && (
                      <span className="text-[9px] text-emerald-400 border border-emerald-500/20 px-1 py-0.5 uppercase tracking-wider">synced</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#52525B]">
                    {p.title && <span>{p.title}</span>}
                    {p.company && <span>{p.company}</span>}
                    {p.topic_count > 0 && <span className="text-[#3F3F46]">· {p.topic_count} topic{p.topic_count !== 1 ? 's' : ''}</span>}
                  </div>
                  {p.known_for && (
                    <p className="text-[10px] text-[#52525B] truncate mt-0.5">{p.known_for}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-[#3F3F46] group-hover:text-[#71717A] transition-colors shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PersonDetailDialog personId={selected} onClose={() => setSelected(null)} onSaved={load} />
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPodcastPage() {
  const [tab, setTab] = useState('Seasons');

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-medium text-[#F5F5F0]">Sunday Table</h1>
        <p className="text-sm text-[#71717A] mt-0.5">Season and episode planning — guest selection, invites, and tracking.</p>
      </div>

      <div className="flex border-b border-white/8 mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === t
                ? 'border-[#DC143C] text-[#F5F5F0]'
                : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Seasons' && <SeasonsTab />}
      {tab === 'People'  && <PeopleTab />}
    </div>
  );
}
