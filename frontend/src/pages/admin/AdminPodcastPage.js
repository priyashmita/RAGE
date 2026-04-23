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
  FileText, Link2, Download, X, CheckCircle2,
} from 'lucide-react';

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = ['People', 'Content', 'Topics', 'Candidates', 'Pairs', 'Tables', 'Analytics'];

// ─── Status metadata ──────────────────────────────────────────────────────────

const CAND_STATUS_META = {
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

const ROLES = ['founder', 'investor', 'operator', 'expert', 'advisor', 'other'];
const CONTENT_TYPES = ['note', 'transcript', 'article', 'research'];

const ROLE_COLOR = {
  founder:  'text-[#DC143C]',
  investor: 'text-blue-400',
  operator: 'text-emerald-400',
  expert:   'text-yellow-400',
  advisor:  'text-purple-400',
  other:    'text-[#71717A]',
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status, meta }) {
  const m = (meta || CAND_STATUS_META)[status] || { label: status, color: 'text-[#71717A] border-white/10' };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${m.color}`}>
      {m.label}
    </span>
  );
}

function RoleBadge({ role }) {
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium ${ROLE_COLOR[role] || 'text-[#71717A]'}`}>
      {role}
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


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1 — PEOPLE TAB
// ─────────────────────────────────────────────────────────────────────────────

