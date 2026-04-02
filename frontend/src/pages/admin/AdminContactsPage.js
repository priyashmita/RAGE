import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Plus, Search, Mail, RotateCw, Ban, UserCheck, ChevronLeft, ChevronRight, X, Edit2, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const STATUS_COLORS = {
  cold:      'text-[#52525B] bg-[#0A0A0A] border-white/5',
  contacted: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  approved:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  invited:   'text-purple-400 bg-purple-500/10 border-purple-500/20',
  engaged:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  inactive:  'text-[#52525B] bg-[#0A0A0A] border-white/5',
};

const ALLOWED_TAGS = ['founder', 'rager', 'investor', 'operator', 'expert', 'mentor', 'sponsor', 'press'];

function TokenMeta({ user }) {
  if (!user?.invite_sent_at) return null;
  const now     = new Date();
  const expires = user.invite_token_expires ? new Date(user.invite_token_expires) : null;
  const isExpired = expires && expires < now;
  const attempts = user.invite_attempt_count;
  const emailFailed = user.last_email_status === 'failed';

  return (
    <div className="mt-1.5 space-y-0.5">
      <p className="text-[10px] text-[#52525B]">
        Sent {new Date(user.invite_sent_at).toLocaleDateString()}
        {expires && (
          <span className={isExpired ? ' · expired' : ` · expires ${expires.toLocaleDateString()}`}
                style={isExpired ? { color: '#DC143C' } : {}}>
            {isExpired ? ' · link expired' : ` · expires ${expires.toLocaleDateString()}`}
          </span>
        )}
        {attempts > 0 && <span> · attempt {attempts}</span>}
      </p>
      {emailFailed && (
        <p className="text-[10px] text-red-400">
          Last send failed — {user.last_email_error?.slice(0, 100) || 'check Resend dashboard'}
        </p>
      )}
    </div>
  );
}

