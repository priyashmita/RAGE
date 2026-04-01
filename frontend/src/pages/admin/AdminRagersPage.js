import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Upload, Search, Edit2, Trash2, Sparkles, Loader2, Globe, GlobeLock, ChevronDown,
  ShieldCheck, Send,
} from 'lucide-react';

const CATEGORIES = [
  'Finance & Fundraising', 'Legal & Compliance', 'Marketing & Brand',
  'Operations & Scale', 'Technology & Product', 'Strategy & Growth',
  'People & Culture', 'Sales & Distribution', 'Media & Communications',
  'International Expansion',
];

const TABLE_TYPES = ['closed_table', 'private_table', 'sunday_table'];

const EMPTY_FORM = {
  name: '', email: '', phone: '', photo_url: '', title: '', company: '',
  bio: '', expertise: [], categories: [], location: '',
  linkedin: '', is_public: false, table_types: [], availability: 'available',
};

const LOGIN_STATUS = {
  no_contact:    { label: 'No contact',    color: 'text-[#52525B] border-white/10' },
  not_approved:  { label: 'Not approved',  color: 'text-[#71717A] border-white/10' },
  approved:      { label: 'Approved',      color: 'text-yellow-400 border-yellow-500/20' },
  pending_setup: { label: 'Pending setup', color: 'text-orange-400 border-orange-500/20' },
  active:        { label: 'Active',        color: 'text-emerald-400 border-emerald-500/20' },
  locked:        { label: 'Locked',        color: 'text-red-400 border-red-500/20' },
  disabled:      { label: 'Disabled',      color: 'text-[#52525B] border-white/10' },
};

