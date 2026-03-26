import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Send, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const CATEGORIES = ['technology', 'marketing', 'finance', 'operations', 'strategy', 'product', 'design', 'sales', 'hr', 'legal', 'fundraising', 'growth'];

export default function FounderDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', categories: [], urgency: 'normal', budget_range: '' });

  const fetchData = useCallback(async () => {
    try {
      const [reqRes, matchRes, sessRes] = await Promise.all([
        api.get('/founders/requests'),
        api.get('/founders/matches'),
        api.get('/founders/sessions')
      ]);
      setRequests(reqRes.data);
      setMatches(matchRes.data);
      setSessions(sessRes.data);
    } catch (err) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/founders/requests', form);
      toast.success('Request submitted');
      setDialogOpen(false);
      setForm({ title: '', description: '', categories: [], urgency: 'normal', budget_range: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = (cat) => {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat]
    }));
  };

  const statusIcon = (s) => {
    if (s === 'completed' || s === 'accepted') return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
    if (s === 'declined' || s === 'failed') return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    return <Clock className="w-3.5 h-3.5 text-amber-500" />;
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-[#A1A1AA]"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div data-testid="founder-dashboard">
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="rage-overline mb-2">Founder Dashboard</p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0]">
            Welcome, {user?.name}
          </h1>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow" data-testid="new-request-btn">
              <Plus className="w-4 h-4 mr-2" /> New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#111111] border-white/10 rounded-none max-w-lg" data-testid="new-request-dialog">
            <DialogHeader>
              <DialogTitle className="text-[#F5F5F0] text-xl">Submit Advisory Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 mt-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A]">Title</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" placeholder="What do you need help with?" required data-testid="request-title-input" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A]">Description</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 min-h-[100px]" placeholder="Describe your challenge in detail" required data-testid="request-desc-input" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Categories</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 text-xs uppercase tracking-wider border transition-colors ${form.categories.includes(cat) ? 'bg-[#DC143C]/20 border-[#DC143C] text-[#DC143C]' : 'bg-transparent border-white/15 text-[#A1A1AA] hover:border-white/30'}`}
                      data-testid={`category-${cat}`}
                    >{cat}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A]">Urgency</Label>
                  <Select value={form.urgency} onValueChange={v => setForm({...form, urgency: v})}>
                    <SelectTrigger className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="urgency-select"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#111111] border-white/10 rounded-none">
                      <SelectItem value="low" className="text-[#F5F5F0] rounded-none">Low</SelectItem>
                      <SelectItem value="normal" className="text-[#F5F5F0] rounded-none">Normal</SelectItem>
                      <SelectItem value="high" className="text-[#F5F5F0] rounded-none">High</SelectItem>
                      <SelectItem value="critical" className="text-[#F5F5F0] rounded-none">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A]">Budget Range</Label>
                  <Input value={form.budget_range} onChange={e => setForm({...form, budget_range: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" placeholder="e.g. $500-$2000" data-testid="budget-input" />
                </div>
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow" data-testid="submit-request-btn">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Submit Request</>}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {[
          { label: 'Active Requests', value: requests.filter(r => r.status !== 'completed').length },
          { label: 'Expert Matches', value: matches.length },
          { label: 'Sessions', value: sessions.length },
        ].map(s => (
          <div key={s.label} className="rage-stat">
            <p className="text-xs uppercase tracking-widest text-[#71717A] mb-1">{s.label}</p>
            <p className="text-3xl font-light text-[#F5F5F0] font-mono">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Requests */}
      <div className="mb-10">
        <h3 className="text-2xl font-normal text-[#F5F5F0] mb-4">My Requests</h3>
        {requests.length === 0 ? (
          <div className="border border-white/5 bg-[#0A0A0A] p-8 text-center text-[#71717A]">No requests yet. Submit your first advisory request.</div>
        ) : (
          <div className="space-y-3">
            {requests.map(req => (
              <Card key={req.id} className="bg-[#111111] border-white/8 rounded-none" data-testid={`request-${req.id}`}>
                <CardContent className="p-5 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-base font-medium text-[#F5F5F0]" style={{ fontFamily: 'Manrope' }}>{req.title}</h4>
                      <span className={`rage-badge status-${req.status}`}>{req.status}</span>
                    </div>
                    <p className="text-sm text-[#A1A1AA] line-clamp-2 mb-2">{req.description}</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {req.categories?.map(c => <Badge key={c} variant="outline" className="rounded-none text-[10px] text-[#71717A] border-white/10">{c}</Badge>)}
                    </div>
                  </div>
                  <span className="text-xs text-[#71717A] font-mono shrink-0 ml-4">{new Date(req.created_at).toLocaleDateString()}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Matches */}
      {matches.length > 0 && (
        <div className="mb-10">
          <h3 className="text-2xl font-normal text-[#F5F5F0] mb-4">Expert Matches</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map(m => (
              <Card key={m.id} className="bg-[#111111] border-white/8 rounded-none" data-testid={`match-${m.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-medium text-[#F5F5F0]" style={{ fontFamily: 'Manrope' }}>{m.expert_name}</h4>
                    <div className="flex items-center gap-2">
                      {statusIcon(m.status)}
                      <span className={`rage-badge status-${m.status}`}>{m.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex gap-1 flex-wrap">
                      {m.matched_tags?.map(t => <Badge key={t} variant="outline" className="rounded-none text-[10px] text-[#DC143C] border-[#DC143C]/30">{t}</Badge>)}
                    </div>
                    <span className="font-mono text-sm text-[#F5F5F0]">{m.score}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sessions */}
      {sessions.length > 0 && (
        <div>
          <h3 className="text-2xl font-normal text-[#F5F5F0] mb-4">Sessions</h3>
          <div className="space-y-3">
            {sessions.map(s => (
              <Card key={s.id} className="bg-[#111111] border-white/8 rounded-none">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <h4 className="text-base text-[#F5F5F0]" style={{ fontFamily: 'Manrope' }}>{s.expert_name}</h4>
                    <p className="text-xs text-[#71717A]">{s.duration_minutes} min | {new Date(s.scheduled_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rage-badge status-${s.status}`}>{s.status}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
