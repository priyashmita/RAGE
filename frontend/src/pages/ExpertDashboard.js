import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Check, X, Loader2, User } from 'lucide-react';

const ALL_TAGS = ['technology', 'marketing', 'finance', 'operations', 'strategy', 'product', 'design', 'sales', 'hr', 'legal', 'fundraising', 'growth'];

export default function ExpertDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', bio: '', expertise_areas: [], tags: [], hourly_rate: 0, availability: 'this_week' });

  const fetchData = useCallback(async () => {
    try {
      const [profRes, matchRes] = await Promise.all([
        api.get('/experts/profile'),
        api.get('/experts/matches')
      ]);
      setProfile(profRes.data);
      setForm({
        name: profRes.data.name || user?.name || '',
        bio: profRes.data.bio || '',
        expertise_areas: profRes.data.expertise_areas || [],
        tags: profRes.data.tags || [],
        hourly_rate: profRes.data.hourly_rate || 0,
        availability: profRes.data.availability || 'this_week'
      });
      setMatches(matchRes.data);
    } catch (err) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.put('/experts/profile', form);
      toast.success('Profile updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const respondToMatch = async (matchId, status) => {
    try {
      await api.put(`/experts/matches/${matchId}/respond`, { status });
      toast.success(`Match ${status}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to respond');
    }
  };

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-[#A1A1AA]"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div data-testid="expert-dashboard">
      <div className="mb-10">
        <p className="rage-overline mb-2">Expert Dashboard</p>
        <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0]">
          Your Profile & Matches
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile */}
        <div className="lg:col-span-1">
          <Card className="bg-[#111111] border-white/8 rounded-none" data-testid="expert-profile-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#1A1A1A] border border-white/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#A1A1AA]" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-[#F5F5F0]" style={{ fontFamily: 'Manrope' }}>{profile?.name || user?.name}</h3>
                  <p className="text-xs text-[#71717A]">Expert / Advisor</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A]">Display Name</Label>
                  <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="expert-name-input" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A]">Bio</Label>
                  <Textarea value={form.bio} onChange={e => setForm({...form, bio: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 min-h-[80px]" placeholder="Your background and expertise" data-testid="expert-bio-input" />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Expertise Tags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_TAGS.map(tag => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)}
                        className={`px-2.5 py-1 text-[10px] uppercase tracking-wider border transition-colors ${form.tags.includes(tag) ? 'bg-[#DC143C]/20 border-[#DC143C] text-[#DC143C]' : 'bg-transparent border-white/15 text-[#71717A] hover:border-white/30'}`}
                        data-testid={`tag-${tag}`}
                      >{tag}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#71717A]">Hourly Rate ($)</Label>
                    <Input type="number" value={form.hourly_rate} onChange={e => setForm({...form, hourly_rate: Number(e.target.value)})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 font-mono" data-testid="expert-rate-input" />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#71717A]">Availability</Label>
                    <Select value={form.availability} onValueChange={v => setForm({...form, availability: v})}>
                      <SelectTrigger className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="availability-select"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#111111] border-white/10 rounded-none">
                        <SelectItem value="immediate" className="text-[#F5F5F0] rounded-none">Immediate</SelectItem>
                        <SelectItem value="this_week" className="text-[#F5F5F0] rounded-none">This Week</SelectItem>
                        <SelectItem value="next_week" className="text-[#F5F5F0] rounded-none">Next Week</SelectItem>
                        <SelectItem value="unavailable" className="text-[#F5F5F0] rounded-none">Unavailable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={saveProfile} disabled={saving} className="w-full bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow mt-2" data-testid="save-profile-btn">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save Profile</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Matches */}
        <div className="lg:col-span-2">
          <h3 className="text-2xl font-normal text-[#F5F5F0] mb-4">Incoming Matches</h3>
          {matches.length === 0 ? (
            <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center text-[#71717A]">
              No matches yet. Complete your profile with expertise tags to get matched with founders.
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map(m => (
                <Card key={m.id} className="bg-[#111111] border-white/8 rounded-none" data-testid={`expert-match-${m.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-base font-medium text-[#F5F5F0] mb-1" style={{ fontFamily: 'Manrope' }}>{m.request_title || 'Advisory Request'}</h4>
                        <p className="text-sm text-[#A1A1AA] line-clamp-2">{m.request_description || ''}</p>
                      </div>
                      <div className="text-right ml-4">
                        <span className="font-mono text-lg text-[#F5F5F0]">{m.score}%</span>
                        <p className="text-[10px] text-[#71717A] uppercase">Match Score</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 flex-wrap">
                        {m.matched_tags?.map(t => <Badge key={t} variant="outline" className="rounded-none text-[10px] text-[#DC143C] border-[#DC143C]/30">{t}</Badge>)}
                      </div>
                      {m.status === 'pending' ? (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => respondToMatch(m.id, 'accepted')} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-none h-8 text-xs" data-testid={`accept-match-${m.id}`}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => respondToMatch(m.id, 'declined')} className="border-white/15 text-[#A1A1AA] rounded-none h-8 text-xs hover:bg-white/5" data-testid={`decline-match-${m.id}`}>
                            <X className="w-3.5 h-3.5 mr-1" /> Decline
                          </Button>
                        </div>
                      ) : (
                        <span className={`rage-badge status-${m.status}`}>{m.status}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