function PersonDetailDialog({ personId, allTopics, onClose, onSaved }) {
  const [person, setPerson]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ role: 'other', tags: '', admin_boost: 0, name: '', company: '', bio: '', linkedin: '' });
  const [addTopicId, setAddTopicId] = useState('');
  const [assigning, setAssigning]   = useState(false);
  const [linking, setLinking]       = useState(false);
  const [linkForm, setLinkForm]     = useState({ rager_id: '' });
  const [showLink, setShowLink]     = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/admin/podcast/people/${personId}`);
      setPerson(data);
      setForm({
        role:        data.role || 'other',
        tags:        (data.tags || []).join(', '),
        admin_boost: data.admin_boost || 0,
        name:        data.name || '',
        company:     data.company || '',
        bio:         data.bio || '',
        linkedin:    data.linkedin || '',
      });
    } catch { toast.error('Failed to load person'); }
    finally { setLoading(false); }
  }, [personId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const patch = {
        role:        form.role,
        tags:        form.tags.split(',').map(t => t.trim()).filter(Boolean),
        admin_boost: parseInt(form.admin_boost) || 0,
      };
      // Only send identity fields for manual (no rager_id)
      if (!person?.rager_id) {
        patch.name    = form.name;
        patch.company = form.company;
        patch.bio     = form.bio;
        patch.linkedin = form.linkedin;
      }
      await api.patch(`/admin/podcast/people/${personId}`, patch);
      toast.success('Saved');
      onSaved?.();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  }

  async function assignTopic() {
    if (!addTopicId) return;
    setAssigning(true);
    try {
      await api.post(`/admin/podcast/people/${personId}/topics/${addTopicId}`);
      setAddTopicId('');
      load();
      onSaved?.();
      toast.success('Topic assigned');
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setAssigning(false); }
  }

  async function unassignTopic(topicId) {
    try {
      await api.delete(`/admin/podcast/people/${personId}/topics/${topicId}`);
      load();
      onSaved?.();
    } catch { toast.error('Failed to unassign'); }
  }

  async function linkRager() {
    if (!linkForm.rager_id.trim()) return;
    setLinking(true);
    try {
      await api.post(`/admin/podcast/people/${personId}/link-rager`, { rager_id: linkForm.rager_id.trim() });
      toast.success('Linked to rager — identity now read live');
      setShowLink(false);
      load();
      onSaved?.();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Link failed'); }
    finally { setLinking(false); }
  }

  async function archive() {
    if (!window.confirm('Archive this person?')) return;
    try {
      await api.delete(`/admin/podcast/people/${personId}`);
      toast.success('Archived');
      onSaved?.();
      onClose();
    } catch { toast.error('Failed to archive'); }
  }

  if (loading) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl">
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      </DialogContent>
    </Dialog>
  );
  if (!person) return null;

  const isLinked = !!person.rager_id;
  const assignedTopicIds = (person.topics || []).map(t => t.id);
  const unassignedTopics = (allTopics || []).filter(t => !assignedTopicIds.includes(t.id));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium flex items-center gap-2">
            {person.name || '(unnamed)'}
            {isLinked && <span className="text-[10px] text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 font-normal tracking-wider uppercase">Rager-linked</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">

          {/* Identity — read-only section if linked */}
          {isLinked && (
            <div className="bg-[#080808] border border-white/8 p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Identity (from rager record)</p>
              <p className="text-sm text-[#F5F5F0]">{person.name}</p>
              <p className="text-xs text-[#71717A]">{[person.company].filter(Boolean).join(' · ')}</p>
              {person.bio && <p className="text-xs text-[#52525B] leading-relaxed line-clamp-3">{person.bio}</p>}
              {person.linkedin && <a href={person.linkedin} target="_blank" rel="noreferrer" className="text-xs text-[#52525B] hover:text-[#A1A1AA]">LinkedIn ↗</a>}
            </div>
          )}

          {/* Editable identity — only for manual */}
          {!isLinked && (
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Name</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Company</Label>
                  <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">LinkedIn URL</Label>
                <Input value={form.linkedin} onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Bio</Label>
                <Textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none" />
              </div>
            </div>
          )}

          {/* Role + boost + tags — always editable */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Podcast Profile</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Role</Label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Admin Boost (0–20)</Label>
                <Input type="number" min={0} max={20} value={form.admin_boost}
                  onChange={e => setForm(f => ({ ...f, admin_boost: e.target.value }))}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="e.g. B2B SaaS, climate, early-stage"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </div>
            <Button onClick={save} disabled={saving}
              className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>

          {/* Assigned topics */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Assigned Topics ({assignedTopicIds.length})</p>
            {(person.topics || []).length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {person.topics.map(t => (
                  <div key={t.id} className="flex items-center gap-1 bg-[#080808] border border-white/8 pl-2 pr-1 py-0.5">
                    <span className="text-xs text-[#A1A1AA]">{t.name}</span>
                    <button onClick={() => unassignTopic(t.id)} className="text-[#3F3F46] hover:text-red-400 transition-colors p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#3F3F46] mb-3">No topics assigned yet</p>
            )}
            {unassignedTopics.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={addTopicId}
                  onChange={e => setAddTopicId(e.target.value)}
                  className="flex-1 bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2"
                >
                  <option value="">Select topic to assign…</option>
                  {unassignedTopics.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.people_count ?? 0})</option>
                  ))}
                </select>
                <Button onClick={assignTopic} disabled={assigning || !addTopicId}
                  className="bg-white/8 hover:bg-white/15 text-[#A1A1AA] rounded-none h-8 px-3 text-xs">
                  {assigning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                </Button>
              </div>
            )}
          </div>

          {/* Link to rager (if not linked) */}
          {!isLinked && (
            <div className="border-t border-white/8 pt-4">
              {!showLink ? (
                <button onClick={() => setShowLink(true)}
                  className="flex items-center gap-1.5 text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors">
                  <Link2 className="w-3.5 h-3.5" />
                  Link this person to a Rager record
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Enter Rager ID to link</p>
                  <div className="flex gap-2">
                    <Input value={linkForm.rager_id} onChange={e => setLinkForm({ rager_id: e.target.value })}
                      placeholder="Rager ID (UUID)…"
                      className="flex-1 bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
                    <Button onClick={linkRager} disabled={linking || !linkForm.rager_id.trim()}
                      className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-4 text-xs">
                      {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Link'}
                    </Button>
                    <button onClick={() => setShowLink(false)} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-2">Cancel</button>
                  </div>
                  <p className="text-[10px] text-[#3F3F46]">Identity (name, bio, linkedin) will then be read live from that rager.</p>
                </div>
              )}
            </div>
          )}

          {/* Archive */}
          <div className="border-t border-white/8 pt-4">
            <button onClick={archive} className="text-xs text-[#3F3F46] hover:text-red-400 transition-colors">
              Archive this person
            </button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Select Ragers Dialog ─────────────────────────────────────────────────────

function SelectRagersDialog({ alreadyImportedIds, onClose, onImported }) {
  const [allRagers, setAllRagers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [selected, setSelected]     = useState(new Set());
  const [importing, setImporting]   = useState(false);

  useEffect(() => {
    api.get('/admin/ragers')
      .then(r => setAllRagers(r.data))
      .catch(() => toast.error('Failed to load ragers'))
      .finally(() => setLoading(false));
  }, []);

  const available = allRagers.filter(r => !alreadyImportedIds.has(r.id));
  const searchLower = search.toLowerCase();
  const shown = searchLower
    ? available.filter(r =>
        (r.name || '').toLowerCase().includes(searchLower) ||
        (r.company || '').toLowerCase().includes(searchLower) ||
        (r.title || '').toLowerCase().includes(searchLower)
      )
    : available;

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() { setSelected(new Set(shown.map(r => r.id))); }
  function clearAll()  { setSelected(new Set()); }

  async function importSelected() {
    if (selected.size === 0) return;
    setImporting(true);
    let ok = 0, fail = 0;
    for (const ragerId of selected) {
      try {
        await api.post('/admin/podcast/people', { rager_id: ragerId, role: 'other', source: 'rager' });
        ok++;
      } catch { fail++; }
    }
    if (ok > 0)   toast.success(`Added ${ok} rager${ok !== 1 ? 's' : ''} to the pool`);
    if (fail > 0) toast.error(`${fail} failed (may already be in pool)`);
    setImporting(false);
    onImported();
    onClose();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">Select Ragers to Add</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 gap-3 mt-3">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, company, title…"
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm shrink-0"
          />

          <div className="flex items-center justify-between text-[10px] text-[#52525B] shrink-0">
            <span>{shown.length} available · {selected.size} selected</span>
            <div className="flex gap-3">
              <button onClick={selectAll} className="hover:text-[#A1A1AA] transition-colors">Select all shown</button>
              <button onClick={clearAll}  className="hover:text-[#A1A1AA] transition-colors">Clear</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
            ) : shown.length === 0 ? (
              <p className="text-xs text-[#3F3F46] text-center py-8">
                {available.length === 0 ? 'All ragers are already in the pool' : 'No results'}
              </p>
            ) : shown.map(r => (
              <label key={r.id}
                className={`flex items-start gap-3 cursor-pointer px-3 py-2.5 border transition-colors ${
                  selected.has(r.id) ? 'border-[#DC143C]/30 bg-[#DC143C]/5' : 'border-white/8 hover:border-white/15'
                }`}>
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)}
                  className="accent-[#DC143C] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#F5F5F0] truncate">{r.name}</p>
                  <p className="text-xs text-[#52525B] truncate">
                    {[r.title, r.company].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </label>
            ))}
          </div>

          <div className="flex gap-2 shrink-0 pt-2 border-t border-white/8">
            <Button
              onClick={importSelected}
              disabled={importing || selected.size === 0}
              className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm"
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Add ${selected.size > 0 ? selected.size : ''} to Pool`}
            </Button>
            <button onClick={onClose} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3">Cancel</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PeopleTab() {
  const [people, setPeople]           = useState([]);
  const [topics, setTopics]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [importing, setImporting]     = useState(false);
  const [selected, setSelected]       = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [showSelect, setShowSelect]   = useState(false);
  const [filter, setFilter]           = useState('all');
  const [addForm, setAddForm]         = useState({ name: '', role: 'other', company: '', bio: '', linkedin: '', tags: '' });
  const [adding, setAdding]           = useState(false);

  const load = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        api.get('/admin/podcast/people'),
        api.get('/admin/podcast/topics'),
      ]);
      setPeople(pRes.data);
      setTopics(tRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function importAll() {
    setImporting(true);
    try {
      const { data } = await api.post('/admin/podcast/people/import-ragers');
      toast.success(`Imported ${data.created} new, ${data.skipped} already in pool`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Import failed'); }
    finally { setImporting(false); }
  }

  async function addManual() {
    setAdding(true);
    try {
      await api.post('/admin/podcast/people', {
        name:        addForm.name.trim(),
        role:        addForm.role,
        company:     addForm.company.trim(),
        bio:         addForm.bio.trim(),
        linkedin:    addForm.linkedin.trim(),
        tags:        addForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        source:      'manual',
      });
      toast.success('Person added');
      setShowAdd(false);
      setAddForm({ name: '', role: 'other', company: '', bio: '', linkedin: '', tags: '' });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed to add'); }
    finally { setAdding(false); }
  }

  const alreadyImportedIds = new Set(people.filter(p => p.rager_id).map(p => p.rager_id));
  const filtered = filter === 'all' ? people : people.filter(p => p.role === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...ROLES].map(r => (
            <button key={r}
              onClick={() => setFilter(r)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === r ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}
            >
              {r} {r === 'all' ? `(${people.length})` : `(${people.filter(p => p.role === r).length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Add Manual
          </button>
          <button onClick={() => setShowSelect(true)}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
            <Users className="w-3.5 h-3.5" />
            Select Ragers
          </button>
          <button onClick={importAll} disabled={importing}
            className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Import All
          </button>
        </div>
      </div>

      {showSelect && (
        <SelectRagersDialog
          alreadyImportedIds={alreadyImportedIds}
          onClose={() => setShowSelect(false)}
          onImported={load}
        />
      )}

      {/* Add manual form */}
      {showAdd && (
        <div className="bg-[#080808] border border-white/8 p-4 mb-5 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Add Manual Person</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Name *</Label>
              <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Role</Label>
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Company</Label>
              <Input value={addForm.company} onChange={e => setAddForm(f => ({ ...f, company: e.target.value }))}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">LinkedIn</Label>
              <Input value={addForm.linkedin} onChange={e => setAddForm(f => ({ ...f, linkedin: e.target.value }))}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Tags (comma-separated)</Label>
            <Input value={addForm.tags} onChange={e => setAddForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="B2B SaaS, climate, early-stage"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
          </div>
          <div className="flex gap-2">
            <Button onClick={addManual} disabled={adding || !addForm.name.trim()}
              className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
            </Button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} text="No people yet" sub='Import Ragers or add manually' />
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
                    {p.rager_id && <span className="text-[9px] text-emerald-400 border border-emerald-500/20 px-1 py-0.5 uppercase tracking-wider">linked</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#52525B]">
                    {p.company && <span>{p.company}</span>}
                    {p.topic_count > 0 && <span>{p.topic_count} topic{p.topic_count !== 1 ? 's' : ''}</span>}
                    {p.content_count > 0 && <span>{p.content_count} content</span>}
                  </div>
                  {(p.tags || []).length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1">
                      {p.tags.slice(0, 4).map(t => (
                        <span key={t} className="text-[9px] text-[#52525B] bg-white/[0.02] border border-white/5 px-1.5 py-0.5">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-[#3F3F46] group-hover:text-[#71717A] transition-colors shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <PersonDetailDialog
          personId={selected}
          allTopics={topics}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2 — CONTENT TAB
// ─────────────────────────────────────────────────────────────────────────────

function ContentRow({ item, people, onExtracted, onDeleted }) {
  const [expanded, setExpanded]   = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const person = people.find(p => p.id === item.person_id);

  async function extract() {
    setExtracting(true);
    try {
      await api.post(`/admin/podcast/content/${item.id}/extract`);
      toast.success('Extraction complete');
      onExtracted?.();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Extraction failed'); }
    finally { setExtracting(false); }
  }

  async function del() {
    if (!window.confirm('Delete this content?')) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/podcast/content/${item.id}`);
      onDeleted?.();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleting(false); }
  }

  const extracted = item.extracted || {};
  const isDone    = item.extraction_status === 'done';
  const isPending = item.extraction_status === 'pending';
  const isFailed  = item.extraction_status === 'failed';

  return (
    <div className="bg-[#080808] border border-white/8">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm text-[#F5F5F0] font-medium">{item.title}</span>
            <span className="text-[9px] uppercase tracking-wider text-[#52525B] border border-white/8 px-1.5 py-0.5">{item.content_type}</span>
            {isDone && <span className="text-[9px] uppercase tracking-wider text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5">extracted</span>}
            {isFailed && <span className="text-[9px] uppercase tracking-wider text-red-400 border border-red-500/20 px-1.5 py-0.5">failed</span>}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#52525B]">
            {person && <span>{person.name}</span>}
            <span className="font-mono">{item.created_at?.slice(0, 10)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isDone && (
            <button onClick={() => setExpanded(v => !v)}
              className="text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors px-2 py-1 border border-white/8">
              {expanded ? 'Hide' : 'View'}
            </button>
          )}
          {(isPending || isFailed) && (
            <button onClick={extract} disabled={extracting}
              className="flex items-center gap-1 text-[10px] px-2 py-1 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] disabled:opacity-40 transition-colors">
              {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Extract
            </button>
          )}
          <button onClick={del} disabled={deleting}
            className="text-[#3F3F46] hover:text-red-400 transition-colors p-1">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      {expanded && isDone && (
        <div className="border-t border-white/8 px-4 py-3 space-y-3">
          {[
            { label: 'Topics',     items: extracted.topics },
            { label: 'Subtopics',  items: extracted.subtopics },
            { label: 'Viewpoints', items: extracted.viewpoints },
            { label: 'Keywords',   items: extracted.keywords },
          ].map(({ label, items }) => (items || []).length > 0 && (
            <div key={label}>
              <p className="text-[9px] uppercase tracking-wider text-[#52525B] mb-1.5">{label} ({items.length})</p>
              <div className="flex flex-wrap gap-1">
                {items.map((x, i) => (
                  <span key={i} className="text-[10px] text-[#A1A1AA] bg-white/[0.03] border border-white/8 px-2 py-0.5">{x}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContentTab() {
  const [content, setContent]   = useState([]);
  const [people, setPeople]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filterPerson, setFilterPerson] = useState('');
  const [showAdd, setShowAdd]   = useState(false);
  const [adding, setAdding]     = useState(false);
  const [addForm, setAddForm]   = useState({ person_id: '', title: '', content_type: 'note', raw_text: '' });

  const load = useCallback(async () => {
    try {
      const [cRes, pRes] = await Promise.all([
        api.get('/admin/podcast/content'),
        api.get('/admin/podcast/people'),
      ]);
      setContent(cRes.data);
      setPeople(pRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addContent() {
    if (!addForm.title.trim() || !addForm.raw_text.trim()) return;
    setAdding(true);
    try {
      await api.post('/admin/podcast/content', {
        person_id:    addForm.person_id || null,
        title:        addForm.title.trim(),
        content_type: addForm.content_type,
        raw_text:     addForm.raw_text.trim(),
      });
      toast.success('Content added — click Extract to analyse');
      setShowAdd(false);
      setAddForm({ person_id: '', title: '', content_type: 'note', raw_text: '' });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setAdding(false); }
  }

  const filtered = filterPerson
    ? content.filter(c => c.person_id === filterPerson)
    : content;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <select value={filterPerson} onChange={e => setFilterPerson(e.target.value)}
            className="bg-[#080808] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-xs px-2 min-w-[180px]">
            <option value="">All people ({content.length})</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.name || '(unnamed)'}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
          <Plus className="w-3.5 h-3.5" />
          Add Content
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#080808] border border-white/8 p-4 mb-5 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Add Content</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Person (optional)</Label>
              <select value={addForm.person_id} onChange={e => setAddForm(f => ({ ...f, person_id: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2">
                <option value="">— unassigned —</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.name || '(unnamed)'}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Title *</Label>
              <Input value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Type</Label>
              <select value={addForm.content_type} onChange={e => setAddForm(f => ({ ...f, content_type: e.target.value }))}
                className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2">
                {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Text / Transcript *</Label>
            <Textarea value={addForm.raw_text} onChange={e => setAddForm(f => ({ ...f, raw_text: e.target.value }))}
              rows={6} placeholder="Paste notes, transcript, article text…"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none" />
          </div>
          <div className="flex gap-2">
            <Button onClick={addContent} disabled={adding || !addForm.title.trim() || !addForm.raw_text.trim()}
              className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
            </Button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-[#52525B] hover:text-[#A1A1AA] px-3">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} text="No content yet" sub="Add notes, transcripts or articles to build topic intelligence" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map(item => (
            <ContentRow key={item.id} item={item} people={people} onExtracted={load} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3 — TOPICS TAB
// ─────────────────────────────────────────────────────────────────────────────

function TopicsTab() {
  const [topics, setTopics]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [newName, setNewName]       = useState('');
  const [adding, setAdding]         = useState(false);
  const [deleting, setDeleting]     = useState(null);
  const [showMerge, setShowMerge]   = useState(false);
  const [keepId, setKeepId]         = useState('');
  const [absorbIds, setAbsorbIds]   = useState([]);
  const [merging, setMerging]       = useState(false);

  async function load() {
    try {
      const { data } = await api.get('/admin/podcast/topics');
      setTopics(data);
    } catch { toast.error('Failed to load topics'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function addTopic() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.post('/admin/podcast/topics', { name: newName.trim() });
      setNewName('');
      load();
      toast.success('Topic created');
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setAdding(false); }
  }

  async function deleteTopic(id) {
    setDeleting(id);
    try {
      await api.delete(`/admin/podcast/topics/${id}`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed'); }
    finally { setDeleting(null); }
  }

  async function merge() {
    if (!keepId || absorbIds.length === 0) return;
    setMerging(true);
    try {
      const { data } = await api.post('/admin/podcast/topics/merge', {
        keep_id:    keepId,
        absorb_ids: absorbIds,
      });
      toast.success(`Merged — keeper now has ${data.total_people} people`);
      setShowMerge(false);
      setKeepId('');
      setAbsorbIds([]);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Merge failed'); }
    finally { setMerging(false); }
  }

  function toggleAbsorb(id) {
    setAbsorbIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>;

  return (
    <div className="space-y-6">

      {/* Add + Merge controls */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex gap-2 flex-1 min-w-[260px]">
          <Input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTopic()}
            placeholder="New topic name…"
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm flex-1" />
          <Button onClick={addTopic} disabled={adding || !newName.trim()}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-4 text-xs">
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
          </Button>
        </div>
        <button onClick={() => setShowMerge(v => !v)}
          className="text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 transition-colors">
          {showMerge ? 'Cancel Merge' : 'Merge Topics'}
        </button>
      </div>

      {/* Merge UI */}
      {showMerge && (
        <div className="bg-[#080808] border border-white/8 p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Merge Topics</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Keep (primary)</Label>
              <select value={keepId} onChange={e => setKeepId(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm px-2">
                <option value="">Select topic to keep…</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name} ({t.people_count} people)</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Absorb (will be merged into keeper)</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto border border-white/8 p-2">
                {topics.filter(t => t.id !== keepId).map(t => (
                  <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={absorbIds.includes(t.id)} onChange={() => toggleAbsorb(t.id)}
                      className="accent-[#DC143C]" />
                    <span className="text-xs text-[#A1A1AA]">{t.name} ({t.people_count})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <Button onClick={merge} disabled={merging || !keepId || absorbIds.length === 0}
            className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm">
            {merging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Merge (absorb ${absorbIds.length})`}
          </Button>
        </div>
      )}

      {/* Topics list */}
      {topics.length === 0 ? (
        <EmptyState icon={Tag} text="No topics yet" sub="Add topics manually or run content extraction — topics will be auto-suggested" />
      ) : (
        <div className="space-y-1.5">
          {topics.map(t => (
            <div key={t.id} className="bg-[#080808] border border-white/8 px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm text-[#F5F5F0]">{t.name}</span>
                  {t.source === 'ai' && <span className="text-[9px] text-purple-400 border border-purple-500/20 px-1.5 py-0.5 uppercase tracking-wider">AI</span>}
                  {t.source === 'both' && <span className="text-[9px] text-blue-400 border border-blue-500/20 px-1.5 py-0.5 uppercase tracking-wider">merged</span>}
                </div>
                {(t.subtopics || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.subtopics.slice(0, 5).map((s, i) => (
                      <span key={i} className="text-[9px] text-[#52525B] border border-white/5 px-1.5 py-0.5">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs font-mono text-[#71717A] tabular-nums shrink-0">{t.people_count} people</span>
              {t.people_count === 0 && (
                <button onClick={() => deleteTopic(t.id)} disabled={deleting === t.id}
                  className="text-[#3F3F46] hover:text-red-400 transition-colors shrink-0">
                  {deleting === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4 — CANDIDATES TAB
// ─────────────────────────────────────────────────────────────────────────────

function CandidateDetailDialog({ candidateId, onClose }) {
  const [detail, setDetail]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({ status: 'candidate', admin_notes: '', admin_boost: 0 });
  const [noteText, setNoteText]   = useState('');
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
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }, [candidateId]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/podcast/candidates/${candidateId}`, form);
      toast.success('Saved');
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api.post('/admin/podcast/decisions', { candidate_id: candidateId, action: form.status, notes: noteText });
      setNoteText('');
      load();
      toast.success('Note logged');
    } catch { toast.error('Failed'); }
    finally { setAddingNote(false); }
  }

  if (loading) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl">
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      </DialogContent>
    </Dialog>
  );
  if (!detail) return null;

  const person = detail.person || {};

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] font-medium">{detail.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">

          {/* Identity */}
          <div className="bg-[#080808] border border-white/8 p-4 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={detail.status} meta={CAND_STATUS_META} />
              <ScoreBadge score={detail.score} />
              <RoleBadge role={detail.role} />
              {detail.activity_bonus > 0 && <span className="text-[10px] text-yellow-400">+{detail.activity_bonus} activity</span>}
            </div>
            <p className="text-xs text-[#71717A]">{[person.company].filter(Boolean).join(' · ')}</p>
            {person.bio && <p className="text-xs text-[#52525B] leading-relaxed line-clamp-3">{person.bio}</p>}
            {person.linkedin && <a href={person.linkedin} target="_blank" rel="noreferrer" className="text-xs text-[#52525B] hover:text-[#A1A1AA]">LinkedIn ↗</a>}
          </div>

          {/* Topics */}
          {(detail.topics || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Topics ({detail.topics.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.topics.map(t => (
                  <span key={t.id} className="text-xs text-[#A1A1AA] bg-white/[0.03] border border-white/10 px-2 py-0.5">{t.name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          {(detail.content || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Content ({detail.content.length})</p>
              <div className="space-y-1">
                {detail.content.map(c => (
                  <div key={c.id} className="flex items-center gap-3 text-xs bg-[#080808] border border-white/8 px-3 py-2">
                    <span className="text-[#A1A1AA] flex-1 truncate">{c.title}</span>
                    <span className="text-[#52525B] uppercase text-[9px]">{c.content_type}</span>
                    {c.extraction_status === 'done'
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      : <span className="text-[9px] text-[#3F3F46] uppercase">{c.extraction_status}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Score breakdown */}
          <div>
            <button onClick={() => setShowBreakdown(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#A1A1AA] transition-colors">
              {showBreakdown ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Score breakdown (raw: {detail.raw_score ?? detail.score})
            </button>
            {showBreakdown && (
              <div className="mt-2 bg-[#080808] border border-white/8 p-4 space-y-2">
                {Object.entries(detail.score_breakdown || {}).map(([key, val]) => (
                  <div key={key} className="flex items-start justify-between gap-4 text-xs">
                    <span className="text-[#71717A] capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-[#A1A1AA] font-mono">
                      {typeof val === 'object'
                        ? `+${val.points ?? 0} (${Object.entries(val).filter(([k]) => k !== 'points').map(([k,v]) => `${k}: ${v}`).join(', ')})`
                        : `+${val}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top pairs */}
          {(detail.top_pairs || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Top Pairs</p>
              <div className="space-y-1">
                {detail.top_pairs.map(pair => {
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

          {/* Activity history */}
          {(detail.dinner_history || []).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Dinner History ({detail.dinner_history.length})</p>
              {detail.dinner_history.map((d, i) => (
                <div key={i} className="flex items-center gap-3 text-xs py-2 border-b border-white/5 last:border-0">
                  <span className="text-[#A1A1AA] flex-1 truncate">{d.event_title}</span>
                  <span className={d.rsvp_status === 'yes' ? 'text-emerald-400' : 'text-[#71717A]'}>{d.rsvp_status}</span>
                  {d.preread_submitted && <span className="text-[#52525B]">pre-read ✓</span>}
                </div>
              ))}
            </div>
          )}

          {/* Admin decision */}
          <div className="border-t border-white/8 pt-4 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">Admin Decision</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CAND_STATUS_META).map(([s, m]) => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`text-[10px] uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                    form.status === s ? m.color + ' bg-white/5' : 'text-[#3F3F46] border-white/8 hover:text-[#71717A]'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-3">
              <div className="w-28">
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Boost (0–20)</Label>
                <Input type="number" min={0} max={20} value={form.admin_boost}
                  onChange={e => setForm(f => ({ ...f, admin_boost: parseInt(e.target.value) || 0 }))}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm" />
              </div>
              <div className="flex-1">
                <Label className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1.5 block">Notes</Label>
                <Textarea value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))}
                  rows={2} placeholder="Internal notes…"
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none" />
              </div>
            </div>
            <Button onClick={save} disabled={saving}
              className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-8 px-5 text-sm">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>

          {/* Decision log */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-2">Decision Log</p>
            <div className="flex gap-2 mb-3">
              <Input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Log a note…"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm flex-1" />
              <Button onClick={addNote} disabled={addingNote || !noteText.trim()}
                className="bg-white/8 hover:bg-white/15 text-[#A1A1AA] rounded-none h-8 px-3 text-xs">
                {addingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </Button>
            </div>
            {(detail.decisions || []).map(d => (
              <div key={d.id} className="bg-[#080808] border border-white/8 px-3 py-2 text-xs mb-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[#52525B] font-mono">{d.created_at?.slice(0, 10)}</span>
                  <span className="text-[10px] uppercase text-[#71717A]">{d.action}</span>
                </div>
                {d.notes && <p className="text-[#A1A1AA]">{d.notes}</p>}
              </div>
            ))}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

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
      toast.success(`Rescored — ${data.created} new, ${data.updated} updated`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Refresh failed'); }
    finally { setRefreshing(false); }
  }

  const counts = {};
  for (const c of candidates) counts[c.status] = (counts[c.status] || 0) + 1;
  const filtered = filter === 'all' ? candidates : candidates.filter(c => c.status === filter);

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('all')}
            className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
              filter === 'all' ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
            }`}>
            All ({candidates.length})
          </button>
          {Object.entries(CAND_STATUS_META).map(([s, m]) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === s ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}>
              {m.label} ({counts[s] || 0})
            </button>
          ))}
        </div>
        <button onClick={refresh} disabled={refreshing}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors shrink-0">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Rescore All
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Mic} text="No candidates" sub='Click "Rescore All" after adding people and assigning topics' />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((c, idx) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className="w-full text-left bg-[#080808] border border-white/8 hover:border-white/15 px-4 py-3 transition-colors group">
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-[#3F3F46] font-mono w-5 text-right shrink-0">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-medium text-[#F5F5F0]">{c.name}</span>
                    <StatusBadge status={c.status} meta={CAND_STATUS_META} />
                    <RoleBadge role={c.role} />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#52525B]">
                    {c.company && <span>{c.company}</span>}
                    {c.content_count > 0 && <span>{c.content_count} content</span>}
                    {(c.topic_ids || []).length > 0 && <span>{c.topic_ids.length} topic{c.topic_ids.length !== 1 ? 's' : ''}</span>}
                  </div>
                  {(c.suggested_topics || []).length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {c.suggested_topics.slice(0, 3).map(t => (
                        <span key={t} className="text-[9px] text-[#52525B] bg-white/[0.02] border border-white/6 px-1.5 py-0.5">{t}</span>
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

      {selected && <CandidateDetailDialog candidateId={selected} onClose={() => { setSelected(null); load(); }} />}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5 — PAIRS TAB
// ─────────────────────────────────────────────────────────────────────────────

const PAIRS_PAGE_SIZE = 30;

function PairsTab() {
  const [pairs, setPairs]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [generating, setGen]    = useState(false);
  const [filter, setFilter]     = useState('all');
  const [updating, setUpdating] = useState(null);
  const [page, setPage]         = useState(1);

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
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed — rescore candidates first'); }
    finally { setGen(false); }
  }

  async function setStatus(id, status) {
    setUpdating(id);
    try {
      await api.patch(`/admin/podcast/pairs/${id}`, { status });
      load();
    } catch { toast.error('Failed'); }
    finally { setUpdating(null); }
  }

  const filtered   = filter === 'all' ? pairs : pairs.filter(p => p.status === filter);
  const pairPages  = Math.ceil(filtered.length / PAIRS_PAGE_SIZE);
  const paged      = filtered.slice((page - 1) * PAIRS_PAGE_SIZE, page * PAIRS_PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'suggested', 'shortlisted', 'rejected', 'invited', 'booked'].map(s => (
            <button key={s} onClick={() => { setFilter(s); setPage(1); }}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === s ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Pairs
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} text="No pairs yet" sub="Generate after rescoring candidates" />
      ) : (
        <div className="space-y-2">
          {paged.map(pair => (
            <div key={pair.id} className="bg-[#080808] border border-white/8 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-medium text-[#F5F5F0]">{pair.person_1_name}</span>
                    <ArrowLeftRight className="w-3 h-3 text-[#3F3F46] shrink-0" />
                    <span className="text-sm font-medium text-[#F5F5F0]">{pair.person_2_name}</span>
                    <StatusBadge status={pair.status} meta={PAIR_STATUS_META} />
                    <span className="text-xs font-mono text-[#52525B] tabular-nums">{pair.compatibility_score}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#52525B] mb-1">
                    {pair.role_pairing && <span>{pair.role_pairing}</span>}
                    {pair.primary_topic && <span className="text-[#3F3F46]">· {pair.primary_topic}</span>}
                  </div>
                  {(pair.reasons || []).length > 0 && (
                    <ul className="text-xs text-[#71717A] space-y-0.5">
                      {pair.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0 pt-0.5">
                  {pair.status !== 'shortlisted' && (
                    <button onClick={() => setStatus(pair.id, 'shortlisted')} disabled={updating === pair.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-40 transition-colors">
                      Shortlist
                    </button>
                  )}
                  {pair.status !== 'rejected' && (
                    <button onClick={() => setStatus(pair.id, 'rejected')} disabled={updating === pair.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors">
                      Reject
                    </button>
                  )}
                  {pair.status === 'rejected' && (
                    <button onClick={() => setStatus(pair.id, 'suggested')} disabled={updating === pair.id}
                      className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors">
                      Undo
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {pairPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <span className="text-[10px] text-[#52525B]">
                {(page - 1) * PAIRS_PAGE_SIZE + 1}–{Math.min(page * PAIRS_PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="text-[10px] px-3 py-1 border border-white/8 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-30">Prev</button>
                <span className="text-[10px] text-[#52525B] px-2 py-1">{page}/{pairPages}</span>
                <button disabled={page === pairPages} onClick={() => setPage(p => p + 1)}
                  className="text-[10px] px-3 py-1 border border-white/8 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-30">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6 — TABLES TAB (4-person)
// ─────────────────────────────────────────────────────────────────────────────

function TablesTab() {
  const [tables, setTables]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [generating, setGen]    = useState(false);
  const [filter, setFilter]     = useState('all');
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/podcast/tables');
      setTables(data);
    } catch { toast.error('Failed to load tables'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGen(true);
    try {
      const { data } = await api.post('/admin/podcast/tables/generate');
      toast.success(`${data.tables_created} tables generated`);
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed — need 4+ candidates with topics'); }
    finally { setGen(false); }
  }

  async function setStatus(id, status) {
    setUpdating(id);
    try {
      await api.patch(`/admin/podcast/tables/${id}`, { status });
      load();
    } catch { toast.error('Failed'); }
    finally { setUpdating(null); }
  }

  async function del(id) {
    setUpdating(id);
    try {
      await api.delete(`/admin/podcast/tables/${id}`);
      load();
    } catch { toast.error('Failed'); }
    finally { setUpdating(null); }
  }

  const filtered = filter === 'all' ? tables : tables.filter(t => t.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'suggested', 'shortlisted', 'rejected'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                filter === s ? 'border-[#DC143C]/40 text-[#DC143C]' : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA]'
              }`}>
              {s} {s === 'all' ? `(${tables.length})` : `(${tables.filter(t => t.status === s).length})`}
            </button>
          ))}
        </div>
        <button onClick={generate} disabled={generating}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors">
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Generate Tables
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} text="No tables yet" sub="Generate 4-person tables after assigning topics to candidates" />
      ) : (
        <div className="space-y-2">
          {filtered.map(table => {
            const isExpanded = expanded === table.id;
            const bd = table.score_breakdown || {};
            return (
              <div key={table.id} className="bg-[#080808] border border-white/8">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Topic */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-xs uppercase tracking-wider text-[#DC143C] font-medium">{table.primary_topic}</span>
                        <StatusBadge status={table.status} meta={PAIR_STATUS_META} />
                        <ScoreBadge score={table.score} />
                      </div>
                      {/* 4 people */}
                      <div className="grid grid-cols-2 gap-1.5 mb-2">
                        {(table.member_summaries || []).map(m => (
                          <div key={m.person_id} className="flex items-center gap-2 text-xs">
                            <RoleBadge role={m.role} />
                            <span className="text-[#A1A1AA] truncate">{m.name}</span>
                            {m.company && <span className="text-[#3F3F46] truncate">· {m.company}</span>}
                          </div>
                        ))}
                      </div>
                      {table.why_it_works && (
                        <p className="text-xs text-[#52525B] italic">{table.why_it_works}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setExpanded(isExpanded ? null : table.id)}
                        className="text-[10px] text-[#52525B] hover:text-[#A1A1AA] border border-white/8 px-2 py-1 transition-colors">
                        {isExpanded ? 'Hide' : 'Detail'}
                      </button>
                      {table.status !== 'shortlisted' && (
                        <button onClick={() => setStatus(table.id, 'shortlisted')} disabled={updating === table.id}
                          className="text-[10px] uppercase px-2.5 py-1 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-40 transition-colors">
                          Shortlist
                        </button>
                      )}
                      {table.status !== 'rejected' && (
                        <button onClick={() => setStatus(table.id, 'rejected')} disabled={updating === table.id}
                          className="text-[10px] uppercase px-2.5 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] disabled:opacity-40 transition-colors">
                          Reject
                        </button>
                      )}
                      {table.status === 'rejected' && (
                        <button onClick={() => del(table.id)} disabled={updating === table.id}
                          className="text-[10px] text-[#3F3F46] hover:text-red-400 transition-colors p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-white/8 px-4 py-3 space-y-3">
                    {/* Score breakdown */}
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[#52525B] mb-2">Score breakdown</p>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { label: 'Topic', key: 'topic_coherence' },
                          { label: 'Perspective', key: 'perspective_diversity' },
                          { label: 'Role', key: 'role_diversity' },
                          { label: 'Company', key: 'company_diversity' },
                          { label: 'Strength', key: 'overall_strength' },
                        ].map(({ label, key }) => (
                          <div key={key} className="text-center bg-[#050505] border border-white/5 p-2">
                            <p className="text-sm font-mono text-[#A1A1AA] tabular-nums">{bd[key] ?? '—'}</p>
                            <p className="text-[9px] text-[#3F3F46] mt-0.5">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Role composition */}
                    {table.role_composition && (
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[#52525B] mb-1.5">Role composition</p>
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(table.role_composition).map(([r, n]) => (
                            <span key={r} className={`text-xs ${ROLE_COLOR[r] || 'text-[#71717A]'}`}>
                              {n}× {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Reasons */}
                    {(table.reasons || []).length > 0 && (
                      <ul className="space-y-0.5">
                        {table.reasons.map((r, i) => (
                          <li key={i} className="text-xs text-[#71717A] flex items-start gap-1.5">
                            <span className="text-[#DC143C] shrink-0 mt-0.5">·</span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MODULE 7 — ANALYTICS TAB
// ─────────────────────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6">

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'People in pool',    value: stats.total_people },
          { label: 'Topics',            value: stats.total_topics },
          { label: 'Table-ready topics', value: (stats.table_ready_topics || []).length },
          { label: 'Shortlisted Tables', value: stats.shortlisted_tables },
        ].map(item => (
          <div key={item.label} className="bg-[#080808] border border-white/8 p-4">
            <p className="text-2xl font-mono font-medium text-[#F5F5F0] mb-1 tabular-nums">{item.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Candidates',    value: stats.total_candidates },
          { label: 'Podcast Ready',       value: stats.by_status?.podcast_ready || 0 },
          { label: 'Shortlisted Pairs',   value: stats.shortlisted_pairs },
          { label: 'Total Tables',        value: stats.total_tables },
        ].map(item => (
          <div key={item.label} className="bg-[#080808] border border-white/8 p-4">
            <p className="text-2xl font-mono font-medium text-[#F5F5F0] mb-1 tabular-nums">{item.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-[#52525B]">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* People by role */}
        <div className="bg-[#080808] border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">People by Role</p>
          <div className="space-y-2">
            {Object.entries(stats.by_role || {})
              .filter(([, v]) => v > 0)
              .sort(([, a], [, b]) => b - a)
              .map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <RoleBadge role={role} />
                  <span className="text-sm font-mono text-[#A1A1AA] tabular-nums">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Content stats */}
        <div className="bg-[#080808] border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">Content</p>
          <div className="space-y-3">
            {[
              { label: 'Total pieces',  value: stats.total_content },
              { label: 'Extracted',     value: stats.extracted_content },
              { label: 'Pending',       value: (stats.total_content || 0) - (stats.extracted_content || 0) },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="text-[#71717A] text-xs">{row.label}</span>
                <span className="font-mono text-[#A1A1AA] tabular-nums">{row.value ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Topic coverage */}
      {(stats.topic_coverage || []).length > 0 && (
        <div className="bg-[#080808] border border-white/8 p-4">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">Topic Coverage</p>
          <div className="space-y-2.5">
            {stats.topic_coverage.map(item => {
              const maxCount = stats.topic_coverage[0]?.count || 1;
              return (
                <div key={item.topic} className="flex items-center gap-3">
                  <span className={`text-sm w-44 truncate shrink-0 ${item.count >= 4 ? 'text-emerald-400' : 'text-[#A1A1AA]'}`}>
                    {item.topic}
                  </span>
                  <div className="h-1.5 bg-[#DC143C]/30 shrink-0"
                    style={{ width: `${Math.max(8, (item.count / maxCount) * 120)}px` }} />
                  <span className="text-xs font-mono text-[#71717A] tabular-nums">{item.count}</span>
                  {item.count >= 4 && <span className="text-[9px] text-emerald-400 uppercase tracking-wider">table-ready</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate funnel */}
      <div className="bg-[#080808] border border-white/8 p-4">
        <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-4">Candidate Funnel</p>
        <div className="space-y-2">
          {Object.entries(stats.by_status || {})
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <StatusBadge status={status} meta={CAND_STATUS_META} />
                <span className="text-sm font-mono text-[#A1A1AA] tabular-nums">{count}</span>
              </div>
            ))}
        </div>
      </div>

    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPodcastPage() {
  const [tab, setTab] = useState('People');

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-medium text-[#F5F5F0]">Podcast Intelligence</h1>
        <p className="text-sm text-[#71717A] mt-0.5">
          Build the guest pool · assign topics · generate 4-person tables
        </p>
      </div>

      <div className="flex border-b border-white/8 mb-6 overflow-x-auto">
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

      {tab === 'People'     && <PeopleTab />}
      {tab === 'Content'    && <ContentTab />}
      {tab === 'Topics'     && <TopicsTab />}
      {tab === 'Candidates' && <CandidatesTab />}
      {tab === 'Pairs'      && <PairsTab />}
      {tab === 'Tables'     && <TablesTab />}
      {tab === 'Analytics'  && <AnalyticsTab />}
    </div>
  );
}
