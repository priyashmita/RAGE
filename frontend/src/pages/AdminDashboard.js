import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Zap, Calendar, CreditCard, FileText, Activity, Plus, Play, CheckCircle, Loader2, ShieldCheck, Mail, MessageSquare, PenLine, UserPlus } from 'lucide-react';
import AdminContentEditor from '@/pages/AdminContentEditor';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [ctRequests, setCtRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [networkMembers, setNetworkMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAll = useCallback(async () => {
    try {
      const [statsR, usersR, reqsR, matchR, sessR, evtR, payR, logR, enqR, ctR, bookR, nmR] = await Promise.all([
        api.get('/admin/stats'), api.get('/admin/users'), api.get('/admin/requests'),
        api.get('/admin/matches'), api.get('/admin/sessions'), api.get('/events'),
        api.get('/admin/payments'), api.get('/admin/audit-logs'), api.get('/admin/enquiries'),
        api.get('/admin/closed-table-requests').catch(() => ({ data: [] })),
        api.get('/admin/bookings').catch(() => ({ data: [] })),
        api.get('/admin/network-members').catch(() => ({ data: [] }))
      ]);
      setStats(statsR.data); setUsers(usersR.data); setRequests(reqsR.data);
      setMatches(matchR.data); setSessions(sessR.data); setEvents(evtR.data);
      setPayments(payR.data); setAuditLogs(logR.data); setEnquiries(enqR.data);
      setCtRequests(ctR.data); setBookings(bookR.data); setNetworkMembers(nmR.data);
    } catch { toast.error('Failed to load admin data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user?.role === 'admin') fetchAll(); }, [user, fetchAll]);

  if (user?.role !== 'admin') return <div className="text-[#71717A] text-center py-20">Access denied. Admin only.</div>;
  if (loading) return <div className="flex items-center justify-center h-64 text-[#A1A1AA]"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div data-testid="admin-dashboard">
      <div className="flex items-center gap-3 mb-10">
        <ShieldCheck className="w-6 h-6 text-[#DC143C]" />
        <div>
          <p className="rage-overline mb-1">Admin Panel</p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0]">Command Center</h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#111111] border border-white/8 rounded-none p-1 h-auto flex flex-wrap gap-0">
          {[
            { v: 'overview', l: 'Overview', i: Activity },
            { v: 'network', l: 'Network', i: UserPlus },
            { v: 'closed-table', l: 'Closed Table', i: MessageSquare },
            { v: 'users', l: 'Users', i: Users },
            { v: 'requests', l: 'Requests', i: FileText },
            { v: 'matches', l: 'Matches', i: Zap },
            { v: 'sessions', l: 'Sessions', i: Activity },
            { v: 'events', l: 'Events', i: Calendar },
            { v: 'enquiries', l: 'Enquiries', i: Mail },
            { v: 'content', l: 'Content', i: PenLine },
            { v: 'payments', l: 'Payments', i: CreditCard },
            { v: 'logs', l: 'Audit Logs', i: FileText },
          ].map(t => (
            <TabsTrigger key={t.v} value={t.v} className="rounded-none data-[state=active]:bg-[#DC143C] data-[state=active]:text-white text-[#A1A1AA] text-xs uppercase tracking-wider px-4 py-2" data-testid={`admin-tab-${t.v}`}>
              <t.i className="w-3.5 h-3.5 mr-1.5" />{t.l}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { l: 'Users', v: stats.users, c: 'text-[#F5F5F0]' },
              { l: 'Requests', v: stats.requests, c: 'text-blue-400' },
              { l: 'Matches', v: stats.matches, c: 'text-amber-400' },
              { l: 'Sessions', v: stats.sessions, c: 'text-emerald-400' },
              { l: 'Events', v: stats.events, c: 'text-purple-400' },
              { l: 'Payments', v: stats.payments, c: 'text-[#DC143C]' },
            ].map(s => (
              <div key={s.l} className="rage-stat" data-testid={`stat-${s.l.toLowerCase()}`}>
                <p className="text-[10px] uppercase tracking-widest text-[#71717A] mb-1">{s.l}</p>
                <p className={`text-3xl font-light font-mono ${s.c}`}>{s.v || 0}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Network Members */}
        <TabsContent value="network">
          <NetworkMembersTab members={networkMembers} onRefresh={fetchAll} />
        </TabsContent>

        {/* Closed Table Requests */}
        <TabsContent value="closed-table">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-[#A1A1AA]">{ctRequests.length} request{ctRequests.length !== 1 ? 's' : ''}</p>
          </div>
          {ctRequests.length === 0 ? (
            <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center text-[#71717A]">No Closed Table requests yet.</div>
          ) : (
            <div className="space-y-3">
              {ctRequests.map(r => (
                <CTRequestCard key={r.id} request={r} onRefresh={fetchAll} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Users */}
        <TabsContent value="users">
          <AdminTable headers={['Name', 'Email', 'Role', 'Status', 'Joined']}>
            {users.map(u => (
              <TableRow key={u.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0]">{u.name}</TableCell>
                <TableCell className="text-[#A1A1AA] font-mono text-xs">{u.email}</TableCell>
                <TableCell><RoleBadge role={u.role} /></TableCell>
                <TableCell><span className={`status-${u.status}`}>{u.status}</span></TableCell>
                <TableCell className="font-mono text-xs text-[#71717A]">{new Date(u.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>

        {/* Requests */}
        <TabsContent value="requests">
          <AdminTable headers={['Title', 'Founder', 'Categories', 'Urgency', 'Status', 'Action']}>
            {requests.map(r => (
              <TableRow key={r.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0] max-w-[200px] truncate">{r.title}</TableCell>
                <TableCell className="text-[#A1A1AA] text-xs">{r.founder_name}</TableCell>
                <TableCell><div className="flex gap-1 flex-wrap">{r.categories?.map(c => <Badge key={c} variant="outline" className="rounded-none text-[9px] text-[#71717A] border-white/10">{c}</Badge>)}</div></TableCell>
                <TableCell><UrgencyBadge urgency={r.urgency} /></TableCell>
                <TableCell><span className={`rage-badge status-${r.status}`}>{r.status}</span></TableCell>
                <TableCell>
                  {r.status === 'pending' && (
                    <RunMatchButton requestId={r.id} onDone={fetchAll} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>

        {/* Matches */}
        <TabsContent value="matches">
          <AdminTable headers={['Expert', 'Score', 'Tags', 'Status', 'Date', 'Action']}>
            {matches.map(m => (
              <TableRow key={m.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0]">{m.expert_name}</TableCell>
                <TableCell className="font-mono text-[#F5F5F0]">{m.score}%</TableCell>
                <TableCell><div className="flex gap-1 flex-wrap">{m.matched_tags?.map(t => <Badge key={t} variant="outline" className="rounded-none text-[9px] text-[#DC143C] border-[#DC143C]/30">{t}</Badge>)}</div></TableCell>
                <TableCell><span className={`rage-badge status-${m.status}`}>{m.status}</span></TableCell>
                <TableCell className="font-mono text-xs text-[#71717A]">{new Date(m.matched_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {m.status === 'accepted' && <CreateSessionButton matchId={m.id} onDone={fetchAll} />}
                </TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions">
          <AdminTable headers={['Expert', 'Scheduled', 'Duration', 'Status', 'Action']}>
            {sessions.map(s => (
              <TableRow key={s.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0]">{s.expert_name}</TableCell>
                <TableCell className="font-mono text-xs text-[#A1A1AA]">{new Date(s.scheduled_at).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-[#F5F5F0]">{s.duration_minutes} min</TableCell>
                <TableCell><span className={`rage-badge status-${s.status}`}>{s.status}</span></TableCell>
                <TableCell>
                  {s.status === 'scheduled' && <CompleteSessionButton sessionId={s.id} onDone={fetchAll} />}
                </TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>

        {/* Events */}
        <TabsContent value="events">
          <div className="flex justify-end mb-4">
            <CreateEventDialog onDone={fetchAll} />
          </div>
          <AdminTable headers={['Title', 'Date', 'Venue', 'Seats', 'Price', 'Status']}>
            {events.map(e => (
              <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0]">{e.title}</TableCell>
                <TableCell className="font-mono text-xs text-[#A1A1AA]">{new Date(e.date).toLocaleDateString()}</TableCell>
                <TableCell className="text-[#A1A1AA]">{e.venue}</TableCell>
                <TableCell className="font-mono text-[#F5F5F0]">{e.available_seats}/{e.total_seats}</TableCell>
                <TableCell className="font-mono text-[#F5F5F0]">INR {e.price_per_seat?.toLocaleString()}</TableCell>
                <TableCell><span className={`rage-badge status-${e.status}`}>{e.status}</span></TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>

        {/* Enquiries */}
        <TabsContent value="enquiries">
          <AdminTable headers={['Name', 'Email', 'Company', 'Interest', 'Message', 'Status', 'Date']}>
            {enquiries.map(e => (
              <TableRow key={e.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0]">{e.name}</TableCell>
                <TableCell className="font-mono text-xs text-[#A1A1AA]">{e.email}</TableCell>
                <TableCell className="text-[#A1A1AA]">{e.company}</TableCell>
                <TableCell><span className="rage-badge text-[#DC143C]">{e.interest}</span></TableCell>
                <TableCell className="text-[#71717A] text-xs max-w-[200px] truncate">{e.message}</TableCell>
                <TableCell><span className={`rage-badge status-${e.status}`}>{e.status}</span></TableCell>
                <TableCell className="font-mono text-[10px] text-[#71717A]">{new Date(e.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content">
          <AdminContentEditor />
        </TabsContent>

        {/* Payments & Bookings */}
        <TabsContent value="payments">
          <h3 className="text-sm text-[#A1A1AA] mb-4">Bookings & Payments</h3>
          {bookings.length === 0 && payments.length === 0 ? (
            <div className="border border-white/5 bg-[#0A0A0A] p-8 text-center text-[#71717A]">No bookings or payments yet.</div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => (
                <div key={b.id} className="bg-[#111111] border border-white/8 p-4 flex items-center justify-between gap-4" data-testid={`booking-${b.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-[#F5F5F0] font-medium" style={{ fontFamily: 'Manrope' }}>{b.user_name || 'User'}</p>
                      <span className="text-xs text-[#71717A] font-mono">{b.user_email || ''}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                      <span>{b.seats} seat{b.seats > 1 ? 's' : ''}</span>
                      <span className="text-[#71717A]">·</span>
                      <span className="font-mono">INR {b.total_amount?.toLocaleString()}</span>
                      <span className="text-[#71717A]">·</span>
                      <span className={b.payment_method === 'bank_transfer' ? 'text-amber-400' : 'text-blue-400'}>{b.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Razorpay'}</span>
                    </div>
                    <p className="text-[10px] text-[#71717A] font-mono mt-1">{new Date(b.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`rage-badge status-${b.status}`}>{b.status?.replace(/_/g, ' ')}</span>
                    {b.payment_method === 'bank_transfer' && b.status !== 'confirmed' && b.status !== 'cancelled' && (
                      <BookingPaymentControl bookingId={b.id} onDone={fetchAll} />
                    )}
                  </div>
                </div>
              ))}
              {payments.filter(p => !bookings.some(b => b.payment_id === p.id)).map(p => (
                <div key={p.id} className="bg-[#111111] border border-white/5 p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#A1A1AA]">{p.type} · <span className="font-mono">INR {(p.amount / 100).toLocaleString()}</span></p>
                    <p className="text-[10px] text-[#71717A] font-mono">{new Date(p.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`rage-badge status-${p.status}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="logs">
          <AdminTable headers={['Action', 'Entity', 'Details', 'Date']}>
            {auditLogs.slice(0, 100).map(l => (
              <TableRow key={l.id} className="border-white/5 hover:bg-white/[0.02]">
                <TableCell className="text-[#F5F5F0] text-xs">{l.action}</TableCell>
                <TableCell className="text-[#A1A1AA] text-xs">{l.entity_type}</TableCell>
                <TableCell className="text-[#71717A] text-xs max-w-[300px] truncate">{l.details}</TableCell>
                <TableCell className="font-mono text-[10px] text-[#71717A]">{new Date(l.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </AdminTable>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Network Members Tab ──
const PARTICIPATION_MODES = ['volunteer', 'paid', 'both'];
const ALL_TAGS = ['technology','marketing','finance','operations','strategy','product','design','sales','hr','legal','fundraising','growth'];

function NetworkMembersTab({ members, onRefresh }) {
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});

  const openNew = () => { setForm({ name:'', email:'', phone:'', company:'', title:'', bio:'', tags:[], industries:[], stage_experience:[], geography:[], is_rage_member:true, participation_mode:'both', free_hours_total:300, free_hours_used:0, hourly_rate:0, can_accept_closed_table:true, can_accept_private_table:true, availability:'this_week', status:'active', notes:'' }); setEditing('new'); };
  const openEdit = (m) => { setForm({...m}); setEditing(m.id); };
  const close = () => { setEditing(null); setForm({}); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing === 'new') { await api.post('/admin/network-members', form); toast.success('Member added'); }
      else { await api.put(`/admin/network-members/${editing}`, form); toast.success('Member updated'); }
      close(); onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  const deactivate = async (id) => {
    try { await api.put(`/admin/network-members/${id}/deactivate`); toast.success('Deactivated'); onRefresh(); } catch { toast.error('Failed'); }
  };

  const toggleTag = (tag) => setForm(p => ({...p, tags: p.tags?.includes(tag) ? p.tags.filter(t => t !== tag) : [...(p.tags||[]), tag]}));

  const freeRemaining = (m) => m.participation_mode === 'paid' ? '—' : `${Math.max((m.free_hours_total||300)-(m.free_hours_used||0),0)} min`;

  if (editing) {
    return (
      <div className="space-y-4" data-testid="member-edit-form">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-[#F5F5F0]">{editing === 'new' ? 'Add Network Member' : 'Edit Member'}</h3>
          <button onClick={close} className="text-xs text-[#71717A] hover:text-[#F5F5F0]">Cancel</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[['name','Name *'],['email','Email'],['phone','Phone'],['company','Company'],['title','Title']].map(([k,l]) => (
            <div key={k}><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">{l}</Label><Input value={form[k]||''} onChange={e => setForm({...form,[k]:e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none h-8 text-sm mt-1" data-testid={`member-${k}`} /></div>
          ))}
          <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">Participation</Label>
            <select value={form.participation_mode||'both'} onChange={e => setForm({...form, participation_mode:e.target.value})} className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 px-2 text-sm rounded-none mt-1" data-testid="member-participation">
              {PARTICIPATION_MODES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">Hourly Rate (₹)</Label><Input type="number" value={form.hourly_rate||0} onChange={e => setForm({...form, hourly_rate:Number(e.target.value)})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none h-8 text-sm mt-1 font-mono" data-testid="member-rate" /></div>
          <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">Free Hours Total (min)</Label><Input type="number" value={form.free_hours_total||300} onChange={e => setForm({...form, free_hours_total:Number(e.target.value)})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none h-8 text-sm mt-1 font-mono" data-testid="member-free-total" /></div>
          <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">Free Hours Used (min)</Label><Input type="number" value={form.free_hours_used||0} onChange={e => setForm({...form, free_hours_used:Number(e.target.value)})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none h-8 text-sm mt-1 font-mono" data-testid="member-free-used" /></div>
          <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">Availability</Label>
            <select value={form.availability||'this_week'} onChange={e => setForm({...form, availability:e.target.value})} className="w-full bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-8 px-2 text-sm rounded-none mt-1" data-testid="member-availability">
              {['immediate','this_week','next_week','unavailable'].map(a => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
            </select>
          </div>
        </div>
        <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider mb-2 block">Expertise Tags</Label>
          <div className="flex flex-wrap gap-1.5">{ALL_TAGS.map(tag => (<button key={tag} type="button" onClick={() => toggleTag(tag)} className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border transition-colors ${form.tags?.includes(tag) ? 'bg-[#DC143C]/20 border-[#DC143C] text-[#DC143C]' : 'bg-transparent border-white/15 text-[#71717A] hover:border-white/30'}`} data-testid={`member-tag-${tag}`}>{tag}</button>))}</div>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <label className="flex items-center gap-2 text-xs text-[#A1A1AA]"><input type="checkbox" checked={form.can_accept_closed_table} onChange={e => setForm({...form, can_accept_closed_table:e.target.checked})} /> Closed Table</label>
          <label className="flex items-center gap-2 text-xs text-[#A1A1AA]"><input type="checkbox" checked={form.can_accept_private_table} onChange={e => setForm({...form, can_accept_private_table:e.target.checked})} /> Private Table</label>
          <label className="flex items-center gap-2 text-xs text-[#A1A1AA]"><input type="checkbox" checked={form.is_rage_member} onChange={e => setForm({...form, is_rage_member:e.target.checked})} /> RAGE Member</label>
        </div>
        <div><Label className="text-[10px] text-[#71717A] uppercase tracking-wider">Notes (internal)</Label><Textarea value={form.notes||''} onChange={e => setForm({...form, notes:e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[60px] mt-1" data-testid="member-notes" /></div>
        <Button onClick={save} disabled={saving || !form.name} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-9 px-6 text-xs uppercase tracking-wider" data-testid="member-save-btn">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (editing === 'new' ? 'Add Member' : 'Save Changes')}
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="network-members-tab">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#A1A1AA]">{members.length} network member{members.length !== 1 ? 's' : ''}</p>
        <Button onClick={openNew} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-8 text-[11px] px-4" data-testid="add-member-btn"><UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add Member</Button>
      </div>
      {members.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center text-[#71717A]">No network members yet. Add women from the RAGE network.</div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="bg-[#111111] border border-white/8 p-4 flex items-center justify-between gap-4" data-testid={`nm-${m.id}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 bg-[#DC143C]/10 flex items-center justify-center shrink-0"><span className="text-[#DC143C] text-[10px] font-semibold font-mono">{m.name?.split(' ').map(n=>n[0]).join('')}</span></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><p className="text-sm text-[#F5F5F0] font-medium truncate">{m.name}</p><span className={`rage-badge ${m.status === 'active' ? 'text-emerald-400 border-emerald-400/30' : 'text-[#71717A]'}`}>{m.status}</span></div>
                  <div className="flex items-center gap-2 text-[10px] text-[#71717A] mt-0.5">
                    <span>{m.participation_mode}</span><span>·</span>
                    <span className="font-mono">Free: {freeRemaining(m)}</span><span>·</span>
                    <span className="font-mono">₹{m.hourly_rate}/hr</span>
                    {m.tags?.length > 0 && <><span>·</span><span>{m.tags.slice(0,3).join(', ')}{m.tags.length > 3 ? '...' : ''}</span></>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(m)} className="text-[10px] text-[#A1A1AA] hover:text-[#F5F5F0] uppercase tracking-wider transition-colors" data-testid={`edit-nm-${m.id}`}>Edit</button>
                {m.status === 'active' && <button onClick={() => deactivate(m.id)} className="text-[10px] text-red-400/60 hover:text-red-400 uppercase tracking-wider transition-colors" data-testid={`deactivate-nm-${m.id}`}>Deactivate</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Helper Components ──

function AdminTable({ headers, children }) {
  return (
    <div className="border border-white/8 bg-[#111111] rage-table">
      <Table>
        <TableHeader>
          <TableRow className="border-white/8 hover:bg-transparent">
            {headers.map(h => <TableHead key={h}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function RoleBadge({ role }) {
  const colors = { admin: 'text-[#DC143C] border-[#DC143C]/30', founder: 'text-blue-400 border-blue-400/30', expert: 'text-emerald-400 border-emerald-400/30', member: 'text-amber-400 border-amber-400/30', sponsor: 'text-purple-400 border-purple-400/30' };
  return <Badge variant="outline" className={`rounded-none text-[10px] ${colors[role] || 'text-[#71717A]'}`}>{role}</Badge>;
}

function UrgencyBadge({ urgency }) {
  const colors = { critical: 'bg-red-500/20 text-red-400', high: 'bg-amber-500/20 text-amber-400', normal: 'bg-blue-500/20 text-blue-400', low: 'bg-[#1A1A1A] text-[#71717A]' };
  return <span className={`rage-badge ${colors[urgency] || colors.normal}`}>{urgency}</span>;
}

function RunMatchButton({ requestId, onDone }) {
  const [running, setRunning] = useState(false);
  const run = async () => {
    setRunning(true);
    try {
      const res = await api.post(`/admin/matching/run/${requestId}`);
      toast.success(`Found ${res.data.matches_found} matches`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Matching failed'); }
    finally { setRunning(false); }
  };
  return (
    <Button size="sm" onClick={run} disabled={running} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-7 text-[10px]" data-testid={`run-match-${requestId}`}>
      {running ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Play className="w-3 h-3 mr-1" />Match</>}
    </Button>
  );
}


const CT_STATUSES = ['new', 'reviewed', 'shortlisted', 'matched', 'session_created', 'converted', 'closed'];
const CT_STATUS_COLORS = { new: 'text-blue-400 border-blue-400/30', reviewed: 'text-amber-400 border-amber-400/30', shortlisted: 'text-purple-400 border-purple-400/30', matched: 'text-emerald-400 border-emerald-400/30', session_created: 'text-emerald-500 border-emerald-500/30', converted: 'text-emerald-500 border-emerald-500/30', closed: 'text-[#71717A] border-white/10' };

function CTRequestCard({ request: r, onRefresh }) {
  const [matches, setMatches] = useState([]);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canMatch = ['new', 'reviewed', 'shortlisted'].includes(r.status);
  const hasMatches = r.status === 'matched' || r.status === 'session_created';

  const loadMatches = async () => {
    try {
      const res = await api.get(`/admin/ct-requests/${r.id}/matches`);
      setMatches(res.data);
      setMatchesOpen(true);
    } catch { /* ignore */ }
  };

  const generateMatches = async () => {
    setGenerating(true);
    try {
      const res = await api.post(`/admin/ct-requests/${r.id}/match`);
      toast.success(`${res.data.matches_found} experts matched`);
      setMatches(res.data.matches);
      setMatchesOpen(true);
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Matching failed'); }
    finally { setGenerating(false); }
  };

  const createSession = async (matchId) => {
    try {
      await api.post(`/admin/ct-requests/${r.id}/create-session?match_id=${matchId}`);
      toast.success('Session created');
      loadMatches();
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="bg-[#111111] border border-white/8" data-testid={`ct-req-${r.id}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-base text-[#F5F5F0] leading-relaxed mb-2">{r.problem_statement}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="rage-badge text-[#DC143C] border-[#DC143C]/30">{r.decision_type?.replace(/_/g, ' ')}</span>
              <span className="rage-badge text-amber-400 border-amber-400/30">{r.urgency?.replace(/_/g, ' ')}</span>
              {r.business_stage && <span className="rage-badge text-[#71717A]">{r.business_stage}</span>}
              {r.preferred_format && <span className="rage-badge text-blue-400 border-blue-400/30">{r.preferred_format?.replace(/_/g, ' ')}</span>}
            </div>
          </div>
          <CTStatusControl requestId={r.id} currentStatus={r.status} onDone={onRefresh} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t border-white/5">
          <div><p className="text-[10px] uppercase tracking-widest text-[#71717A]">Contact</p><p className="text-sm text-[#F5F5F0]">{r.name}</p><p className="text-xs text-[#A1A1AA] font-mono">{r.email}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest text-[#71717A]">Company</p><p className="text-sm text-[#A1A1AA]">{r.company || '—'}</p><p className="text-xs text-[#71717A]">{r.role || ''}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest text-[#71717A]">Help Needed</p><p className="text-xs text-[#A1A1AA]">{r.help_needed?.join(', ').replace(/_/g, ' ') || '—'}</p></div>
          <div><p className="text-[10px] uppercase tracking-widest text-[#71717A]">Submitted</p><p className="text-xs text-[#71717A] font-mono">{new Date(r.created_at).toLocaleString()}</p></div>
        </div>
        {r.notes && <p className="text-xs text-[#71717A] mt-3 italic">"{r.notes}"</p>}

        {/* Action bar */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
          {canMatch && (
            <Button size="sm" onClick={generateMatches} disabled={generating} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-8 text-[11px] px-4" data-testid={`ct-generate-matches-${r.id}`}>
              {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1.5" />}
              Generate Matches
            </Button>
          )}
          {hasMatches && !matchesOpen && (
            <Button size="sm" variant="outline" onClick={loadMatches} className="border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] rounded-none h-8 text-[11px] px-4" data-testid={`ct-view-matches-${r.id}`}>
              View Matches
            </Button>
          )}
          {matchesOpen && (
            <button onClick={() => setMatchesOpen(false)} className="text-[11px] text-[#71717A] hover:text-[#A1A1AA] transition-colors">Hide matches</button>
          )}
        </div>
      </div>

      {/* Inline match results */}
      {matchesOpen && matches.length > 0 && (
        <div className="border-t border-white/5 bg-[#0A0A0A] p-4" data-testid={`ct-matches-panel-${r.id}`}>
          <p className="text-[10px] uppercase tracking-widest text-[#71717A] mb-3">Expert Matches ({matches.length})</p>
          <div className="space-y-2">
            {matches.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 p-3 bg-[#111111] border border-white/5">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 bg-[#DC143C]/10 flex items-center justify-center shrink-0">
                    <span className="text-[#DC143C] text-[10px] font-semibold font-mono">{m.expert_name?.split(' ').map(n => n[0]).join('') || '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-[#F5F5F0] font-medium truncate" style={{ fontFamily: 'Manrope' }}>{m.expert_name}</p>
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {m.matched_tags?.map(t => <span key={t} className="text-[9px] uppercase tracking-wider text-[#DC143C] bg-[#DC143C]/10 px-1.5 py-0.5">{t}</span>)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm text-[#F5F5F0]">{m.score}%</span>
                  <span className={`rage-badge ${CT_STATUS_COLORS[m.status] || 'text-[#71717A]'}`}>{m.status?.replace(/_/g, ' ')}</span>
                  {m.status === 'suggested' && (
                    <Button size="sm" onClick={() => createSession(m.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-none h-7 text-[10px] px-3" data-testid={`ct-create-session-${m.id}`}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Session
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {matchesOpen && matches.length === 0 && (
        <div className="border-t border-white/5 bg-[#0A0A0A] p-4 text-center text-xs text-[#71717A]">No matching experts found. Ensure experts have relevant tags in their profiles.</div>
      )}
    </div>
  );
}

function CTStatusControl({ requestId, currentStatus, onDone }) {
  const [updating, setUpdating] = useState(false);
  const update = async (status) => {
    setUpdating(true);
    try {
      await api.put(`/admin/closed-table-requests/${requestId}/status?status=${status}`);
      toast.success(`Status → ${status}`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setUpdating(false); }
  };
  return (
    <div className="flex flex-col items-end gap-1.5 shrink-0" data-testid={`ct-status-${requestId}`}>
      <span className={`rage-badge ${CT_STATUS_COLORS[currentStatus] || 'text-[#71717A]'}`}>{currentStatus}</span>
      <select
        value={currentStatus}
        onChange={e => update(e.target.value)}
        disabled={updating}
        className="bg-[#0A0A0A] border border-white/10 text-[#A1A1AA] text-[10px] px-2 py-1 rounded-none focus:border-[#DC143C] outline-none cursor-pointer"
        data-testid={`ct-status-select-${requestId}`}
      >
        {CT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

const PAYMENT_STATUSES = ['pending', 'bank_details_shared', 'payment_received', 'confirmed', 'failed', 'refunded'];
const PAY_STATUS_COLORS = { pending: 'text-amber-400', bank_details_shared: 'text-blue-400', payment_received: 'text-emerald-400', confirmed: 'text-emerald-500', failed: 'text-red-400', refunded: 'text-[#71717A]' };

function BookingPaymentControl({ bookingId, onDone }) {
  const [updating, setUpdating] = useState(false);
  const update = async (status) => {
    setUpdating(true);
    try {
      await api.put(`/admin/bookings/${bookingId}/payment-status?status=${status}`);
      toast.success(`Payment → ${status.replace(/_/g, ' ')}`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setUpdating(false); }
  };
  return (
    <select
      onChange={e => update(e.target.value)}
      disabled={updating}
      defaultValue=""
      className="bg-[#0A0A0A] border border-white/10 text-[#A1A1AA] text-[10px] px-2 py-1 rounded-none focus:border-[#DC143C] outline-none cursor-pointer"
      data-testid={`booking-pay-status-${bookingId}`}
    >
      <option value="" disabled>Update payment</option>
      {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
    </select>
  );
}


function CreateSessionButton({ matchId, onDone }) {
  const create = async () => {
    try {
      const scheduledAt = new Date(Date.now() + 3 * 24 * 3600000).toISOString();
      await api.post('/admin/sessions', { match_id: matchId, scheduled_at: scheduledAt, duration_minutes: 60 });
      toast.success('Session created');
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  return (
    <Button size="sm" onClick={create} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-none h-7 text-[10px]" data-testid={`create-session-${matchId}`}>
      <Plus className="w-3 h-3 mr-1" />Session
    </Button>
  );
}

function CompleteSessionButton({ sessionId, onDone }) {
  const complete = async () => {
    try {
      await api.put(`/admin/sessions/${sessionId}/complete`);
      toast.success('Session completed, credits deducted');
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
  };
  return (
    <Button size="sm" onClick={complete} className="bg-blue-600 hover:bg-blue-700 text-white rounded-none h-7 text-[10px]" data-testid={`complete-session-${sessionId}`}>
      <CheckCircle className="w-3 h-3 mr-1" />Complete
    </Button>
  );
}

function CreateEventDialog({ onDone }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', date: '', venue: '', total_seats: 20, price_per_seat: 5000, image_url: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/events', form);
      toast.success('Event created');
      setOpen(false);
      setForm({ title: '', description: '', date: '', venue: '', total_seats: 20, price_per_seat: 5000, image_url: '' });
      onDone();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow text-xs" data-testid="create-event-btn">
          <Plus className="w-4 h-4 mr-1" /> New Event
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#111111] border-white/10 rounded-none max-w-lg" data-testid="create-event-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0]">Create Private Table</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#71717A]">Title</Label>
            <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" required data-testid="event-title-input" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#71717A]">Description</Label>
            <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="event-desc-input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" required data-testid="event-date-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Venue</Label>
              <Input value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="event-venue-input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Total Seats</Label>
              <Input type="number" value={form.total_seats} onChange={e => setForm({...form, total_seats: Number(e.target.value)})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 font-mono" data-testid="event-seats-input" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Price / Seat (INR)</Label>
              <Input type="number" value={form.price_per_seat} onChange={e => setForm({...form, price_per_seat: Number(e.target.value)})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 font-mono" data-testid="event-price-input" />
            </div>
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow" data-testid="submit-event-btn">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Event'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