function ContactRow({ contact, onAction, acting, onEdit }) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const statusColor    = STATUS_COLORS[contact.status] || STATUS_COLORS.cold;
  const userStatus     = contact.user?.status;
  const isPendingSetup = userStatus === 'pending_setup';
  const hasActiveUser  = userStatus === 'active';
  const isActing       = acting === contact.id;

  return (
    <>
      <div className="bg-[#111111] border border-white/5 p-4 flex items-start gap-4 hover:border-white/10 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-medium text-[#F5F5F0]">{contact.name}</p>
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm ${statusColor}`}>
              {contact.status}
            </span>
            {contact.display_role && contact.display_role !== 'unknown' && (
              <span className="text-[10px] uppercase tracking-wider text-[#52525B]">
                {contact.display_role}
              </span>
            )}
            {/* Login state badge */}
            {isPendingSetup && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-orange-500/20 text-orange-400 bg-orange-500/5">
                Pending setup
              </span>
            )}
            {hasActiveUser && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-emerald-500/20 text-emerald-400 bg-emerald-500/5">
                Active
              </span>
            )}
            {userStatus === 'locked' && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-red-500/20 text-red-400 bg-red-500/5">
                Locked
              </span>
            )}
          </div>
          <p className="text-xs text-[#71717A]">{contact.email}</p>
          {(contact.company || contact.title) && (
            <p className="text-xs text-[#52525B] mt-0.5">
              {contact.title}{contact.company ? ` · ${contact.company}` : ''}
            </p>
          )}
          {contact.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {contact.tags.map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[#DC143C]/10 border border-[#DC143C]/20 text-[#DC143C]">
                  {t}
                </span>
              ))}
            </div>
          )}
          {isPendingSetup && <TokenMeta user={contact.user} />}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {(contact.status === 'cold' || contact.status === 'contacted') && (
            <button
              onClick={() => onAction('approve', contact.id)}
              disabled={isActing}
              className="text-[10px] uppercase tracking-wider px-3 py-1.5 border border-white/10 text-[#A1A1AA] hover:border-white/25 hover:text-[#F5F5F0] transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3" /> Approve
            </button>
          )}

          {contact.status === 'approved' && !hasActiveUser && !isPendingSetup && (
            <button
              onClick={() => setShowInviteModal(true)}
              disabled={isActing}
              className="text-[10px] uppercase tracking-wider px-3 py-1.5 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors disabled:opacity-40 flex items-center gap-1"
            >
              <Mail className="w-3 h-3" /> Invite
            </button>
          )}

          {isPendingSetup && (
            <>
              <button
                onClick={() => onAction('resend', contact.id)}
                disabled={isActing}
                className="text-[10px] uppercase tracking-wider px-3 py-1.5 border border-white/10 text-[#A1A1AA] hover:border-white/25 hover:text-[#F5F5F0] transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                {isActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                Resend
              </button>
              <button
                onClick={() => onAction('revoke', contact.id)}
                disabled={isActing}
                className="text-[10px] uppercase tracking-wider px-3 py-1.5 border border-red-900/30 text-red-400/60 hover:text-red-400 hover:border-red-400/40 transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                <Ban className="w-3 h-3" /> Revoke
              </button>
            </>
          )}

          <button
            onClick={() => onEdit(contact)}
            title="Edit contact"
            className="p-1.5 text-[#52525B] hover:text-[#F5F5F0] transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          {!hasActiveUser && (
            <button
              onClick={() => onAction('archive', contact.id)}
              disabled={isActing}
              title="Archive contact"
              className="p-1.5 text-[#52525B] hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {showInviteModal && (
        <InviteModal
          contact={contact}
          onClose={() => setShowInviteModal(false)}
          onInvite={(role) => { setShowInviteModal(false); onAction('invite', contact.id, role); }}
        />
      )}
    </>
  );
}

function InviteModal({ contact, onClose, onInvite }) {
  const [role, setRole] = useState('founder');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="bg-[#111111] border border-white/10 w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-[#F5F5F0]">Invite {contact.name}</h3>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#A1A1AA] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mb-5">
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Role</Label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
          >
            <option value="founder">Founder</option>
            <option value="rager">Rager</option>
          </select>
        </div>
        <p className="text-xs text-[#71717A] mb-5">
          An email will be sent to <strong className="text-[#A1A1AA]">{contact.email}</strong> with a setup link. Link expires in 72 hours.
        </p>
        <div className="flex gap-3">
          <Button
            onClick={() => onInvite(role)}
            className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider"
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Send Invite
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 bg-transparent border-white/10 text-[#71717A] hover:text-[#F5F5F0] rounded-none text-xs uppercase tracking-wider"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function AddContactModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', title: '', city: '', tags: [], notes: '' });
  const [loading, setLoading] = useState(false);

  const toggle = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/admin/contacts', form);
      toast.success(`Contact created — ${res.data.name}`);
      onCreated(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 overflow-y-auto py-8">
      <div className="bg-[#111111] border border-white/10 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-[#F5F5F0]">Add Contact</h3>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#A1A1AA] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Company</Label>
              <Input
                value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Title</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">City</Label>
              <Input
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors ${
                    form.tags.includes(tag)
                      ? 'bg-[#DC143C]/10 border-[#DC143C]/40 text-[#DC143C]'
                      : 'border-white/10 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Notes</Label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add Contact'}
            </Button>
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 bg-transparent border-white/10 text-[#71717A] hover:text-[#F5F5F0] rounded-none text-xs uppercase tracking-wider"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditContactModal({ contact, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:    contact.name    || '',
    phone:   contact.phone   || '',
    company: contact.company || '',
    title:   contact.title   || '',
    city:    contact.city    || '',
    tags:    contact.tags    || [],
    notes:   contact.notes   || '',
  });
  const [loading, setLoading] = useState(false);

  const toggle = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put(`/admin/contacts/${contact.id}`, form);
      toast.success('Contact updated');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update contact');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 overflow-y-auto py-8">
      <div className="bg-[#111111] border border-white/10 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-[#F5F5F0]">Edit — {contact.name}</h3>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#A1A1AA] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Name *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Company</Label>
              <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Title</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">City</Label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-2 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALLOWED_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className={`text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors ${
                    form.tags.includes(tag)
                      ? 'bg-[#DC143C]/10 border-[#DC143C]/40 text-[#DC143C]'
                      : 'border-white/10 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Notes</Label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
            </Button>
            <Button type="button" onClick={onClose} variant="outline"
              className="flex-1 bg-transparent border-white/10 text-[#71717A] hover:text-[#F5F5F0] rounded-none text-xs uppercase tracking-wider">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (q.trim()) params.q = q.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/contacts', { params });
      setContacts(res.data.contacts || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [page, q, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action, contactId, role) => {
    setActing(contactId);
    try {
      if (action === 'approve') {
        await api.patch(`/admin/contacts/${contactId}/status`, { status: 'approved' });
        toast.success('Contact approved');
      } else if (action === 'invite') {
        await api.post(`/admin/contacts/${contactId}/invite`, { role });
        toast.success('Invite sent');
      } else if (action === 'resend') {
        await api.post(`/admin/contacts/${contactId}/resend-invite`);
        toast.success('Invite resent');
      } else if (action === 'revoke') {
        await api.post(`/admin/contacts/${contactId}/revoke-invite`);
        toast.success('Invite revoked');
      } else if (action === 'archive') {
        if (!window.confirm('Archive this contact? They will be hidden from the list.')) return;
        await api.delete(`/admin/contacts/${contactId}`);
        toast.success('Contact archived');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || `${action} failed`);
    } finally {
      setActing(null);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
          <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Contacts</h1>
          <p className="text-sm text-[#52525B] mt-1">{total} contacts</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 text-xs uppercase tracking-wider px-4 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-48">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
            <Input
              value={q}
              onChange={e => { setQ(e.target.value); if (!e.target.value) { setPage(1); } }}
              placeholder="Search name, email, company..."
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm pl-9"
            />
          </div>
        </form>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-[#0A0A0A] border border-white/10 text-[#A1A1AA] text-xs px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
        >
          <option value="">All statuses</option>
          {['cold', 'contacted', 'approved', 'invited', 'engaged', 'inactive'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
          <p className="text-[#52525B] text-sm">No contacts found.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {contacts.map(contact => (
            <ContactRow
              key={contact.id}
              contact={contact}
              onAction={handleAction}
              acting={acting}
              onEdit={setEditContact}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <p className="text-xs text-[#52525B]">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {showAdd && (
        <AddContactModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); load(); }}
        />
      )}

      {editContact && (
        <EditContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSaved={() => { setEditContact(null); load(); }}
        />
      )}
    </div>
  );
}
