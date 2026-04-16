import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ChevronLeft, Loader2, Plus, Trash2, Send, Users, Search,
  RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle,
  ArrowLeftRight, Sparkles, Mail, Archive, RotateCcw,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Details', 'Guest List', 'Invite Status', 'Pre-reads', 'Seating', 'Intro Engine'];

const STATUS_META = {
  draft:        { label: 'Draft',        color: 'text-[#71717A] border-white/10' },
  invites_sent: { label: 'Invites Sent', color: 'text-yellow-400 border-yellow-500/20' },
  rsvp_open:    { label: 'RSVP Open',   color: 'text-blue-400 border-blue-500/20' },
  confirmed:    { label: 'Confirmed',   color: 'text-emerald-400 border-emerald-500/20' },
  completed:    { label: 'Completed',   color: 'text-[#A1A1AA] border-white/10' },
  cancelled:    { label: 'Cancelled',   color: 'text-red-400 border-red-500/20' },
  archived:     { label: 'Archived',    color: 'text-[#52525B] border-white/8' },
};

// archived is intentionally excluded — use archive/restore endpoints
const STATUS_ORDER = ['draft', 'invites_sent', 'rsvp_open', 'confirmed', 'completed', 'cancelled'];

const RSVP_DOT = {
  pending:   { icon: Clock,        color: 'text-[#71717A]', label: 'Pending' },
  yes:       { icon: CheckCircle2, color: 'text-emerald-400', label: 'Yes' },
  no:        { icon: XCircle,      color: 'text-red-400',    label: 'No' },
  waitlist:  { icon: AlertCircle,  color: 'text-yellow-400', label: 'Waitlist' },
  confirmed: { icon: CheckCircle2, color: 'text-blue-400',   label: 'Confirmed' },
  cancelled: { icon: XCircle,      color: 'text-[#52525B]',  label: 'Cancelled' },
};

const GUEST_TYPE_COLORS = {
  founder: 'text-[#DC143C] border-[#DC143C]/30',
  leader:  'text-blue-400 border-blue-400/30',
  guest:   'text-[#71717A] border-white/15',
};

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-xs uppercase tracking-[0.12em] text-[#71717A]">{title}</h3>
      {action}
    </div>
  );
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

// ─── Tab: Details ─────────────────────────────────────────────────────────────

