import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronRight } from 'lucide-react';

const ENQ_STATUS_COLORS = {
  new:              'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  matching:         'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending_rager:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pending_founder:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
  confirmed:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  declined:         'bg-red-500/10 text-red-400 border-red-500/20',
  closed:           'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const STATUS_COLORS = {
  pending_rager:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  rager_accepted:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rager_declined:  'bg-red-500/10 text-red-400 border-red-500/20',
  pending_founder: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  confirmed:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  founder_declined:'bg-red-500/10 text-red-400 border-red-500/20',
};

export default function MatchingPanel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const enquiryId = searchParams.get('enquiry');

  const [allEnquiries, setAllEnquiries] = useState([]);
  const [enquiry, setEnquiry] = useState(null);
  const [ragers, setRagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [selected, setSelected] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      if (enquiryId) {
        const [enqRes, ragersRes] = await Promise.all([
          api.get(`/admin/enquiries/${enquiryId}`),
          api.get('/admin/ragers'),
        ]);
        setEnquiry(enqRes.data);
        setRagers(ragersRes.data || []);
      } else {
        const res = await api.get('/admin/enquiries');
        setAllEnquiries(res.data || []);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [enquiryId]); // eslint-disable-line

  const toggleRager = (id) => {
    setSelected(prev => {
      if (prev[id]) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: { cost: '', payout: '' } };
    });
  };

  const setField = (id, field, val) => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const handleMatch = async () => {
    const entries = Object.entries(selected);
    if (!entries.length) return toast.error('Select at least one Rager');

    for (const [id, vals] of entries) {
      if (!vals.cost || !vals.payout) return toast.error('Enter cost and payout for all selected Ragers');
    }

    const payload = {
      ragers: entries.map(([id, vals]) => ({
        rager_id: id,
        cost_to_founder: parseInt(vals.cost, 10),
        payout_to_rager: parseInt(vals.payout, 10),
      })),
    };

    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enquiryId}/match`, payload);
      toast.success('Anon emails sent to selected Ragers');
      setSelected({});
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Match failed');
    } finally {
      setActing(false);
    }
  };

  const handleNotifyFounder = async () => {
    setActing(true);
    try {
      const res = await api.post(`/admin/enquiries/${enquiryId}/notify-founder`);
      toast.success(`Founder notified — ${res.data.advisors_shown} advisor(s) shown`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to notify founder');
    } finally {
      setActing(false);
    }
  };

  const handleConfirm = async (allocationId) => {
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enquiryId}/confirm`, { allocation_id: allocationId });
      toast.success('Match confirmed — full details emailed to both parties');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Confirm failed');
    } finally {
      setActing(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm('Decline this enquiry? A "no match found" email will be sent to the founder.')) return;
    setActing(true);
    try {
      await api.patch(`/admin/enquiries/${enquiryId}/decline`);
      toast.success('Enquiry declined');
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Decline failed');
    } finally {
      setActing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
    </div>
  );

  // No enquiry selected — show picker list
  if (!enquiryId) return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Matching</h1>
        <p className="text-sm text-[#52525B] mt-1">Select an enquiry to begin the matching workflow.</p>
      </div>
      {allEnquiries.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
          <p className="text-[#52525B] text-sm">No enquiries yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...allEnquiries].reverse().filter(e => !['confirmed','closed'].includes(e.status)).concat(
            [...allEnquiries].reverse().filter(e => ['confirmed','closed'].includes(e.status))
          ).map(enq => (
            <button
              key={enq.id}
              type="button"
              onClick={() => navigate(`/admin/matching?enquiry=${enq.id}`)}
              className="w-full bg-[#111111] border border-white/8 p-4 text-left flex items-center justify-between hover:border-white/20 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <span className="text-sm font-medium text-[#F5F5F0]">{enq.name}</span>
                  {enq.company && <span className="text-xs text-[#71717A]">{enq.company}</span>}
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm ${ENQ_STATUS_COLORS[enq.status] || ENQ_STATUS_COLORS.new}`}>
                    {(enq.status || 'new').replace(/_/g, ' ')}
                  </span>
                  {(enq.format || enq.interest) && (
                    <span className="text-[10px] text-[#52525B] uppercase tracking-wider">
                      {(enq.format || enq.interest).replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#71717A] truncate">{enq.challenge || enq.message || enq.problem_statement || '—'}</p>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#52525B] shrink-0 ml-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Enquiry selected but failed to load
  if (!enquiry) return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Matching</h1>
      </div>
      <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
        <p className="text-[#52525B] text-sm">Enquiry not found.</p>
        <button type="button" onClick={() => navigate('/admin/matching')} className="mt-4 text-xs text-[#DC143C] hover:underline">← Back to all enquiries</button>
      </div>
    </div>
  );

  const allocations = enquiry.allocations || [];
  const status = enquiry.status;
  const canMatch = ['new', 'matching'].includes(status);
  const canNotifyFounder = status === 'pending_rager' && allocations.some(a => a.status === 'rager_accepted');
  const canConfirm = status === 'pending_founder' && allocations.some(a => a.status === 'pending_founder');
  const isDone = ['confirmed', 'declined', 'closed'].includes(status);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button type="button" onClick={() => navigate('/admin/matching')} className="text-xs text-[#52525B] hover:text-[#A1A1AA] mb-4 flex items-center gap-1 transition-colors">
          ← All enquiries
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Matching</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">{enquiry.name}</h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs text-[#71717A]">{enquiry.email}</span>
          {enquiry.company && <span className="text-xs text-[#71717A]">· {enquiry.company}</span>}
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm bg-blue-500/10 text-blue-400 border-blue-500/20">
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        {(enquiry.challenge || enquiry.problem_statement || enquiry.message) && (
          <p className="text-sm text-[#A1A1AA] mt-3 leading-relaxed max-w-2xl">
            {enquiry.challenge || enquiry.problem_statement || enquiry.message}
          </p>
        )}
      </div>

      {/* Existing allocations */}
      {allocations.length > 0 && (
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-3">Allocations</p>
          <div className="space-y-2">
            {allocations.map(alloc => (
              <div key={alloc.id} className="bg-[#111111] border border-white/8 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#F5F5F0]">{alloc.rager_name}</p>
                  <p className="text-xs text-[#71717A] mt-0.5">
                    Cost to founder: ₹{alloc.cost_to_founder?.toLocaleString()} · Payout: ₹{alloc.payout_to_rager?.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm ${STATUS_COLORS[alloc.status] || 'text-[#71717A]'}`}>
                    {alloc.status.replace(/_/g, ' ')}
                  </span>
                  {canConfirm && alloc.status === 'pending_founder' && (
                    <button
                      type="button"
                      disabled={acting}
                      onClick={() => handleConfirm(alloc.id)}
                      className="text-xs uppercase tracking-wider px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 mb-8 flex-wrap">
        {canNotifyFounder && (
          <button
            type="button"
            disabled={acting}
            onClick={handleNotifyFounder}
            className="text-xs uppercase tracking-wider px-5 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors disabled:opacity-50"
          >
            {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Notify Founder'}
          </button>
        )}
        {!isDone && (
          <button
            type="button"
            disabled={acting}
            onClick={handleDecline}
            className="text-xs uppercase tracking-wider px-5 py-2.5 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 transition-colors disabled:opacity-50"
          >
            Decline Enquiry
          </button>
        )}
      </div>

      {/* Rager selection for matching */}
      {canMatch && (
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-3">Select Ragers to approach</p>
          {ragers.length === 0 ? (
            <p className="text-sm text-[#52525B]">No Ragers in the system yet.</p>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                {ragers.map(rager => {
                  const isSelected = !!selected[rager.id];
                  return (
                    <div key={rager.id} className={`bg-[#111111] border transition-colors ${isSelected ? 'border-[#DC143C]/40' : 'border-white/8'}`}>
                      <button
                        type="button"
                        onClick={() => toggleRager(rager.id)}
                        className="w-full flex items-center gap-4 p-4 text-left"
                      >
                        <div className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/20'}`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#F5F5F0]">{rager.name}</p>
                          <p className="text-xs text-[#71717A]">{rager.title}{rager.company ? ` · ${rager.company}` : ''}</p>
                          {rager.categories?.length > 0 && (
                            <p className="text-[10px] text-[#52525B] mt-0.5">{rager.categories.join(', ')}</p>
                          )}
                        </div>
                      </button>
                      {isSelected && (
                        <div className="px-4 pb-4 flex gap-4">
                          <div className="flex-1">
                            <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">Cost to Founder (₹)</label>
                            <input
                              type="number"
                              value={selected[rager.id].cost}
                              onChange={e => setField(rager.id, 'cost', e.target.value)}
                              placeholder="e.g. 7000"
                              className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">Payout to Rager (₹)</label>
                            <input
                              type="number"
                              value={selected[rager.id].payout}
                              onChange={e => setField(rager.id, 'payout', e.target.value)}
                              placeholder="e.g. 5000"
                              className="w-full bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={acting || Object.keys(selected).length === 0}
                onClick={handleMatch}
                className="text-xs uppercase tracking-wider px-6 py-3 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Send Anon Email to ${Object.keys(selected).length || 0} Rager(s)`}
              </button>
            </>
          )}
        </div>
      )}

      {isDone && (
        <div className="border border-white/5 bg-[#0A0A0A] p-8 text-center">
          <p className="text-[#52525B] text-sm">This enquiry is {status}.</p>
        </div>
      )}
    </div>
  );
}
