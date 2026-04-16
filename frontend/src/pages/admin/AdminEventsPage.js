import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, CalendarDays, MapPin, Users, ChevronRight, Loader2, Archive, RotateCcw } from 'lucide-react';

const STATUS_META = {
  draft:        { label: 'Draft',        color: 'text-[#71717A] border-white/10' },
  invites_sent: { label: 'Invites Sent', color: 'text-yellow-400 border-yellow-500/20' },
  rsvp_open:    { label: 'RSVP Open',   color: 'text-blue-400 border-blue-500/20' },
  confirmed:    { label: 'Confirmed',   color: 'text-emerald-400 border-emerald-500/20' },
  completed:    { label: 'Completed',   color: 'text-[#A1A1AA] border-white/10' },
  cancelled:    { label: 'Cancelled',   color: 'text-red-400 border-red-500/20' },
  archived:     { label: 'Archived',    color: 'text-[#52525B] border-white/8' },
};

const EMPTY = {
  title: '', date: '', location: '', theme: '',
  capacity: 20, description: '', dress_code: '',
};

function fmt(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

export default function AdminEventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get('/admin/events');
      setEvents(data);
    } catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title || !form.date || !form.location) {
      toast.error('Title, date, and location are required');
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/admin/events', form);
      toast.success('Event created');
      setShowNew(false);
      setForm(EMPTY);
      navigate(`/admin/events/${data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create event');
    } finally { setCreating(false); }
  }

  async function archiveEvent(e, ev) {
    e.stopPropagation();
    if (!window.confirm(`Archive "${ev.title}"? Public links will return 410 Gone. You can restore it later.`)) return;
    setActioning(ev.id);
    try {
      await api.post(`/admin/events/${ev.id}/archive`);
      toast.success('Event archived');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to archive');
    } finally { setActioning(null); }
  }

  async function restoreEvent(e, ev) {
    e.stopPropagation();
    setActioning(ev.id);
    try {
      await api.post(`/admin/events/${ev.id}/restore`);
      toast.success('Event restored to draft');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to restore');
    } finally { setActioning(null); }
  }

  const active   = events.filter(ev => ev.status !== 'archived');
  const archived = events.filter(ev => ev.status === 'archived');

  function EventRow({ ev, isArchived: rowArchived }) {
    const meta = STATUS_META[ev.status] || STATUS_META.draft;
    const s = ev._summary || {};
    const busy = actioning === ev.id;
    return (
      <button
        onClick={() => navigate(`/admin/events/${ev.id}`)}
        className={`w-full text-left border transition-colors p-5 group ${
          rowArchived
            ? 'bg-[#050505] border-white/5 opacity-60 hover:opacity-80'
            : 'bg-[#080808] border-white/8 hover:border-white/15'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className={`font-medium text-sm truncate ${rowArchived ? 'text-[#71717A]' : 'text-[#F5F5F0]'}`}>
                {ev.title}
              </span>
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${meta.color}`}>
                {meta.label}
              </span>
            </div>
            <div className="flex items-center gap-5 text-xs text-[#71717A]">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />{fmt(ev.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />{ev.location || '—'}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {s.total ?? 0} invited · {s.rsvp_yes ?? 0} yes · {s.prereads ?? 0} pre-reads
              </span>
            </div>
            {ev.theme && <p className="text-xs text-[#52525B] mt-1.5 italic">"{ev.theme}"</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-0.5">
            {rowArchived ? (
              <button
                onClick={e => restoreEvent(e, ev)}
                disabled={busy}
                title="Restore to draft"
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-white/10 text-[#71717A] hover:text-emerald-400 hover:border-emerald-400/30 disabled:opacity-40 transition-colors"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Restore
              </button>
            ) : (
              <button
                onClick={e => archiveEvent(e, ev)}
                disabled={busy}
                title="Archive event"
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-white/10 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20 disabled:opacity-40 transition-all"
              >
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
                Archive
              </button>
            )}
            <ChevronRight className={`w-4 h-4 transition-colors ${rowArchived ? 'text-[#3F3F46]' : 'text-[#3F3F46] group-hover:text-[#71717A]'}`} />
          </div>
        </div>
      </button>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium text-[#F5F5F0]">Private Table</h1>
          <p className="text-sm text-[#71717A] mt-0.5">Curated dinners — events, guests, seating</p>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-4 text-sm gap-2"
        >
          <Plus className="w-4 h-4" /> New Event
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
        </div>
      ) : active.length === 0 && archived.length === 0 ? (
        <div className="text-center py-24 border border-white/8">
          <CalendarDays className="w-8 h-8 text-[#3F3F46] mx-auto mb-4" />
          <p className="text-[#52525B] text-sm">No events yet</p>
          <p className="text-[#3F3F46] text-xs mt-1">Create your first Private Table event</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.length === 0 ? (
            <div className="text-center py-12 border border-white/8">
              <p className="text-[#52525B] text-sm">No active events</p>
            </div>
          ) : (
            active.map(ev => <EventRow key={ev.id} ev={ev} isArchived={false} />)
          )}

          {/* Archived section */}
          {archived.length > 0 && (
            <div className="pt-4">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="flex items-center gap-2 text-xs text-[#52525B] hover:text-[#71717A] transition-colors mb-3"
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
              </button>
              {showArchived && (
                <div className="space-y-1.5">
                  {archived.map(ev => <EventRow key={ev.id} ev={ev} isArchived={true} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* New event dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-[#0C0C0C] border-white/10 rounded-none max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-medium text-base">New Event</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                Title <span className="text-[#DC143C]">*</span>
              </Label>
              <Input
                value={form.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Private Table — April 2026"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                  Date <span className="text-[#DC143C]">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                  Capacity
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={e => set('capacity', parseInt(e.target.value) || 20)}
                  className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">
                Location <span className="text-[#DC143C]">*</span>
              </Label>
              <Input
                value={form.location}
                onChange={e => set('location', e.target.value)}
                placeholder="Taj Land's End, Mumbai"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Theme</Label>
              <Input
                value={form.theme}
                onChange={e => set('theme', e.target.value)}
                placeholder="Scaling without losing the plot"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Dress Code</Label>
              <Input
                value={form.dress_code}
                onChange={e => set('dress_code', e.target.value)}
                placeholder="Smart casual"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Description</Label>
              <Textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={3}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowNew(false)}
                className="rounded-none text-[#71717A] hover:text-[#F5F5F0] h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-[#DC143C] hover:bg-[#b01030] text-white rounded-none h-9 px-6"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