function DetailsTab({ event, onRefresh, isArchived }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (event) setForm({
      title:            event.title || '',
      date:             event.date ? event.date.slice(0, 16) : '',
      location:         event.location || '',
      capacity:         event.capacity || 20,
      theme:            event.theme || '',
      description:      event.description || '',
      dress_code:       event.dress_code || '',
      pre_read_content: event.pre_read_content || {},
    });
  }, [event]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      await api.put(`/admin/events/${event.id}`, form);
      toast.success('Event updated');
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function changeStatus(status) {
    try {
      await api.put(`/admin/events/${event.id}`, { status });
      toast.success(`Status → ${status}`);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update status');
    }
  }

  const meta = STATUS_META[event.status] || STATUS_META.draft;
  const nextStatuses = STATUS_ORDER.filter(s => s !== event.status && s !== 'cancelled');

  return (
    <div className="space-y-6 max-w-lg">
      <div className="flex items-center gap-3">
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${meta.color}`}>
          {meta.label}
        </span>
        {!isArchived && (
        <div className="flex gap-1.5">
          {nextStatuses.map(s => (
            <button
              key={s}
              onClick={() => changeStatus(s)}
              className="text-[10px] uppercase tracking-wider text-[#52525B] hover:text-[#A1A1AA] border border-white/8 hover:border-white/20 px-2 py-0.5 transition-colors"
            >
              → {STATUS_META[s]?.label || s}
            </button>
          ))}
        </div>
        )}
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Title</Label>
        <Input
          value={form.title || ''}
          onChange={e => set('title', e.target.value)}
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Date & Time</Label>
          <Input
            type="datetime-local"
            value={form.date || ''}
            onChange={e => set('date', e.target.value)}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Capacity</Label>
          <Input
            type="number"
            min={1}
            value={form.capacity || 20}
            onChange={e => set('capacity', parseInt(e.target.value) || 20)}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Location</Label>
        <Input
          value={form.location || ''}
          onChange={e => set('location', e.target.value)}
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Theme</Label>
        <Input
          value={form.theme || ''}
          onChange={e => set('theme', e.target.value)}
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Dress Code</Label>
        <Input
          value={form.dress_code || ''}
          onChange={e => set('dress_code', e.target.value)}
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Description</Label>
        <Textarea
          value={form.description || ''}
          onChange={e => set('description', e.target.value)}
          rows={3}
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none"
        />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
          Pre-read Package Content
        </Label>
        <p className="text-xs text-[#52525B] mb-2">
          Sent to confirmed guests alongside their pre-read package link.
        </p>
        <div className="space-y-2">
          <Input
            value={(form.pre_read_content || {}).title || ''}
            onChange={e => set('pre_read_content', { ...form.pre_read_content, title: e.target.value })}
            placeholder="Package title"
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
          />
          <Textarea
            value={(form.pre_read_content || {}).body || ''}
            onChange={e => set('pre_read_content', { ...form.pre_read_content, body: e.target.value })}
            placeholder="Welcome note or briefing to send with the package…"
            rows={4}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none"
          />
        </div>
      </div>
      <Button
        onClick={save}
        disabled={saving || isArchived}
        title={isArchived ? 'Restore the event before editing' : undefined}
        className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
      </Button>
    </div>
  );
}

// ─── Tab: Guest List ──────────────────────────────────────────────────────────

function GuestListTab({ event, guests, onRefresh, isArchived }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState('rager');   // 'rager' | 'manual'
  const [ragers, setRagers] = useState([]);
  const [ragerSearch, setRagerSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [manual, setManual] = useState({ name: '', email: '', company: '', title: '', guest_type: 'guest' });
  const [removing, setRemoving] = useState(null);

  async function loadRagers() {
    try {
      const { data } = await api.get('/admin/ragers');
      setRagers(data);
    } catch { toast.error('Failed to load Ragers'); }
  }

  function openAdd(mode) {
    setAddMode(mode);
    setShowAdd(true);
    if (mode === 'rager') loadRagers();
  }

  const filteredRagers = ragers.filter(r => {
    const q = ragerSearch.toLowerCase();
    return !q || r.name?.toLowerCase().includes(q) || r.company?.toLowerCase().includes(q);
  });

  async function addFromRager(rager, guestType) {
    setAdding(rager.id);
    try {
      await api.post(`/admin/events/${event.id}/guests`, {
        rager_id:   rager.id,
        name:       rager.name,
        email:      rager.email,
        company:    rager.company,
        title:      rager.title,
        guest_type: guestType,
      });
      toast.success(`${rager.name} added`);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add guest');
    } finally { setAdding(null); }
  }

  async function addManual(e) {
    e.preventDefault();
    if (!manual.name || !manual.email) { toast.error('Name and email required'); return; }
    setAdding('manual');
    try {
      await api.post(`/admin/events/${event.id}/guests`, manual);
      toast.success(`${manual.name} added`);
      setManual({ name: '', email: '', company: '', title: '', guest_type: 'guest' });
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add guest');
    } finally { setAdding(null); }
  }

  async function removeGuest(id, name) {
    if (!window.confirm(`Remove ${name} from this event?`)) return;
    setRemoving(id);
    try {
      await api.delete(`/admin/events/${event.id}/guests/${id}`);
      toast.success('Guest removed');
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to remove guest');
    } finally { setRemoving(null); }
  }

  const existingEmails = new Set(guests.map(g => g.email));

  return (
    <div>
      <SectionHeader
        title={`${guests.length} guest${guests.length !== 1 ? 's' : ''}`}
        action={!isArchived && (
          <div className="flex gap-2">
            <Button
              onClick={() => openAdd('rager')}
              variant="outline"
              className="h-8 rounded-none border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] text-xs gap-1.5 px-3"
            >
              <Users className="w-3.5 h-3.5" /> Add from Ragers
            </Button>
            <Button
              onClick={() => openAdd('manual')}
              variant="outline"
              className="h-8 rounded-none border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] text-xs gap-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" /> Add manually
            </Button>
          </div>
        )}
      />

      {guests.length === 0 ? (
        <EmptyState icon={Users} text="No guests added yet" sub="Add from your Ragers list or manually" />
      ) : (
        <div className="space-y-1.5">
          {guests.map(g => {
            const typeColor = GUEST_TYPE_COLORS[g.guest_type] || GUEST_TYPE_COLORS.guest;
            return (
              <div key={g.id} className="flex items-center gap-3 bg-[#080808] border border-white/8 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[#F5F5F0] font-medium">{g.name}</span>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${typeColor}`}>
                      {g.guest_type}
                    </span>
                  </div>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    {[g.title, g.company].filter(Boolean).join(' · ')}
                    {g.email && <span className="text-[#52525B]"> · {g.email}</span>}
                  </p>
                </div>
                <button
                  onClick={() => removeGuest(g.id, g.name)}
                  disabled={removing === g.id}
                  className="text-[#3F3F46] hover:text-red-400 transition-colors p-1"
                >
                  {removing === g.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add guest dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-medium text-base">
              {addMode === 'rager' ? 'Add from Ragers' : 'Add guest manually'}
            </DialogTitle>
          </DialogHeader>

          {addMode === 'rager' ? (
            <div className="mt-2">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
                <Input
                  value={ragerSearch}
                  onChange={e => setRagerSearch(e.target.value)}
                  placeholder="Search by name or company…"
                  className="pl-9 bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                />
              </div>
              <div className="max-h-80 overflow-y-auto space-y-1">
                {filteredRagers.map(r => {
                  const already = existingEmails.has(r.email?.toLowerCase());
                  return (
                    <div key={r.id} className={`flex items-center gap-3 px-3 py-2.5 border ${already ? 'border-white/5 opacity-40' : 'border-white/8'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F5F5F0] truncate">{r.name}</p>
                        <p className="text-xs text-[#71717A] truncate">
                          {[r.title, r.company].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {!already && (
                        <div className="flex gap-1.5 shrink-0">
                          {['founder', 'leader', 'guest'].map(type => (
                            <button
                              key={type}
                              disabled={adding === r.id}
                              onClick={() => addFromRager(r, type)}
                              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border transition-colors ${GUEST_TYPE_COLORS[type]} hover:bg-white/5`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      )}
                      {already && <span className="text-[10px] text-[#52525B]">Added</span>}
                    </div>
                  );
                })}
                {filteredRagers.length === 0 && (
                  <p className="text-sm text-[#52525B] text-center py-8">No Ragers found</p>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={addManual} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                    Name <span className="text-[#DC143C]">*</span>
                  </Label>
                  <Input
                    value={manual.name}
                    onChange={e => setManual(m => ({ ...m, name: e.target.value }))}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                    Email <span className="text-[#DC143C]">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={manual.email}
                    onChange={e => setManual(m => ({ ...m, email: e.target.value }))}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Company</Label>
                  <Input
                    value={manual.company}
                    onChange={e => setManual(m => ({ ...m, company: e.target.value }))}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Title</Label>
                  <Input
                    value={manual.title}
                    onChange={e => setManual(m => ({ ...m, title: e.target.value }))}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Guest type</Label>
                <div className="flex gap-2">
                  {['founder', 'leader', 'guest'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setManual(m => ({ ...m, guest_type: type }))}
                      className={`text-xs uppercase tracking-wider px-3 py-1.5 border transition-colors ${
                        manual.guest_type === type
                          ? GUEST_TYPE_COLORS[type] + ' bg-white/5'
                          : 'text-[#52525B] border-white/10 hover:text-[#A1A1AA]'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}
                  className="rounded-none text-[#71717A] hover:text-[#F5F5F0] h-9">Cancel</Button>
                <Button type="submit" disabled={adding === 'manual'}
                  className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm">
                  {adding === 'manual' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Guest'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab: Invite Status ───────────────────────────────────────────────────────

function InviteStatusTab({ event, guests, onRefresh, isArchived }) {
  const [sending, setSending] = useState(null);

  async function sendBatch(endpoint, label) {
    setSending(endpoint);
    try {
      const { data } = await api.post(`/admin/events/${event.id}/${endpoint}`, {});
      const sent = data.results?.filter(r => r.sent).length ?? 0;
      const failed = data.results?.filter(r => !r.sent).length ?? 0;
      toast.success(`${sent} ${label} sent${failed ? ` · ${failed} failed` : ''}`);
      onRefresh();
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Failed to send ${label}`);
    } finally { setSending(null); }
  }

  const uninvited   = guests.filter(g => !g.invite_sent).length;
  const yesNoPreread = guests.filter(g => g.rsvp_status === 'yes' && !g.preread_sent).length;
  const confirmed   = guests.filter(g => g.rsvp_status === 'yes').length;

  return (
    <div>
      {/* Action bar */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-[#080808] border border-white/8">
        {isArchived ? (
          <p className="text-xs text-[#52525B] flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" />
            Email dispatch is disabled while this event is archived.
          </p>
        ) : (
          <>
            <button
              onClick={() => sendBatch('send-invites', 'invites')}
              disabled={!!sending || uninvited === 0}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending === 'send-invites' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send Invites ({uninvited} unsent)
            </button>
            <button
              onClick={() => sendBatch('send-prereads', 'pre-read requests')}
              disabled={!!sending || yesNoPreread === 0}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending === 'send-prereads' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Send Pre-read Requests ({yesNoPreread} eligible)
            </button>
            <button
              onClick={() => sendBatch('send-confirmation', 'confirmations')}
              disabled={!!sending || confirmed === 0}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending === 'send-confirmation' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Send Confirmations + Package ({confirmed} confirmed)
            </button>
          </>
        )}
      </div>

      {guests.length === 0 ? (
        <EmptyState icon={Users} text="No guests added yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                {['Name', 'Type', 'Invited', 'RSVP', 'Pre-read', 'Notes'].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-wider text-[#52525B] pb-2 pr-4 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guests.map(g => {
                const rsvpMeta = RSVP_DOT[g.rsvp_status] || RSVP_DOT.pending;
                const RsvpIcon = rsvpMeta.icon;
                const typeColor = GUEST_TYPE_COLORS[g.guest_type] || GUEST_TYPE_COLORS.guest;
                return (
                  <tr key={g.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="text-[#F5F5F0]">{g.name}</p>
                        <p className="text-xs text-[#52525B]">{g.company}</p>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border ${typeColor}`}>
                        {g.guest_type}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {g.invite_sent
                        ? <span className="text-emerald-400 text-xs">Sent</span>
                        : <span className="text-[#52525B] text-xs">—</span>}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`flex items-center gap-1.5 text-xs ${rsvpMeta.color}`}>
                        <RsvpIcon className="w-3.5 h-3.5" />
                        {rsvpMeta.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {g.preread_submitted
                        ? <span className="text-emerald-400 text-xs">Submitted</span>
                        : g.preread_sent
                        ? <span className="text-yellow-400 text-xs">Sent</span>
                        : <span className="text-[#52525B] text-xs">—</span>}
                    </td>
                    <td className="py-3 text-xs text-[#71717A]">{g.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Pre-reads ───────────────────────────────────────────────────────────

function PrereadsTab({ event }) {
  const [prereads, setPrereads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(`/admin/events/${event.id}/prereads`);
        setPrereads(data);
      } catch { toast.error('Failed to load pre-reads'); }
      finally { setLoading(false); }
    }
    load();
  }, [event.id]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>;

  if (prereads.length === 0) return (
    <EmptyState icon={Mail} text="No pre-reads submitted yet" sub="Pre-reads appear here once guests complete the form" />
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {prereads.map(pr => (
        <div key={pr.id} className="bg-[#080808] border border-white/8 p-5">
          <div className="mb-4 pb-3 border-b border-white/8">
            <p className="text-sm font-medium text-[#F5F5F0]">{pr.name}</p>
            <p className="text-xs text-[#71717A]">{[pr.role, pr.company].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="space-y-3">
            {[
              { label: 'One-liner',       value: pr.one_liner },
              { label: 'Current focus',   value: pr.current_focus },
              { label: 'Bringing to table', value: pr.bring_to_table },
              { label: 'Looking for',     value: pr.looking_for },
              { label: 'Open question',   value: pr.open_question },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-0.5">{f.label}</p>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Seating ─────────────────────────────────────────────────────────────

function SeatingTab({ event, guests, isArchived }) {
  const [seating, setSeating] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [numTables, setNumTables] = useState(4);
  const [tables, setTables] = useState([]);

  const confirmedGuests = guests.filter(g => g.rsvp_status === 'yes');
  const guestById = Object.fromEntries(guests.map(g => [g.id, g]));

  useEffect(() => { loadSeating(); }, [event.id]);

  async function loadSeating() {
    try {
      const { data } = await api.get(`/admin/events/${event.id}/seating`);
      if (data) {
        setSeating(data);
        setTables(data.tables || []);
      }
    } catch { /* no seating yet */ }
    finally { setLoading(false); }
  }

  async function suggest() {
    if (confirmedGuests.length === 0) { toast.error('No confirmed guests to seat'); return; }
    setSuggesting(true);
    try {
      const { data } = await api.post(`/admin/events/${event.id}/seating/suggest`, { num_tables: numTables });
      setTables(data.tables);
      toast.success('Seating suggestion generated — review and save');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to generate suggestion');
    } finally { setSuggesting(false); }
  }

  async function save(isFinal = false) {
    setSaving(true);
    try {
      const payload = {
        tables: tables.map(t => ({ table_id: t.table_id, label: t.label, seats: t.seats || t.guests?.map(g => g.id) || [] })),
        is_final: isFinal,
      };
      const { data } = seating
        ? await api.put(`/admin/events/${event.id}/seating/${seating.id}`, payload)
        : await api.post(`/admin/events/${event.id}/seating`, payload);
      setSeating(data);
      toast.success(isFinal ? 'Seating finalised' : 'Seating plan saved');
      loadSeating();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save seating');
    } finally { setSaving(false); }
  }

  function moveGuest(guestId, fromTableId, toTableId) {
    if (fromTableId === toTableId) return;
    setTables(prev => prev.map(t => {
      if (t.table_id === fromTableId) {
        const seats = (t.seats || t.guests?.map(g => g.id) || []).filter(id => id !== guestId);
        const updGuests = (t.guests || []).filter(g => g.id !== guestId);
        return { ...t, seats, guests: updGuests };
      }
      if (t.table_id === toTableId) {
        const guest = guests.find(g => g.id === guestId);
        const seats = [...(t.seats || t.guests?.map(g => g.id) || []), guestId];
        const updGuests = [...(t.guests || []), guest].filter(Boolean);
        return { ...t, seats, guests: updGuests };
      }
      return t;
    }));
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>;

  const seatedIds = new Set(tables.flatMap(t => t.seats || t.guests?.map(g => g.id) || []));
  const unseated = confirmedGuests.filter(g => !seatedIds.has(g.id));

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-[#080808] border border-white/8">
        {isArchived ? (
          <p className="text-xs text-[#52525B] flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" />
            Seating changes are disabled while this event is archived.
          </p>
        ) : (
        <>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-[#71717A] whitespace-nowrap">Tables</Label>
          <Input
            type="number"
            min={1}
            max={20}
            value={numTables}
            onChange={e => setNumTables(parseInt(e.target.value) || 4)}
            className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-8 w-16 rounded-none text-sm text-center"
          />
        </div>
        <button
          onClick={suggest}
          disabled={suggesting || confirmedGuests.length === 0}
          className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Suggest Seating
        </button>
        {tables.length > 0 && (
          <>
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="flex items-center gap-2 text-xs px-4 py-2 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Save Plan
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="flex items-center gap-2 text-xs px-4 py-2 bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#DC143C] hover:bg-[#DC143C]/20 disabled:opacity-40 transition-colors"
            >
              Mark as Final
            </button>
          </>
        )}
        {seating?.is_final && (
          <span className="text-xs text-emerald-400 border border-emerald-400/30 px-2 py-1">
            Finalised
          </span>
        )}
        </>
        )}
      </div>

      <div className="text-xs text-[#52525B] mb-4">
        {confirmedGuests.length} confirmed · {seatedIds.size} seated · {unseated.length} unassigned
      </div>

      {tables.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          text="No seating plan yet"
          sub={confirmedGuests.length === 0 ? 'Waiting for RSVP confirmations' : 'Click "Suggest Seating" to generate a plan'}
        />
      ) : (
        <div className="space-y-4">
          {tables.map(table => {
            const tableGuests = table.guests?.length
              ? table.guests
              : (table.seats || []).map(id => guestById[id]).filter(Boolean);
            const otherTables = tables.filter(t => t.table_id !== table.table_id);

            return (
              <div key={table.table_id} className="bg-[#080808] border border-white/8 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase tracking-wider text-[#A1A1AA]">{table.label}</h4>
                  {table.note && (
                    <p className="text-xs text-[#52525B] italic max-w-xs truncate">{table.note}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  {tableGuests.length === 0 && (
                    <p className="text-xs text-[#3F3F46] py-2">Empty table</p>
                  )}
                  {tableGuests.map(g => {
                    if (!g) return null;
                    const typeColor = GUEST_TYPE_COLORS[g.guest_type] || GUEST_TYPE_COLORS.guest;
                    return (
                      <div key={g.id} className="flex items-center gap-2 text-sm">
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${typeColor} shrink-0`}>
                          {g.guest_type?.[0]}
                        </span>
                        <span className="text-[#F5F5F0] truncate">{g.name}</span>
                        <span className="text-[#52525B] text-xs truncate">{g.company}</span>
                        {otherTables.length > 0 && (
                          <select
                            onChange={e => { if (e.target.value) moveGuest(g.id, table.table_id, e.target.value); e.target.value = ''; }}
                            defaultValue=""
                            className="ml-auto text-[10px] bg-[#111] border border-white/10 text-[#71717A] px-2 py-0.5 rounded-none cursor-pointer"
                          >
                            <option value="">Move…</option>
                            {otherTables.map(ot => (
                              <option key={ot.table_id} value={ot.table_id}>{ot.label}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {unseated.length > 0 && (
            <div className="bg-[#080808] border border-yellow-500/20 p-4">
              <h4 className="text-xs uppercase tracking-wider text-yellow-400 mb-3">
                Unassigned ({unseated.length})
              </h4>
              <div className="space-y-1.5">
                {unseated.map(g => (
                  <div key={g.id} className="flex items-center gap-2 text-sm">
                    <span className="text-[#F5F5F0]">{g.name}</span>
                    <span className="text-[#52525B] text-xs">{g.company}</span>
                    <select
                      onChange={e => { if (e.target.value) moveGuest(g.id, '__unassigned__', e.target.value); e.target.value = ''; }}
                      defaultValue=""
                      className="ml-auto text-[10px] bg-[#111] border border-white/10 text-[#71717A] px-2 py-0.5 rounded-none cursor-pointer"
                    >
                      <option value="">Assign to…</option>
                      {tables.map(t => (
                        <option key={t.table_id} value={t.table_id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Intro Engine ────────────────────────────────────────────────────────

function IntroEngineTab({ event, guests, isArchived }) {
  const [pairs, setPairs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualA, setManualA] = useState('');
  const [manualB, setManualB] = useState('');
  const [manualMsg, setManualMsg] = useState('');
  const [sendingManual, setSendingManual] = useState(false);

  const confirmedGuests = guests.filter(g => g.rsvp_status === 'yes');

  useEffect(() => { load(); }, [event.id]);

  async function load() {
    try {
      const { data } = await api.get(`/admin/events/${event.id}/intros`);
      setPairs(data);
    } catch { toast.error('Failed to load intro suggestions'); }
    finally { setLoading(false); }
  }

  async function sendIntro(pair, msg = '') {
    const key = `${pair.guest_a.id}:${pair.guest_b.id}`;
    setSending(key);
    try {
      await api.post(`/admin/events/${event.id}/intros/send`, {
        invite_id_a: pair.guest_a.id,
        invite_id_b: pair.guest_b.id,
        message: msg || pair.reason,
      });
      toast.success(`Intro sent: ${pair.guest_a.name} ↔ ${pair.guest_b.name}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send intro');
    } finally { setSending(null); }
  }

  async function sendManual(e) {
    e.preventDefault();
    if (!manualA || !manualB || manualA === manualB) { toast.error('Select two different guests'); return; }
    setSendingManual(true);
    try {
      await api.post(`/admin/events/${event.id}/intros/send`, {
        invite_id_a: manualA,
        invite_id_b: manualB,
        message: manualMsg,
      });
      const a = guests.find(g => g.id === manualA);
      const b = guests.find(g => g.id === manualB);
      toast.success(`Intro sent: ${a?.name} ↔ ${b?.name}`);
      setShowManual(false);
      setManualA(''); setManualB(''); setManualMsg('');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send intro');
    } finally { setSendingManual(false); }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>;

  return (
    <div>
      <SectionHeader
        title={`${pairs.length} suggested pair${pairs.length !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-white/15 text-[#71717A] hover:text-[#F5F5F0] transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
            <button
              onClick={() => setShowManual(true)}
              disabled={isArchived}
              title={isArchived ? 'Restore the event to send intros' : undefined}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-3 h-3" /> Manual Pair
            </button>
          </div>
        }
      />

      {pairs.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          text="No intro suggestions yet"
          sub={confirmedGuests.length < 2
            ? 'Need at least 2 confirmed guests with pre-reads'
            : 'Suggestions appear once guests submit pre-reads'}
        />
      ) : (
        <div className="space-y-2">
          {pairs.map((pair, idx) => {
            const key = `${pair.guest_a.id}:${pair.guest_b.id}`;
            const isSending = sending === key;
            return (
              <div key={idx} className="bg-[#080808] border border-white/8 p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <GuestChip g={pair.guest_a} />
                    <ArrowLeftRight className="w-3.5 h-3.5 text-[#52525B] shrink-0" />
                    <GuestChip g={pair.guest_b} />
                    {pair.score > 0 && (
                      <span className="text-[10px] text-[#52525B] border border-white/8 px-1.5 py-0.5">
                        score {pair.score}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#71717A] leading-relaxed">{pair.reason}</p>
                </div>
                <button
                  onClick={() => sendIntro(pair)}
                  disabled={isSending || isArchived}
                  title={isArchived ? 'Restore the event to send intros' : undefined}
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 border border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send Intro
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Manual pair dialog */}
      <Dialog open={showManual} onOpenChange={setShowManual}>
        <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-medium text-base">Manual Intro</DialogTitle>
          </DialogHeader>
          <form onSubmit={sendManual} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Person A</Label>
              <select
                value={manualA}
                onChange={e => setManualA(e.target.value)}
                className="w-full h-9 bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] text-sm px-3 rounded-none"
              >
                <option value="">Select guest…</option>
                {confirmedGuests.map(g => (
                  <option key={g.id} value={g.id}>{g.name} — {g.company}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Person B</Label>
              <select
                value={manualB}
                onChange={e => setManualB(e.target.value)}
                className="w-full h-9 bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] text-sm px-3 rounded-none"
              >
                <option value="">Select guest…</option>
                {confirmedGuests.filter(g => g.id !== manualA).map(g => (
                  <option key={g.id} value={g.id}>{g.name} — {g.company}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                Message / reason (optional)
              </Label>
              <Textarea
                value={manualMsg}
                onChange={e => setManualMsg(e.target.value)}
                placeholder="Why these two should connect…"
                rows={3}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <Button type="button" variant="ghost" onClick={() => setShowManual(false)}
                className="rounded-none text-[#71717A] hover:text-[#F5F5F0] h-9">Cancel</Button>
              <Button type="submit" disabled={sendingManual}
                className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6 text-sm">
                {sendingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Intro'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuestChip({ g }) {
  const typeColor = GUEST_TYPE_COLORS[g.guest_type] || GUEST_TYPE_COLORS.guest;
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className={`text-[9px] uppercase tracking-wider px-1 py-0.5 border ${typeColor}`}>
        {g.guest_type?.[0]}
      </span>
      <span className="text-[#F5F5F0]">{g.name}</span>
      {g.company && <span className="text-[#71717A] text-xs">{g.company}</span>}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminEventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('Details');
  const [event, setEvent] = useState(null);
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [evRes, guestRes] = await Promise.all([
        api.get(`/admin/events/${id}`),
        api.get(`/admin/events/${id}/guests`),
      ]);
      setEvent(evRes.data);
      setGuests(guestRes.data);
    } catch {
      toast.error('Failed to load event');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleArchive() {
    if (!window.confirm(`Archive "${event.title}"? Public token links will return 410 Gone. You can restore it later.`)) return;
    setArchiving(true);
    try {
      await api.post(`/admin/events/${id}/archive`);
      toast.success('Event archived');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to archive');
    } finally { setArchiving(false); }
  }

  async function handleRestore() {
    setArchiving(true);
    try {
      await api.post(`/admin/events/${id}/restore`);
      toast.success('Event restored to draft');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to restore');
    } finally { setArchiving(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
    </div>
  );

  if (!event) return (
    <div className="text-center py-24">
      <p className="text-[#52525B]">Event not found</p>
    </div>
  );

  const meta = STATUS_META[event.status] || STATUS_META.draft;
  const isArchived = event.status === 'archived';

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <button
          onClick={() => navigate('/admin/events')}
          className="mt-1 text-[#52525B] hover:text-[#A1A1AA] transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={`text-xl font-medium truncate ${isArchived ? 'text-[#71717A]' : 'text-[#F5F5F0]'}`}>
              {event.title}
            </h1>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm text-[#71717A] mt-0.5">
            {event.location}{event.date ? ` · ${new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
          </p>
        </div>
        {/* Archive / Restore button */}
        <div className="shrink-0 mt-0.5">
          {isArchived ? (
            <button
              onClick={handleRestore}
              disabled={archiving}
              className="flex items-center gap-1.5 text-xs px-3 py-2 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10 disabled:opacity-40 transition-colors"
            >
              {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
              Restore
            </button>
          ) : (
            <button
              onClick={handleArchive}
              disabled={archiving}
              className="flex items-center gap-1.5 text-xs px-3 py-2 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20 disabled:opacity-40 transition-colors"
            >
              {archiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Archived banner */}
      {isArchived && (
        <div className="flex items-start gap-3 mb-5 p-4 border border-[#52525B]/30 bg-[#0A0A0A]">
          <Archive className="w-4 h-4 text-[#52525B] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-[#71717A]">This event is archived.</p>
            <p className="text-xs text-[#52525B] mt-0.5">
              All public RSVP and pre-read links return 410 Gone. Guest data and history are preserved.
              No emails can be sent. Restore to resume working on this event.
            </p>
          </div>
        </div>
      )}

      {/* Tab bar */}
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

      {/* Tab content */}
      {tab === 'Details'       && <DetailsTab event={event} onRefresh={load} isArchived={isArchived} />}
      {tab === 'Guest List'    && <GuestListTab event={event} guests={guests} onRefresh={load} isArchived={isArchived} />}
      {tab === 'Invite Status' && <InviteStatusTab event={event} guests={guests} onRefresh={load} isArchived={isArchived} />}
      {tab === 'Pre-reads'     && <PrereadsTab event={event} />}
      {tab === 'Seating'       && <SeatingTab event={event} guests={guests} isArchived={isArchived} />}
      {tab === 'Intro Engine'  && <IntroEngineTab event={event} guests={guests} isArchived={isArchived} />}
    </div>
  );
}
