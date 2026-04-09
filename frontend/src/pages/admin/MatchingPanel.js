import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronRight } from 'lucide-react';

const CATEGORY_PAYOUTS = {
  'Finance & Fundraising':   10000,
  'Legal & Compliance':       8000,
  'Marketing & Brand':        6500,
  'Operations & Scale':       6500,
  'Technology & Product':     8000,
  'Strategy & Growth':       10000,
  'People & Culture':         6000,
  'Sales & Distribution':     6500,
  'Media & Communications':   6000,
  'International Expansion': 12000,
};

const DECISION_LABELS = [
  'Fundraising & Capital',
  'Talent & Organisation',
  'Go-to-Market & Growth',
  'Strategy & Pivots',
  'Partnerships & M&A',
  'Financial Structuring',
  'Policy & Regulatory',
  'Product & Technology',
  'General Advisory',
];

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

function overlapCount(ragerCats, enquiryCats) {
  if (!enquiryCats?.length) return 0;
  return (ragerCats || []).filter(c => enquiryCats.includes(c)).length;
}

function defaultPayout(enquiryCats) {
  if (!enquiryCats?.length) return '';
  const payouts = enquiryCats.map(c => CATEGORY_PAYOUTS[c] || 0).filter(Boolean);
  return payouts.length ? String(Math.max(...payouts)) : '';
}

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

  // Brief review state
  const [briefStep, setBriefStep] = useState('select'); // 'select' | 'review'
  const [draftBrief, setDraftBrief] = useState(null);   // doc from DB
  const [editSituation, setEditSituation] = useState('');
  const [editNeed, setEditNeed] = useState('');
  const [editHelpItems, setEditHelpItems] = useState('');
  const [editDecisionLabel, setEditDecisionLabel] = useState('');
  const [savingEdits, setSavingEdits] = useState(false);
  const [editsSaved, setEditsSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (enquiryId) {
        const [enqRes, ragersRes] = await Promise.all([
          api.get(`/admin/enquiries/${enquiryId}`),
          api.get('/admin/ragers'),
        ]);
        setEnquiry(enqRes.data);
        const enquiryCats = enqRes.data?.categories || [];
        const sorted = [...(ragersRes.data || [])].sort(
          (a, b) => overlapCount(b.categories, enquiryCats) - overlapCount(a.categories, enquiryCats)
        );
        setRagers(sorted);
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
      const enquiryCats = enquiry?.categories || [];
      return { ...prev, [id]: { payout: defaultPayout(enquiryCats) } };
    });
  };

  const setField = (id, field, val) => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  // Step 1: generate draft brief, move to review step
  const handleGenerateDraft = async () => {
    const entries = Object.entries(selected);
    if (!entries.length) return toast.error('Select at least one Rager');
    setActing(true);
    try {
      const res = await api.post(`/admin/enquiries/${enquiryId}/draft-brief`);
      const doc = res.data;
      setDraftBrief(doc);
      const bd = doc.brief_data;
      setEditSituation(bd.situation || '');
      setEditNeed(bd.what_they_need || '');
      setEditHelpItems((bd.help_items || []).join(', '));
      setEditDecisionLabel(bd.decision_label || '');
      setEditsSaved(false);
      setBriefStep('review');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate brief');
    } finally {
      setActing(false);
    }
  };

  // Save edits to DB (auto-save feel: called on blur or explicit button)
  const handleSaveEdits = async () => {
    if (!draftBrief) return;
    setSavingEdits(true);
    try {
      const res = await api.put(`/admin/anonymised-briefs/${draftBrief.brief_id}`, {
        situation:      editSituation,
        what_they_need: editNeed,
        help_items:     editHelpItems.split(',').map(s => s.trim()).filter(Boolean),
        decision_label: editDecisionLabel,
      });
      setDraftBrief(res.data);
      setEditsSaved(true);
    } catch (e) {
      toast.error('Failed to save edits');
    } finally {
      setSavingEdits(false);
    }
  };

  // Step 2: send — uses brief_id from saved draft
  const handleSend = async () => {
    if (!draftBrief) return;
    // Auto-save any unsaved edits first
    if (!editsSaved) {
      await handleSaveEdits();
    }
    const entries = Object.entries(selected);
    const payload = {
      brief_id: draftBrief.brief_id,
      ragers: entries.map(([id, vals]) => ({
        rager_id: id,
        cost_to_founder: 0,
        payout_to_rager: parseInt(vals.payout || '0', 10),
      })),
    };
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enquiryId}/match`, payload);
      toast.success('Anon emails sent to selected Ragers');
      setSelected({});
      setBriefStep('select');
      setDraftBrief(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Send failed');
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
                {enq.categories?.length > 0 && (
                  <p className="text-[10px] text-[#52525B] mt-0.5">{enq.categories.join(' · ')}</p>
                )}
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-[#52525B] shrink-0 ml-4" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

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
  const enquiryCats = enquiry.categories || [];
  const selectedCount = Object.keys(selected).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <button type="button" onClick={() => navigate('/admin/matching')} className="text-xs text-[#52525B] hover:text-[#A1A1AA] mb-4 flex items-center gap-1 transition-colors">
          ← All enquiries
        </button>
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Matching</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">{enquiry.name}</h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
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
        {enquiryCats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {enquiryCats.map(cat => (
              <span key={cat} className="text-[10px] px-2 py-0.5 bg-[#DC143C]/10 border border-[#DC143C]/30 text-[#DC143C]">{cat}</span>
            ))}
          </div>
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
                  {alloc.payout_to_rager > 0 && (
                    <p className="text-xs text-[#71717A] mt-0.5">Advisory fee: ₹{alloc.payout_to_rager?.toLocaleString()}</p>
                  )}
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

      {/* ── Rager selection step ── */}
      {canMatch && briefStep === 'select' && (
        <div>
          <div className="flex items-baseline gap-3 mb-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[#52525B]">Select Ragers to approach</p>
            {enquiryCats.length > 0 && (
              <p className="text-[10px] text-[#52525B]">Sorted by category match</p>
            )}
          </div>
          {ragers.length === 0 ? (
            <p className="text-sm text-[#52525B]">No Ragers in the system yet.</p>
          ) : (
            <>
              <div className="space-y-2 mb-6">
                {ragers.map(rager => {
                  const isSelected = !!selected[rager.id];
                  const overlap = overlapCount(rager.categories, enquiryCats);
                  const isMatch = overlap > 0;
                  return (
                    <div key={rager.id} className={`bg-[#111111] border transition-colors ${isSelected ? 'border-[#DC143C]/40' : isMatch ? 'border-[#DC143C]/15' : 'border-white/8'}`}>
                      <button
                        type="button"
                        onClick={() => toggleRager(rager.id)}
                        className="w-full flex items-center gap-4 p-4 text-left"
                      >
                        <div className={`w-4 h-4 border flex-shrink-0 flex items-center justify-center ${isSelected ? 'bg-[#DC143C] border-[#DC143C]' : 'border-white/20'}`}>
                          {isSelected && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[#F5F5F0]">{rager.name}</p>
                            {isMatch && (
                              <span className="text-[10px] text-[#DC143C] bg-[#DC143C]/10 border border-[#DC143C]/20 px-1.5 py-0.5">
                                {overlap} match{overlap > 1 ? 'es' : ''}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#71717A]">{rager.title}{rager.company ? ` · ${rager.company}` : ''}</p>
                          {rager.categories?.length > 0 && (
                            <p className="text-[10px] text-[#52525B] mt-0.5">{rager.categories.join(', ')}</p>
                          )}
                        </div>
                      </button>
                      {isSelected && (
                        <div className="px-4 pb-4">
                          <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">Advisory fee to Rager (₹)</label>
                          <input
                            type="number"
                            value={selected[rager.id].payout}
                            onChange={e => setField(rager.id, 'payout', e.target.value)}
                            placeholder="e.g. 8000"
                            className="w-full max-w-xs bg-[#0A0A0A] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={acting || selectedCount === 0}
                onClick={handleGenerateDraft}
                className="text-xs uppercase tracking-wider px-6 py-3 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Generate Draft Brief for ${selectedCount || 0} Rager(s) →`}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Brief review + edit step ── */}
      {canMatch && briefStep === 'review' && draftBrief && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#52525B]">Review Draft Brief</p>
            <button
              type="button"
              onClick={() => setBriefStep('select')}
              className="text-xs text-[#52525B] hover:text-[#A1A1AA] transition-colors"
            >
              ← Back to rager selection
            </button>
          </div>

          <div className="bg-[#0A0A0A] border border-white/8 p-6 mb-6 space-y-5">

            {/* Read-only metadata */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs border-b border-white/5 pb-4">
              {draftBrief.brief_data?.stage_label && (
                <div>
                  <span className="text-[#52525B] uppercase tracking-wider text-[10px]">Stage</span>
                  <p className="text-[#A1A1AA] mt-0.5">{draftBrief.brief_data.stage_label}</p>
                </div>
              )}
              {draftBrief.brief_data?.urgency_label && (
                <div>
                  <span className="text-[#52525B] uppercase tracking-wider text-[10px]">Urgency</span>
                  <p className="text-[#A1A1AA] mt-0.5">{draftBrief.brief_data.urgency_label}</p>
                </div>
              )}
              {draftBrief.brief_data?.format_label && (
                <div>
                  <span className="text-[#52525B] uppercase tracking-wider text-[10px]">Format</span>
                  <p className="text-[#A1A1AA] mt-0.5">{draftBrief.brief_data.format_label}</p>
                </div>
              )}
              {draftBrief.brief_data?.revenue_band && (
                <div>
                  <span className="text-[#52525B] uppercase tracking-wider text-[10px]">Revenue</span>
                  <p className="text-[#A1A1AA] mt-0.5">{draftBrief.brief_data.revenue_band}</p>
                </div>
              )}
            </div>

            {/* Editable: decision label */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1.5">Category</label>
              <select
                value={editDecisionLabel}
                onChange={e => { setEditDecisionLabel(e.target.value); setEditsSaved(false); }}
                className="w-full max-w-xs bg-[#111111] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
              >
                {DECISION_LABELS.map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            {/* Editable: situation */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1.5">Situation</label>
              <textarea
                rows={4}
                value={editSituation}
                onChange={e => { setEditSituation(e.target.value); setEditsSaved(false); }}
                onBlur={handleSaveEdits}
                className="w-full bg-[#111111] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40 resize-none leading-relaxed"
              />
            </div>

            {/* Editable: what they need */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1.5">What they need</label>
              <textarea
                rows={3}
                value={editNeed}
                onChange={e => { setEditNeed(e.target.value); setEditsSaved(false); }}
                onBlur={handleSaveEdits}
                className="w-full bg-[#111111] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40 resize-none leading-relaxed"
              />
            </div>

            {/* Editable: help items */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1.5">Help items <span className="normal-case text-[#3f3f46]">(comma-separated)</span></label>
              <input
                type="text"
                value={editHelpItems}
                onChange={e => { setEditHelpItems(e.target.value); setEditsSaved(false); }}
                onBlur={handleSaveEdits}
                placeholder="e.g. Capital access & investor conversations, High-stakes decision support"
                className="w-full bg-[#111111] border border-white/10 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40"
              />
              {editHelpItems && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editHelpItems.split(',').map(s => s.trim()).filter(Boolean).map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 bg-[#DC143C]/10 border border-[#DC143C]/20 text-[#DC143C]">{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Save status */}
            <div className="flex items-center gap-2 text-[11px]">
              {savingEdits && <span className="text-[#52525B]">Saving…</span>}
              {!savingEdits && editsSaved && <span className="text-emerald-500">Saved</span>}
              {!savingEdits && !editsSaved && <span className="text-[#52525B]">Edits auto-save on blur</span>}
            </div>
          </div>

          <p className="text-[10px] text-[#3f3f46] mb-4">
            Original AI-generated version is stored. Only the version above will be sent to ragers.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={acting}
              onClick={handleSend}
              className="text-xs uppercase tracking-wider px-6 py-3 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `Send to ${selectedCount} Rager(s)`}
            </button>
            <button
              type="button"
              disabled={savingEdits || acting}
              onClick={handleSaveEdits}
              className="text-xs uppercase tracking-wider px-4 py-3 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 transition-colors disabled:opacity-50"
            >
              Save Edits
            </button>
          </div>
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
