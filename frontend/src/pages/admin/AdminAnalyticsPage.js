import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Loader2, Trash2, Edit2, FileText, RefreshCw, Globe, GlobeLock, Send, Sparkles, ExternalLink } from 'lucide-react';

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-[#0A0A0A] border border-white/8 p-5">
      <p className="text-2xl font-light text-[#F5F5F0] font-mono">{value ?? '—'}</p>
      <p className="text-xs text-[#71717A] mt-1 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-[10px] text-[#52525B] mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ label, value, max, color = '#DC143C' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[#71717A] w-40 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-[#1A1A1A] overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs text-[#A1A1AA] font-mono w-8 text-right">{value}</span>
    </div>
  );
}

function SectionBlock({ title, children }) {
  return (
    <div className="bg-[#0A0A0A] border border-white/8 p-5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-[#52525B] mb-4 font-semibold">{title}</p>
      {children}
    </div>
  );
}

const EMPTY_REPORT = { title: '', period: '', summary: '', themes: [], data_points: [], notes: '', is_public: false };

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_REPORT });
  const [saving, setSaving] = useState(false);
  const [themeInput, setThemeInput] = useState('');
  const [dpInput, setDpInput] = useState('');

  // Email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailReportId, setEmailReportId] = useState(null);
  const [emailList, setEmailList] = useState('');
  const [sending, setSending] = useState(false);

  // AI generation dialog
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchAnalytics = useCallback(() => {
    setLoadingAnalytics(true);
    api.get('/admin/analytics')
      .then(r => setAnalytics(r.data))
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoadingAnalytics(false));
  }, []);

  const fetchReports = useCallback(() => {
    setLoadingReports(true);
    api.get('/admin/reports')
      .then(r => setReports(r.data))
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoadingReports(false));
  }, []);

  useEffect(() => { fetchAnalytics(); fetchReports(); }, [fetchAnalytics, fetchReports]);

  const openNew = () => { setForm({ ...EMPTY_REPORT }); setEditId(null); setThemeInput(''); setDpInput(''); setDialogOpen(true); };
  const openEdit = (r) => { setForm({ ...EMPTY_REPORT, ...r }); setEditId(r.id); setThemeInput(''); setDpInput(''); setDialogOpen(true); };

  const handleSave = async () => {
    if (!form.title.trim() || !form.summary.trim()) { toast.error('Title and summary required'); return; }
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/admin/reports/${editId}`, form);
        toast.success('Report updated');
      } else {
        await api.post('/admin/reports', form);
        toast.success('Report saved');
      }
      setDialogOpen(false);
      fetchReports();
    } catch { toast.error('Failed to save report'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await api.delete(`/admin/reports/${id}`);
      toast.success('Deleted');
      fetchReports();
    } catch { toast.error('Failed'); }
  };

  const handleTogglePublish = async (r) => {
    try {
      const res = await api.patch(`/admin/reports/${r.id}/publish`);
      toast.success(res.data.is_public ? 'Published to /insights' : 'Unpublished');
      fetchReports();
    } catch { toast.error('Failed'); }
  };

  const openEmail = (id) => { setEmailReportId(id); setEmailList(''); setEmailDialogOpen(true); };
  const handleSendEmail = async () => {
    const recipients = emailList.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0) { toast.error('Enter at least one email'); return; }
    setSending(true);
    try {
      const res = await api.post(`/admin/reports/${emailReportId}/email`, { recipients });
      toast.success(`Sent to ${res.data.recipients} recipient${res.data.recipients !== 1 ? 's' : ''}`);
      setEmailDialogOpen(false);
    } catch (err) { toast.error(err.response?.data?.detail || 'Email failed'); }
    finally { setSending(false); }
  };

  const handleGenerate = async () => {
    if (!transcript.trim()) { toast.error('Paste a transcript first'); return; }
    setGenerating(true);
    try {
      const res = await api.post('/admin/reports/generate', { transcript, context: aiContext });
      setForm({ ...EMPTY_REPORT, ...res.data });
      setEditId(null);
      setAiDialogOpen(false);
      setTranscript('');
      setAiContext('');
      setDialogOpen(true);
      toast.success('Report draft generated — review and save');
    } catch (err) { toast.error(err.response?.data?.detail || 'Generation failed — check GEMINI_API_KEY on Railway'); }
    finally { setGenerating(false); }
  };

  const addTag = (field, input, setInput) => {
    const v = input.trim();
    if (v && !form[field].includes(v)) setForm(f => ({ ...f, [field]: [...f[field], v] }));
    setInput('');
  };
  const removeTag = (field, v) => setForm(f => ({ ...f, [field]: f[field].filter(x => x !== v) }));
  const fmt = (n) => n !== undefined && n !== null ? Number(n).toLocaleString('en-IN') : '—';

  const enq = analytics?.enquiries;
  const alloc = analytics?.allocations;
  const users = analytics?.users;
  const ragerStats = analytics?.ragers;
  const maxCat = ragerStats ? Math.max(...Object.values(ragerStats.by_category || {}), 1) : 1;
  const maxProduct = enq ? Math.max(...Object.values(enq.by_product || {}), 1) : 1;

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
          <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Analytics</h1>
          <p className="text-sm text-[#52525B] mt-1">Platform stats + Chatham House reports</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={fetchAnalytics} disabled={loadingAnalytics} className="border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] rounded-none h-9 text-xs uppercase tracking-wider">
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loadingAnalytics ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setAiDialogOpen(true)} className="border-white/15 text-[#A1A1AA] hover:text-[#F5F5F0] rounded-none h-9 text-xs uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 mr-2" /> AI from Transcript
          </Button>
          <Button onClick={openNew} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-9 text-xs uppercase tracking-wider">
            <Plus className="w-3.5 h-3.5 mr-2" /> New Report
          </Button>
        </div>
      </div>

      {/* Platform Stats */}
      {loadingAnalytics ? (
        <div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#52525B]" /></div>
      ) : (
        <div className="space-y-4 mb-10">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#52525B] font-semibold">Platform Overview</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Enquiries" value={enq?.total} />
            <StatCard label="Total Allocations" value={alloc?.total} />
            <StatCard label="Ragers" value={ragerStats?.total} sub={`${ragerStats?.public ?? 0} public`} />
            <StatCard label="Platform Users" value={users?.total} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <SectionBlock title="Enquiries by Format">
              {Object.keys(enq?.by_product || {}).length === 0
                ? <p className="text-xs text-[#52525B] italic">No enquiries yet</p>
                : <div className="space-y-2.5">
                    {Object.entries(enq.by_product).map(([k, v]) => (
                      <Bar key={k} label={k.replace(/_/g, ' ')} value={v} max={maxProduct} />
                    ))}
                  </div>
              }
            </SectionBlock>

            <SectionBlock title="Enquiry Status">
              {Object.keys(enq?.by_status || {}).length === 0
                ? <p className="text-xs text-[#52525B] italic">No data</p>
                : <div className="space-y-3">
                    {Object.entries(enq.by_status).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between">
                        <span className="text-xs text-[#A1A1AA] capitalize">{k}</span>
                        <span className="text-xs font-mono text-[#F5F5F0]">{v}</span>
                      </div>
                    ))}
                  </div>
              }
            </SectionBlock>

            <SectionBlock title="Session Economics">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-xs text-[#71717A]">Total billed</span>
                  <span className="text-xs font-mono text-[#F5F5F0]">₹{fmt(alloc?.total_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-[#71717A]">Total paid out</span>
                  <span className="text-xs font-mono text-[#F5F5F0]">₹{fmt(alloc?.total_payout)}</span>
                </div>
                <div className="flex justify-between border-t border-white/8 pt-3">
                  <span className="text-xs text-[#DC143C] font-semibold">RAGE margin</span>
                  <span className="text-xs font-mono text-[#DC143C] font-semibold">₹{fmt(alloc?.margin)}</span>
                </div>
                {['accept', 'pending', 'decline'].map(k => (
                  <div key={k} className="flex justify-between">
                    <span className="text-xs text-[#71717A] capitalize">{k}ed</span>
                    <span className="text-xs font-mono text-[#A1A1AA]">{alloc?.by_response?.[k] ?? 0}</span>
                  </div>
                ))}
              </div>
            </SectionBlock>
          </div>

          {Object.keys(ragerStats?.by_category || {}).length > 0 && (
            <SectionBlock title="Rager Network — Category Coverage">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.entries(ragerStats.by_category).map(([k, v]) => (
                  <Bar key={k} label={k} value={v} max={maxCat} color="#A1A1AA" />
                ))}
              </div>
            </SectionBlock>
          )}

          <SectionBlock title="Users by Role">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(users?.by_role || {}).map(([role, count]) => (
                <div key={role} className="text-center">
                  <p className="text-xl font-light font-mono text-[#F5F5F0]">{count}</p>
                  <p className="text-[10px] text-[#52525B] uppercase tracking-wider mt-0.5 capitalize">{role}</p>
                </div>
              ))}
            </div>
          </SectionBlock>
        </div>
      )}

      {/* Reports */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#52525B] font-semibold">Chatham House Reports</p>
          <a href="/insights" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors">
            <ExternalLink className="w-3 h-3" /> Public page
          </a>
        </div>
        <p className="text-xs text-[#52525B] mb-5 max-w-2xl leading-relaxed">
          No individual, Rager, or session is identified. Published reports appear at <span className="text-[#A1A1AA]">/insights</span> on the public site.
        </p>

        {loadingReports ? (
          <div className="flex justify-center py-10"><Loader2 className="w-4 h-4 animate-spin text-[#52525B]" /></div>
        ) : reports.length === 0 ? (
          <div className="border border-white/5 bg-[#0A0A0A] p-10 text-center">
            <FileText className="w-8 h-8 text-[#52525B] mx-auto mb-3" />
            <p className="text-sm text-[#52525B] mb-4">No reports yet.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setAiDialogOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] border border-white/10 px-4 py-2 hover:border-white/25 transition-colors">
                <Sparkles className="w-3 h-3" /> Generate from transcript
              </button>
              <button onClick={openNew} className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] border border-white/10 px-4 py-2 hover:border-white/25 transition-colors">
                <Plus className="w-3 h-3" /> Write manually
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map(r => (
              <div key={r.id} className="bg-[#0A0A0A] border border-white/8 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <p className="text-sm font-medium text-[#F5F5F0]">{r.title}</p>
                      {r.period && <span className="text-[10px] text-[#52525B] border border-white/8 px-2 py-0.5">{r.period}</span>}
                      {r.is_public
                        ? <span className="text-[10px] text-emerald-500 border border-emerald-500/20 px-2 py-0.5">Published</span>
                        : <span className="text-[10px] text-[#52525B] border border-white/8 px-2 py-0.5">Draft</span>}
                    </div>
                    <p className="text-xs text-[#71717A] leading-relaxed mb-2 line-clamp-2">{r.summary}</p>
                    {r.themes?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {r.themes.map(t => <span key={t} className="text-[10px] px-2 py-0.5 bg-[#111] border border-white/8 text-[#71717A]">{t}</span>)}
                      </div>
                    )}
                    <p className="text-[10px] text-[#52525B] mt-2">
                      {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.created_by}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleTogglePublish(r)} title={r.is_public ? 'Unpublish' : 'Publish to /insights'} className="p-1.5 transition-colors text-[#52525B] hover:text-emerald-400">
                      {r.is_public ? <Globe className="w-3.5 h-3.5 text-emerald-500" /> : <GlobeLock className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => openEmail(r.id)} title="Email this report" className="p-1.5 text-[#52525B] hover:text-[#A1A1AA] transition-colors">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(r)} className="p-1.5 text-[#52525B] hover:text-[#F5F5F0] transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(r.id, r.title)} className="p-1.5 text-[#52525B] hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Write/Edit Report Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-light">{editId ? 'Edit Report' : 'New Chatham House Report'}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#52525B] -mt-2 mb-4">No individuals, organisations, or sessions are named. Aggregate insights only.</p>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Title *</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Q1 2025 Platform Insights" className="bg-[#050505] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Period</Label>
                <Input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="e.g. Q1 2025" className="bg-[#050505] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Summary *</Label>
              <Textarea value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Aggregate summary. No individual attribution." className="bg-[#050505] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[100px]" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Themes (Enter to add)</Label>
              <div className="flex gap-2 mb-2">
                <Input value={themeInput} onChange={e => setThemeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('themes', themeInput, setThemeInput); } }} placeholder="e.g. Fundraising" className="bg-[#050505] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm flex-1" />
                <Button type="button" onClick={() => addTag('themes', themeInput, setThemeInput)} variant="outline" className="h-8 px-3 rounded-none border-white/15 text-[#A1A1AA]"><Plus className="w-3 h-3" /></Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.themes.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-[#111] border border-white/8 text-[#A1A1AA]">
                    {t} <button onClick={() => removeTag('themes', t)} className="text-[#52525B] hover:text-red-400 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Data Points (Enter to add)</Label>
              <div className="flex gap-2 mb-2">
                <Input value={dpInput} onChange={e => setDpInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('data_points', dpInput, setDpInput); } }} placeholder="e.g. 60% of sessions focused on Series A readiness" className="bg-[#050505] border-white/15 text-[#F5F5F0] h-8 rounded-none text-sm flex-1" />
                <Button type="button" onClick={() => addTag('data_points', dpInput, setDpInput)} variant="outline" className="h-8 px-3 rounded-none border-white/15 text-[#A1A1AA]"><Plus className="w-3 h-3" /></Button>
              </div>
              <div className="space-y-1">
                {form.data_points.map((dp, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#71717A]">
                    <span className="text-[#DC143C]">—</span>
                    <span className="flex-1">{dp}</span>
                    <button onClick={() => removeTag('data_points', dp)} className="text-[#52525B] hover:text-red-400">×</button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Internal Notes (not published)</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Context, methodology, caveats — not shared externally" className="bg-[#050505] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[60px]" />
            </div>
            <div className="flex items-center justify-between p-3 bg-[#050505] border border-white/8">
              <div>
                <p className="text-sm text-[#F5F5F0]">Publish to /insights</p>
                <p className="text-xs text-[#52525B]">Visible on the public website when enabled</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.is_public ? 'bg-emerald-500' : 'bg-[#333]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.is_public ? 'translate-x-5' : ''}`} />
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1 border-white/15 text-[#A1A1AA] rounded-none">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editId ? 'Update Report' : 'Save Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 rounded-none max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-light">Email Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-[#52525B]">Sent via Resend from reports@rageforgood.com. Enter one email per line, or separate with commas.</p>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Recipients</Label>
              <Textarea value={emailList} onChange={e => setEmailList(e.target.value)} placeholder="email@example.com&#10;another@example.com" className="bg-[#050505] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[100px] font-mono" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setEmailDialogOpen(false)} className="flex-1 border-white/15 text-[#A1A1AA] rounded-none">Cancel</Button>
              <Button onClick={handleSendEmail} disabled={sending} className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-2" /> Send</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generation Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 rounded-none max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#F5F5F0] font-light flex items-center gap-2"><Sparkles className="w-4 h-4 text-[#DC143C]" /> Generate Report from Transcript</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-[#111] border border-white/8 text-xs text-[#71717A] leading-relaxed space-y-1">
              <p><span className="text-[#A1A1AA]">For Sunday Table episodes:</span> copy the auto-generated captions from YouTube and paste below.</p>
              <p><span className="text-[#A1A1AA]">For Private Table sessions:</span> paste any notes or a written summary of what was discussed (no names needed).</p>
              <p><span className="text-[#A1A1AA]">For podcast episodes:</span> use the transcript from your podcast host (Spotify, Buzzsprout, etc.) or copy from a transcription tool.</p>
              <p className="text-[#52525B] pt-1">Requires GEMINI_API_KEY set on Railway. AI automatically removes all identifiers per Chatham House rules.</p>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Context (optional)</Label>
              <Input value={aiContext} onChange={e => setAiContext(e.target.value)} placeholder="e.g. Private Table dinner — 8 founders, focus on early-stage fundraising" className="bg-[#050505] border-white/15 text-[#F5F5F0] h-9 rounded-none text-sm" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1.5 block">Transcript *</Label>
              <Textarea value={transcript} onChange={e => setTranscript(e.target.value)} placeholder="Paste the full transcript here…" className="bg-[#050505] border-white/15 text-[#F5F5F0] rounded-none text-sm min-h-[200px] font-mono text-xs" />
              <p className="text-[10px] text-[#52525B] mt-1">{transcript.length.toLocaleString()} characters (max ~12,000 used)</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setAiDialogOpen(false)} className="flex-1 border-white/15 text-[#A1A1AA] rounded-none">Cancel</Button>
              <Button onClick={handleGenerate} disabled={generating || !transcript.trim()} className="flex-1 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating…</> : <><Sparkles className="w-3.5 h-3.5 mr-2" /> Generate Report</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
