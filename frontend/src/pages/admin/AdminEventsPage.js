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
import { Plus, CalendarDays, MapPin, Users, ChevronRight, Loader2 } from 'lucide-react';

const STATUS_META = {
  draft:        { label: 'Draft',        color: 'text-[#71717A] border-white/10' },
  invites_sent: { label: 'Invites Sent', color: 'text-yellow-400 border-yellow-500/20' },
  rsvp_open:    { label: 'RSVP Open',   color: 'text-blue-400 border-blue-500/20' },
  confirmed:    { label: 'Confirmed',   color: 'text-emerald-400 border-emerald-500/20' },
  completed:    { label: 'Completed',   color: 'text-[#A1A1AA] border-white/10' },
  cancelled:    { label: 'Cancelled',   color: 'text-red-400 border-red-500/20' },
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
      ) : events.length === 0 ? (
        <div className="text-center py-24 border border-white/8">
          <CalendarDays className="w-8 h-8 text-[#3F3F46] mx-auto mb-4" />
          <p className="text-[#52525B] text-sm">No events yet</p>
          <p className="text-[#3F3F46] text-xs mt-1">Create your first Private Table event</p>
        </div>
      ) : (
        <div className="space-y-2">
          {events.map(ev => {
            const meta = STATUS_META[ev.status] || STATUS_META.draft;
            const s = ev._summary || {};
            return (
              <button
                key={ev.id}
                onClick={() => navigate(`/admin/events/${ev.id}`)}
                className="w-full text-left bg-[#080808] border border-white/8 hover:border-white/15 transition-colors p-5 group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[#F5F5F0] font-medium text-sm truncate">{ev.title}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-5 text-xs text-[#71717A]">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {fmt(ev.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {ev.location || '—'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {s.total ?? 0} invited · {s.rsvp_yes ?? 0} yes · {s.prereads ?? 0} pre-reads
                      </span>
                    </div>
                    {ev.theme && (
                      <p className="text-xs text-[#52525B] mt-1.5 italic">"{ev.theme}"</p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#3F3F46] group-hover:text-[#71717A] transition-colors mt-1 shrink-0" />
                </div>
              </button>
            );
          })}
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