function TagInput({ label, value, onChange, placeholder }) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setInput('');
  };

  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">{label}</Label>
      <div className="flex gap-2 mb-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm"
          placeholder={placeholder}
        />
        <Button type="button" onClick={add} variant="outline" className="h-9 rounded-none border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] px-3">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 bg-[#111] border border-white/10 text-[#A1A1AA] text-xs px-2 py-0.5">
            {tag}
            <button type="button" onClick={() => onChange(value.filter(t => t !== tag))} className="text-[#52525B] hover:text-[#F5F5F0] ml-0.5">×</button>
          </span>
        ))}
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Categories</Label>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => {
          const active = value.includes(cat);
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onChange(active ? value.filter(c => c !== cat) : [...value, cat])}
              className={`text-xs px-2.5 py-1 border transition-colors ${
                active ? 'bg-[#DC143C]/10 border-[#DC143C] text-[#DC143C]' : 'bg-transparent border-white/10 text-[#71717A] hover:border-white/30 hover:text-[#A1A1AA]'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RagerForm({ form, setForm, onSubmit, onCategorize, categorizing, saving, editId }) {
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-8">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Name *</Label>
          <Input value={form.name} onChange={e => update('name', e.target.value)} required className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Email <span className="text-[#52525B] normal-case tracking-normal">(private)</span></Label>
          <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Phone <span className="text-[#52525B] normal-case tracking-normal">(private — never shown publicly)</span></Label>
        <Input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98XXX XXXXX" className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Title</Label>
          <Input value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. CFO, Founding Partner" className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Company</Label>
          <Input value={form.company} onChange={e => update('company', e.target.value)} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Bio</Label>
        <Textarea
          value={form.bio}
          onChange={e => update('bio', e.target.value)}
          placeholder="Brief background — used for AI categorization"
          className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[80px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Location</Label>
          <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. Mumbai" className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">LinkedIn URL</Label>
          <Input value={form.linkedin} onChange={e => update('linkedin', e.target.value)} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-1.5 block">Photo URL</Label>
        <Input value={form.photo_url} onChange={e => update('photo_url', e.target.value)} placeholder="Paste image URL (Cloudinary, Drive, etc.)" className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
        {form.photo_url && (
          <img src={form.photo_url} alt="preview" className="w-12 h-12 object-cover mt-2 border border-white/10" onError={e => e.target.style.display='none'} />
        )}
      </div>

      <TagInput label="Expertise (press Enter to add)" value={form.expertise} onChange={v => update('expertise', v)} placeholder="e.g. Fundraising" />

      <div className="flex items-center justify-between">
        <CategorySelect value={form.categories} onChange={v => update('categories', v)} />
      </div>

      {editId && (
        <Button type="button" variant="outline" onClick={onCategorize} disabled={categorizing}
          className="w-full border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] rounded-none h-9 text-xs uppercase tracking-wider">
          {categorizing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
          AI Auto-Categorize
        </Button>
      )}

      <div>
        <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Available For</Label>
        <div className="flex flex-wrap gap-2">
          {TABLE_TYPES.map(t => {
            const active = form.table_types.includes(t);
            return (
              <button key={t} type="button"
                onClick={() => update('table_types', active ? form.table_types.filter(x => x !== t) : [...form.table_types, t])}
                className={`text-xs px-3 py-1.5 border transition-colors ${active ? 'bg-[#DC143C]/10 border-[#DC143C] text-[#DC143C]' : 'border-white/10 text-[#71717A] hover:border-white/30'}`}>
                {t.replace('_', ' ')}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-[#0A0A0A] border border-white/8">
        <div>
          <p className="text-sm text-[#F5F5F0]">Visible on public site</p>
          <p className="text-xs text-[#52525B]">Show this Rager on the network page</p>
        </div>
        <Switch checked={form.is_public} onCheckedChange={v => update('is_public', v)} />
      </div>

      <Button type="submit" disabled={saving} className="w-full h-10 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider font-semibold">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Save Changes' : 'Add Rager'}
      </Button>
    </form>
  );
}

export default function AdminRagersPage() {
  const [ragers, setRagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);

  const [approving, setApproving] = useState(null);
  const [inviting, setInviting] = useState(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJson, setBulkJson] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  const fetchRagers = useCallback(() => {
    setLoading(true);
    api.get('/admin/ragers')
      .then(r => setRagers(r.data))
      .catch(() => toast.error('Failed to load ragers'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRagers(); }, [fetchRagers]);

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setSheetOpen(true); };
  const openEdit = (r) => { setForm({ ...EMPTY_FORM, ...r }); setEditId(r.id); setSheetOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/admin/ragers/${editId}`, form);
        toast.success('Rager updated');
      } else {
        await api.post('/admin/ragers', form);
        toast.success('Rager added');
      }
      setSheetOpen(false);
      fetchRagers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}?`)) return;
    try {
      await api.delete(`/admin/ragers/${id}`);
      toast.success('Deleted');
      fetchRagers();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleCategorize = async () => {
    if (!editId) return;
    setCategorizing(true);
    try {
      const res = await api.post(`/admin/ragers/${editId}/categorize`);
      setForm(f => ({ ...f, categories: res.data.categories }));
      toast.success('Categories updated');
    } catch {
      toast.error('Categorization failed');
    } finally {
      setCategorizing(false);
    }
  };

  const handleApprove = async (ragerId) => {
    setApproving(ragerId);
    try {
      await api.post(`/admin/ragers/${ragerId}/approve-login`);
      toast.success('Rager approved for login — you can now send the invite');
      fetchRagers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Approval failed');
    } finally {
      setApproving(null);
    }
  };

  const handleSendInvite = async (ragerId, contactId) => {
    if (!contactId) { toast.error('No contact linked — approve first'); return; }
    setInviting(ragerId);
    try {
      await api.post(`/admin/contacts/${contactId}/invite`, { role: 'rager' });
      toast.success('Invite sent — rager will receive a setup email');
      fetchRagers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send invite');
    } finally {
      setInviting(null);
    }
  };

  const handleTogglePublic = async (r) => {
    try {
      await api.put(`/admin/ragers/${r.id}`, { ...r, is_public: !r.is_public });
      fetchRagers();
    } catch {
      toast.error('Failed');
    }
  };

  const handleBulkUpload = async () => {
    let profiles;
    try {
      profiles = JSON.parse(bulkJson);
      if (!Array.isArray(profiles)) throw new Error();
    } catch {
      toast.error('Invalid JSON — must be an array of objects');
      return;
    }
    setBulkLoading(true);
    try {
      const res = await api.post('/admin/ragers/bulk', { profiles, auto_categorize: true });
      toast.success(`${res.data.created} Ragers uploaded and categorized`);
      setBulkOpen(false);
      setBulkJson('');
      fetchRagers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = ragers.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name?.toLowerCase().includes(q) || r.company?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q);
    const matchCat = !categoryFilter || (r.categories || []).includes(categoryFilter);
    return matchSearch && matchCat;
  });

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
          <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Ragers</h1>
          <p className="text-sm text-[#52525B] mt-1">{ragers.length} total · {ragers.filter(r => r.is_public).length} public</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] rounded-none h-9 text-xs uppercase tracking-wider">
            <Upload className="w-3.5 h-3.5 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={openAdd} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-9 text-xs uppercase tracking-wider">
            <Plus className="w-3.5 h-3.5 mr-2" /> Add Rager
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B]" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company..." className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-9 rounded-none text-sm pl-8" />
        </div>
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="appearance-none bg-[#0A0A0A] border border-white/10 text-[#A1A1AA] h-9 px-3 pr-8 text-sm rounded-none outline-none hover:border-white/20 cursor-pointer"
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525B] pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-16 text-center">
          <p className="text-[#52525B] text-sm">{ragers.length === 0 ? 'No Ragers yet. Add one or bulk upload.' : 'No results for your search.'}</p>
        </div>
      ) : (
        <div className="border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-[#0A0A0A]">
                <th className="text-left text-[10px] uppercase tracking-wider text-[#52525B] px-4 py-3 font-medium">Rager</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-[#52525B] px-4 py-3 font-medium hidden md:table-cell">Categories</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-[#52525B] px-4 py-3 font-medium hidden lg:table-cell">Tables</th>
                <th className="text-center text-[10px] uppercase tracking-wider text-[#52525B] px-4 py-3 font-medium">Public</th>
                <th className="text-left text-[10px] uppercase tracking-wider text-[#52525B] px-4 py-3 font-medium hidden xl:table-cell">Login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {r.photo_url ? (
                        <img src={r.photo_url} alt={r.name} className="w-8 h-8 object-cover border border-white/10 shrink-0" onError={e => e.target.style.display='none'} />
                      ) : (
                        <div className="w-8 h-8 bg-[#111] border border-white/10 flex items-center justify-center shrink-0">
                          <span className="text-xs text-[#52525B] font-medium">{r.name?.[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-[#F5F5F0]">{r.name}</p>
                        <p className="text-xs text-[#52525B]">{r.title}{r.company ? ` · ${r.company}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(r.categories || []).slice(0, 2).map(c => (
                        <span key={c} className="text-[10px] px-1.5 py-0.5 bg-[#111] border border-white/8 text-[#71717A]">{c}</span>
                      ))}
                      {(r.categories || []).length > 2 && <span className="text-[10px] text-[#52525B]">+{r.categories.length - 2}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(r.table_types || []).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 border border-white/8 text-[#52525B]">{t.replace('_', ' ')}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleTogglePublic(r)} className="transition-colors" title={r.is_public ? 'Click to hide' : 'Click to publish'}>
                      {r.is_public
                        ? <Globe className="w-4 h-4 text-emerald-500 mx-auto" />
                        : <GlobeLock className="w-4 h-4 text-[#52525B] mx-auto" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    {(() => {
                      const ls = r.login_status || 'no_contact';
                      const cfg = LOGIN_STATUS[ls] || LOGIN_STATUS.no_contact;
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border whitespace-nowrap ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          {ls === 'not_approved' && (
                            <button
                              disabled={approving === r.id}
                              onClick={() => handleApprove(r.id)}
                              title="Approve for login"
                              className="p-1 text-[#52525B] hover:text-yellow-400 transition-colors disabled:opacity-40"
                            >
                              {approving === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {ls === 'approved' && (
                            <button
                              disabled={inviting === r.id}
                              onClick={() => handleSendInvite(r.id, r.contact_id)}
                              title="Send invite email"
                              className="p-1 text-[#52525B] hover:text-[#DC143C] transition-colors disabled:opacity-40"
                            >
                              {inviting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-[#52525B] hover:text-[#F5F5F0] transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 text-[#52525B] hover:text-red-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="bg-[#0A0A0A] border-white/10 w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-[#F5F5F0] font-light tracking-tight">{editId ? 'Edit Rager' : 'Add Rager'}</SheetTitle>
          </SheetHeader>
          <RagerForm form={form} setForm={setForm} onSubmit={handleSubmit} onCategorize={handleCategorize} categorizing={categorizing} saving={saving} editId={editId} />
        </SheetContent>
      </Sheet>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 max-w-2xl rounded-none">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-light">Bulk Upload Ragers</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[#71717A]">
              Paste a JSON array of profiles. Categories will be auto-generated by AI. Required: <code className="text-[#DC143C]">name</code>. Optional: email, title, company, bio, location, linkedin, photo_url, expertise, table_types.
            </p>
            <div className="bg-[#111] border border-white/8 p-3 text-xs text-[#52525B] font-mono leading-relaxed">
              {`[
  {
    "name": "Priya Sharma",
    "title": "CFO",
    "company": "TechCorp",
    "bio": "20 years in financial operations...",
    "email": "priya@example.com",
    "location": "Mumbai",
    "linkedin": "https://linkedin.com/in/priya",
    "expertise": ["fundraising", "financial modelling"]
  }
]`}
            </div>
            <Textarea
              value={bulkJson}
              onChange={e => setBulkJson(e.target.value)}
              placeholder="Paste JSON array here..."
              className="bg-[#050505] border-white/15 text-[#F5F5F0] rounded-none text-sm font-mono min-h-[200px]"
            />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setBulkOpen(false)} className="flex-1 border-white/15 text-[#A1A1AA] rounded-none">Cancel</Button>
              <Button onClick={handleBulkUpload} disabled={bulkLoading || !bulkJson.trim()} className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider">
                {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                Upload & Auto-Categorize
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
