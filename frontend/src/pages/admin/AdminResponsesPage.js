import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Calendar, Mail } from 'lucide-react';

const ENQ_STATUS_COLORS = {
  new:                           'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  matching:                      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending_rager:                 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pending_founder:               'bg-orange-500/10 text-orange-400 border-orange-500/20',
  // pre-offer reconfirmation
  reconfirmation_pending:        'bg-sky-500/10 text-sky-400 border-sky-500/20',
  founder_offer_ready:           'bg-teal-500/10 text-teal-400 border-teal-500/20',
  // shortlist sent to founder
  founder_offer_sent:            'bg-amber-500/10 text-amber-400 border-amber-500/20',
  // founder responded via selection page (new flow)
  founder_selection_received:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
  // legacy / backward-compat
  founder_selected:              'bg-teal-500/10 text-teal-400 border-teal-500/20',
  // founder wants more options
  needs_more_candidates:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  // waiting for rager final confirmation after founder selects
  awaiting_final_confirmation:   'bg-sky-500/10 text-sky-400 border-sky-500/20',
  // all done
  confirmed_ready_to_schedule:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  // backward-compat / legacy
  pending_founder_offer:         'bg-amber-500/10 text-amber-400 border-amber-500/20',
  confirmed:                     'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  founder_accepted:              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  founder_rejected:              'bg-red-500/10 text-red-400 border-red-500/20',
  declined:                      'bg-red-500/10 text-red-400 border-red-500/20',
  closed:                        'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const ALLOC_STATUS_LABELS = {
  pending_rager:               { label: 'Awaiting response',      color: 'text-[#71717A]' },
  rager_accepted:              { label: 'Interested',             color: 'text-emerald-400' },
  rager_declined:              { label: 'Declined outreach',      color: 'text-red-400' },
  // pre-offer reconfirmation
  reconfirmation_pending:      { label: 'Reconfirmation sent',    color: 'text-sky-400' },
  reconfirmed_for_offer:       { label: 'Reconfirmed ✓',          color: 'text-emerald-400' },
  reconfirmation_declined:     { label: 'Unavailable',            color: 'text-red-400' },
  // shortlist sent to founder
  offer_sent_to_founder:       { label: 'In shortlist',           color: 'text-amber-400' },
  // founder selection outcomes
  selected_by_founder:         { label: 'Selected by founder',    color: 'text-teal-400' },
  not_selected_by_founder:     { label: 'Not chosen',             color: 'text-[#52525B]' },
  // final disclosure step
  final_disclosure_sent:       { label: 'Disclosure sent',        color: 'text-sky-400' },
  rager_final_confirmed:       { label: 'Final confirmed ✓',      color: 'text-emerald-400' },
  rager_final_declined:        { label: 'Final declined',         color: 'text-red-400' },
  // old-flow / legacy
  founder_accepted:            { label: 'Session confirmed',      color: 'text-emerald-400' },
  founder_declined:            { label: 'Not chosen',             color: 'text-[#52525B]' },
  pending_founder:             { label: 'Pending',                color: 'text-orange-400' },
  confirmed:                   { label: 'Confirmed',              color: 'text-emerald-400' },
};

const SHORTLIST_COLORS = {
  shortlisted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected:    'bg-red-500/10 text-red-400 border-red-500/20',
};

const EMPTY_OFFER = {
  budget_text: '', format_type: '', venue: '',
  duration_text: '', optional_dates: '', cost_notes: '', intro_message: '',
};

function OfferField({ label, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">{label}</label>
      {children}
    </div>
  );
}

function EnquiryRow({ enq }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [acting, setActing] = useState(false);

  // Schedule state
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(enq.scheduled_at || '');
  const [sessionNotes, setSessionNotes] = useState(enq.session_notes || '');

  // Founder offer state
  const [offerMode, setOfferMode] = useState(false);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [savedOffer, setSavedOffer] = useState(null);    // doc from DB (null = not loaded yet)
  const [offerLoaded, setOfferLoaded] = useState(false); // whether we've tried to fetch
  const [offerSaving, setOfferSaving] = useState(false);

  // Auto-suggest state
  const [autoSuggest, setAutoSuggest] = useState([]);
  const [showAutoSuggest, setShowAutoSuggest] = useState(false);
  const [loadingAutoSuggest, setLoadingAutoSuggest] = useState(false);

  // Manual add rager form
  const EMPTY_ADD_RAGER = { name: '', email: '', title: '', company: '', bio: '', cost_to_founder: '', payout_to_rager: '' };
  const [showAddRager, setShowAddRager] = useState(false);
  const [addRagerForm, setAddRagerForm] = useState(EMPTY_ADD_RAGER);

  // Auto-fetch whenever the row is open and detail is null (covers first open + after any action)
  useEffect(() => {
    if (!open || detail !== null) return;
    setLoadingDetail(true);
    api.get(`/admin/enquiries/${enq.id}/responses`)
      .then(res => {
        setDetail(res.data);
        setScheduledAt(res.data.enquiry?.scheduled_at || '');
        setSessionNotes(res.data.enquiry?.session_notes || '');
      })
      .catch(() => toast.error('Failed to load responses'))
      .finally(() => setLoadingDetail(false));
  }, [open, detail, enq.id]); // eslint-disable-line

  const toggle = () => setOpen(v => !v);

  const loadOffer = useCallback(async () => {
    if (offerLoaded) return;
    setOfferLoaded(true);
    try {
      const res = await api.get(`/admin/enquiries/${enq.id}/founder-offer`);
      setSavedOffer(res.data);
      const d = res.data;
      setOfferForm({
        budget_text:    d.budget_text    || '',
        format_type:    d.format_type    || '',
        venue:          d.venue          || '',
        duration_text:  d.duration_text  || '',
        optional_dates: d.optional_dates || '',
        cost_notes:     d.cost_notes     || '',
        intro_message:  d.intro_message  || '',
      });
    } catch {
      // 404 = no offer yet — that's fine
      setSavedOffer(null);
    }
  }, [enq.id, offerLoaded]);

  const openOfferMode = () => {
    setOfferMode(true);
    loadOffer();
  };

  const shortlist = async (allocId, status) => {
    setActing(true);
    try {
      await api.patch(`/admin/allocations/${allocId}/shortlist`, { shortlist_status: status });
      toast.success(status ? `Marked as ${status}` : 'Reset');
      setDetail(null); // triggers useEffect to re-fetch
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally {
      setActing(false);
    }
  };

  const saveOffer = async () => {
    setOfferSaving(true);
    try {
      const res = await api.post(`/admin/enquiries/${enq.id}/founder-offer`, offerForm);
      setSavedOffer(res.data);
      toast.success('Draft saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save draft');
    } finally {
      setOfferSaving(false);
    }
  };

  // Send shortlist to founder with per-rager selection tokens
  const sendOffer = async () => {
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enq.id}/founder-offer`, offerForm);
      await api.post(`/admin/enquiries/${enq.id}/send-shortlist-to-founder`);
      toast.success('Shortlist sent to founder');
      setOfferMode(false);
      setSavedOffer(null);
      setOfferLoaded(false);
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send shortlist');
    } finally {
      setActing(false);
    }
  };

  const sendFinalDisclosure = async () => {
    setActing(true);
    try {
      const res = await api.post(`/admin/enquiries/${enq.id}/send-final-disclosure`);
      toast.success(`Final disclosure sent to ${res.data.emails_sent} rager(s)`);
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send final disclosure');
    } finally {
      setActing(false);
    }
  };

  const resendFinalDisclosure = async (allocId) => {
    setActing(true);
    try {
      await api.post(`/admin/allocations/${allocId}/resend-final-disclosure`);
      toast.success('Final disclosure resent');
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to resend');
    } finally {
      setActing(false);
    }
  };

  const loadAutoSuggest = async () => {
    if (loadingAutoSuggest) return;
    setLoadingAutoSuggest(true);
    try {
      const res = await api.get(`/admin/enquiries/${enq.id}/auto-suggest`);
      setAutoSuggest(res.data || []);
      setShowAutoSuggest(true);
    } catch {
      toast.error('Failed to load suggestions');
    } finally {
      setLoadingAutoSuggest(false);
    }
  };

  const addManualRager = async () => {
    if (!addRagerForm.name || !addRagerForm.email) {
      toast.error('Name and email are required');
      return;
    }
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enq.id}/add-manual-rager`, {
        ...addRagerForm,
        cost_to_founder: parseInt(addRagerForm.cost_to_founder) || 0,
        payout_to_rager: parseInt(addRagerForm.payout_to_rager) || 0,
      });
      toast.success(`${addRagerForm.name} added`);
      setShowAddRager(false);
      setAddRagerForm(EMPTY_ADD_RAGER);
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add rager');
    } finally {
      setActing(false);
    }
  };

  const saveSchedule = async () => {
    setActing(true);
    try {
      await api.patch(`/admin/enquiries/${enq.id}/session`, {
        scheduled_at: scheduledAt || null,
        session_notes: sessionNotes,
      });
      toast.success('Session updated');
      setScheduleMode(false);
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update session');
    } finally {
      setActing(false);
    }
  };

  const setOffer = (field, val) => setOfferForm(prev => ({ ...prev, [field]: val }));

  const sendReconfirmation = async () => {
    setActing(true);
    try {
      const res = await api.post(`/admin/enquiries/${enq.id}/send-rager-reconfirmation`);
      toast.success(`Reconfirmation sent to ${res.data.emails_sent} rager(s)`);
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send reconfirmation');
    } finally {
      setActing(false);
    }
  };

  const resendReconfirmation = async (allocId) => {
    setActing(true);
    try {
      await api.post(`/admin/allocations/${allocId}/resend-reconfirmation`);
      toast.success('Reconfirmation reminder sent');
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to resend');
    } finally {
      setActing(false);
    }
  };

  const resendOffer = async () => {
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enq.id}/resend-founder-offer`);
      toast.success('Offer reminder sent to founder');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to resend offer');
    } finally {
      setActing(false);
    }
  };

  const allocations = detail?.allocations || [];

  // Derived counts
  const shortlistedAccepted    = allocations.filter(a => a.shortlist_status === 'shortlisted' && a.status === 'rager_accepted').length;
  const reconfirmPending       = allocations.filter(a => a.status === 'reconfirmation_pending').length;
  const reconfirmedCount       = allocations.filter(a => a.status === 'reconfirmed_for_offer').length;
  const shortlistedTotal       = allocations.filter(a => a.shortlist_status === 'shortlisted').length;
  const selectedByFounder      = allocations.filter(a => a.status === 'selected_by_founder').length;
  const finalDisclosureSent    = allocations.filter(a => a.status === 'final_disclosure_sent').length;
  const finalConfirmed         = allocations.filter(a => a.status === 'rager_final_confirmed').length;

  // Count eligible allocs for the offer form caption
  const offerableCount = allocations.filter(a =>
    a.status === 'reconfirmed_for_offer' ||
    a.status === 'pending_founder' ||
    (a.shortlist_status === 'shortlisted' && a.status === 'rager_accepted')
  ).length;

  const TERMINAL_ENQ = [
    'founder_rejected', 'confirmed', 'confirmed_ready_to_schedule', 'declined', 'closed',
  ];

  const canPrepareOffer       = shortlistedTotal > 0 && !TERMINAL_ENQ.includes(enq.status);
  const canSendReconfirmation = (shortlistedAccepted > 0 || reconfirmPending > 0) && !TERMINAL_ENQ.includes(enq.status);
  const hasOldFlowAllocs      = allocations.some(a => a.status === 'pending_founder');
  // "Send Shortlist to Founder" — requires ≥1 reconfirmed (or old-flow compat) AND draft not yet sent
  const canSendToFounder      = (reconfirmedCount > 0 || hasOldFlowAllocs) && savedOffer?.status === 'draft';
  // "Resend Shortlist" — shortlist was sent but founder hasn't responded yet
  const canResendOffer        = enq.status === 'founder_offer_sent' && savedOffer?.status === 'sent' && !savedOffer?.founder_response_type;
  // "Send Final Disclosure" — founder has selected rager(s) via new or legacy flow
  const canSendFinalDisclosure = ['founder_selection_received', 'founder_selected'].includes(enq.status) && selectedByFounder > 0;
  const canSchedule           = ['confirmed', 'founder_accepted', 'confirmed_ready_to_schedule'].includes(enq.status);

  const inputCls = "w-full bg-[#111] border border-white/10 text-[#F5F5F0] text-xs px-3 py-2 outline-none focus:border-white/20 placeholder:text-[#52525B]";
  const textareaCls = `${inputCls} resize-none leading-relaxed`;

  return (
    <div className="bg-[#111111] border border-white/8">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="text-sm font-medium text-[#F5F5F0]">{enq.name}</span>
            {enq.company && <span className="text-xs text-[#71717A]">{enq.company}</span>}
            <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm ${ENQ_STATUS_COLORS[enq.status] || ENQ_STATUS_COLORS.new}`}>
              {(enq.status || 'new').replace(/_/g, ' ')}
            </span>
            {enq.format && (
              <span className="text-[10px] text-[#52525B] uppercase tracking-wider">{enq.format.replace(/_/g, ' ')}</span>
            )}
          </div>
          <p className="text-xs text-[#71717A] truncate">{enq.email}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[10px] text-[#52525B] font-mono">{enq.created_at?.slice(0, 10)}</span>
          {open ? <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#52525B]" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-white/5 px-4 pb-4 pt-4">
          {loadingDetail ? (
            <div className="flex items-center gap-2 py-4 text-[#52525B] text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading responses...
            </div>
          ) : (
            <>
              {/* Allocations table */}
              {allocations.length === 0 ? (
                <p className="text-xs text-[#52525B] py-4">No ragers contacted yet for this enquiry.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Rager', 'Email', 'Response', 'Responded', 'Shortlist', 'Actions'].map(h => (
                          <th key={h} className="text-left text-[10px] uppercase tracking-wider text-[#52525B] pb-2 pr-4 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {allocations.map(alloc => {
                        const s = ALLOC_STATUS_LABELS[alloc.status] || { label: alloc.status, color: 'text-[#A1A1AA]' };
                        const canShortlist = alloc.status === 'rager_accepted';
                        return (
                          <tr key={alloc.id} className="hover:bg-white/[0.01]">
                            <td className="py-2.5 pr-4">
                              <p className="text-[#F5F5F0] font-medium">{alloc.rager_name}</p>
                              {alloc.rager_title && (
                                <p className="text-[#52525B] text-[10px]">{alloc.rager_title}{alloc.rager_company ? ` · ${alloc.rager_company}` : ''}</p>
                              )}
                            </td>
                            <td className="py-2.5 pr-4 text-[#71717A]">{alloc.rager_email || '—'}</td>
                            <td className="py-2.5 pr-4">
                              <span className={s.color}>{s.label}</span>
                            </td>
                            <td className="py-2.5 pr-4 text-[#52525B] font-mono">
                              {alloc.rager_responded_at ? alloc.rager_responded_at.slice(0, 10) : '—'}
                            </td>
                            <td className="py-2.5 pr-4">
                              {alloc.shortlist_status ? (
                                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm ${SHORTLIST_COLORS[alloc.shortlist_status] || ''}`}>
                                  {alloc.shortlist_status}
                                </span>
                              ) : (
                                <span className="text-[#52525B]">—</span>
                              )}
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Shortlist toggle — only while rager is in initial accepted state */}
                                {canShortlist && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={acting}
                                      onClick={() => shortlist(alloc.id, alloc.shortlist_status === 'shortlisted' ? null : 'shortlisted')}
                                      className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                                        alloc.shortlist_status === 'shortlisted'
                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          : 'bg-white/5 text-[#A1A1AA] border border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400'
                                      }`}
                                    >
                                      <CheckCircle className="w-3 h-3" />
                                      {alloc.shortlist_status === 'shortlisted' ? 'Listed' : 'Shortlist'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={acting}
                                      onClick={() => shortlist(alloc.id, alloc.shortlist_status === 'rejected' ? null : 'rejected')}
                                      className={`flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors disabled:opacity-50 ${
                                        alloc.shortlist_status === 'rejected'
                                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                          : 'bg-white/5 text-[#A1A1AA] border border-white/10 hover:bg-red-500/10 hover:text-red-400'
                                      }`}
                                    >
                                      <XCircle className="w-3 h-3" />
                                      {alloc.shortlist_status === 'rejected' ? 'Rejected' : 'Reject'}
                                    </button>
                                  </>
                                )}
                                {/* Resend reconfirmation */}
                                {alloc.status === 'reconfirmation_pending' && (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => resendReconfirmation(alloc.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider bg-white/5 text-[#A1A1AA] border border-white/10 hover:bg-sky-500/10 hover:text-sky-400 transition-colors disabled:opacity-50"
                                  >
                                    <Mail className="w-3 h-3" /> Resend
                                  </button>
                                )}
                                {/* Reconfirmed badge */}
                                {alloc.status === 'reconfirmed_for_offer' && (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Ready
                                  </span>
                                )}
                                {/* Resend final disclosure */}
                                {alloc.status === 'final_disclosure_sent' && (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => resendFinalDisclosure(alloc.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider bg-white/5 text-[#A1A1AA] border border-white/10 hover:bg-sky-500/10 hover:text-sky-400 transition-colors disabled:opacity-50"
                                  >
                                    <Mail className="w-3 h-3" /> Resend Disclosure
                                  </button>
                                )}
                                {/* Resend if declined */}
                                {alloc.status === 'rager_final_declined' && (
                                  <button
                                    type="button"
                                    disabled={acting}
                                    onClick={() => resendFinalDisclosure(alloc.id)}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] uppercase tracking-wider bg-white/5 text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                  >
                                    <Mail className="w-3 h-3" /> Re-disclose
                                  </button>
                                )}
                                {/* Final confirmed badge */}
                                {(alloc.status === 'rager_final_confirmed' || alloc.status === 'founder_accepted') && (
                                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Confirmed
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actions row */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-3 flex-wrap">
                {/* Open / close offer form */}
                {canPrepareOffer && (
                  <button
                    type="button"
                    onClick={() => { setScheduleMode(false); setShowAutoSuggest(false); setShowAddRager(false); setOfferMode(v => { if (!v) openOfferMode(); return !v; }); }}
                    className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border ${
                      offerMode
                        ? 'bg-[#DC143C]/10 text-[#DC143C] border-[#DC143C]/30'
                        : 'bg-white/5 hover:bg-white/10 text-[#A1A1AA] border-white/10'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {offerMode ? 'Close' : 'Prepare / Send Shortlist'}
                  </button>
                )}

                {/* Send final disclosure — after founder selects rager(s) */}
                {canSendFinalDisclosure && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={sendFinalDisclosure}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    Send Final Disclosure ({selectedByFounder})
                  </button>
                )}

                {/* Resend shortlist email */}
                {canResendOffer && !offerMode && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={resendOffer}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#71717A] text-xs uppercase tracking-wider transition-colors border border-white/10 disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" /> Resend Shortlist
                  </button>
                )}

                {/* Auto-suggest advisors */}
                {!TERMINAL_ENQ.includes(enq.status) && (
                  <button
                    type="button"
                    disabled={loadingAutoSuggest}
                    onClick={() => { setOfferMode(false); setShowAddRager(false); if (showAutoSuggest) { setShowAutoSuggest(false); } else { loadAutoSuggest(); } }}
                    className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border disabled:opacity-50 ${
                      showAutoSuggest
                        ? 'bg-white/10 text-[#F5F5F0] border-white/20'
                        : 'bg-white/5 hover:bg-white/10 text-[#71717A] border-white/10'
                    }`}
                  >
                    {loadingAutoSuggest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    {showAutoSuggest ? 'Hide Suggestions' : 'Auto-suggest'}
                  </button>
                )}

                {/* Add external rager */}
                {!TERMINAL_ENQ.includes(enq.status) && (
                  <button
                    type="button"
                    onClick={() => { setOfferMode(false); setShowAutoSuggest(false); setShowAddRager(v => !v); }}
                    className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border ${
                      showAddRager
                        ? 'bg-white/10 text-[#F5F5F0] border-white/20'
                        : 'bg-white/5 hover:bg-white/10 text-[#71717A] border-white/10'
                    }`}
                  >
                    + Add Rager
                  </button>
                )}

                {/* Schedule session */}
                {canSchedule && (
                  <button
                    type="button"
                    onClick={() => { setOfferMode(false); setShowAutoSuggest(false); setShowAddRager(false); setScheduleMode(v => !v); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#A1A1AA] text-xs uppercase tracking-wider transition-colors border border-white/10"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {scheduleMode ? 'Cancel' : 'Schedule Session'}
                  </button>
                )}

                {/* Status messages */}
                {enq.status === 'reconfirmation_pending' && (
                  <p className="text-xs text-sky-400"><Clock className="w-3 h-3 inline mr-1" />Reconfirmation sent — waiting for rager responses</p>
                )}
                {enq.status === 'founder_offer_ready' && (
                  <p className="text-xs text-teal-400"><CheckCircle className="w-3 h-3 inline mr-1" />Rager(s) reconfirmed — ready to send shortlist to founder</p>
                )}
                {enq.status === 'founder_offer_sent' && !canSendFinalDisclosure && (
                  <p className="text-xs text-amber-400"><Clock className="w-3 h-3 inline mr-1" />Shortlist sent — awaiting founder selection</p>
                )}
                {enq.status === 'founder_selection_received' && (
                  <p className="text-xs text-teal-400"><CheckCircle className="w-3 h-3 inline mr-1" />Founder selected {selectedByFounder} advisor(s) — send final disclosure to proceed</p>
                )}
                {enq.status === 'founder_selected' && (
                  <p className="text-xs text-teal-400"><CheckCircle className="w-3 h-3 inline mr-1" />Founder selected {selectedByFounder} advisor(s) — send final disclosure to proceed</p>
                )}
                {enq.status === 'needs_more_candidates' && (
                  <p className="text-xs text-orange-400"><XCircle className="w-3 h-3 inline mr-1" />Founder requested more options — source additional advisors and resend</p>
                )}
                {enq.status === 'awaiting_final_confirmation' && (
                  <p className="text-xs text-sky-400"><Clock className="w-3 h-3 inline mr-1" />Awaiting rager final confirmation ({finalDisclosureSent} pending, {finalConfirmed} confirmed)</p>
                )}
                {enq.status === 'founder_rejected' && (
                  <p className="text-xs text-red-400"><XCircle className="w-3 h-3 inline mr-1" />Founder declined proposal</p>
                )}
                {(enq.status === 'confirmed_ready_to_schedule' || enq.status === 'confirmed') && (
                  <p className="text-xs text-emerald-400"><CheckCircle className="w-3 h-3 inline mr-1" />Session confirmed — ready to schedule</p>
                )}
              </div>

              {/* ── Auto-suggest panel ── */}
              {showAutoSuggest && (
                <div className="mt-4 p-4 bg-[#0A0A0A] border border-white/5">
                  <p className="text-[10px] uppercase tracking-wider text-[#52525B] font-medium mb-3">
                    Suggested Advisors
                    <span className="ml-2 text-[#3f3f46] normal-case tracking-normal">Based on enquiry context. Click to add to matching outreach.</span>
                  </p>
                  {autoSuggest.length === 0 ? (
                    <p className="text-xs text-[#52525B]">No suggestions — all matching ragers may already be allocated.</p>
                  ) : (
                    <div className="space-y-2">
                      {autoSuggest.map(r => (
                        <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0">
                          <div className="min-w-0">
                            <p className="text-xs text-[#F5F5F0]">{r.name}</p>
                            <p className="text-[10px] text-[#52525B]">{r.title}{r.company ? ` · ${r.company}` : ''}</p>
                            {r.categories?.length > 0 && (
                              <p className="text-[10px] text-[#3f3f46] mt-0.5">{r.categories.slice(0, 3).join(', ')}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={acting}
                            onClick={async () => {
                              setActing(true);
                              try {
                                // Quick-add: pass name+email so add-manual-rager re-uses the existing rager record
                                await api.post(`/admin/enquiries/${enq.id}/add-manual-rager`, {
                                  name: r.name, email: r.email || '', title: r.title || '', company: r.company || '',
                                  bio: r.bio || '', categories: r.categories || [],
                                  cost_to_founder: 0, payout_to_rager: 0,
                                });
                                toast.success(`${r.name} added`);
                                setAutoSuggest(prev => prev.filter(x => x.id !== r.id));
                                setDetail(null);
                              } catch (e) {
                                toast.error(e.response?.data?.detail || 'Failed to add');
                              } finally {
                                setActing(false);
                              }
                            }}
                            className="shrink-0 px-3 py-1 text-[10px] uppercase tracking-wider bg-white/5 text-[#A1A1AA] border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Add external rager form ── */}
              {showAddRager && (
                <div className="mt-4 p-4 bg-[#0A0A0A] border border-white/5 space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#52525B] font-medium">
                    Add External Rager
                    <span className="ml-2 text-[#3f3f46] normal-case tracking-normal">Add a rager not already in the system. They'll receive an outreach email if a brief exists.</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { field: 'name',        label: 'Name *',           placeholder: 'Full name' },
                      { field: 'email',       label: 'Email *',          placeholder: 'email@example.com' },
                      { field: 'title',       label: 'Title',            placeholder: 'e.g. Founder, VP Marketing' },
                      { field: 'company',     label: 'Company',          placeholder: 'Company name' },
                      { field: 'cost_to_founder', label: 'Cost to Founder (₹)', placeholder: '0' },
                      { field: 'payout_to_rager', label: 'Payout to Rager (₹)',  placeholder: '0' },
                    ].map(({ field, label, placeholder }) => (
                      <div key={field}>
                        <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">{label}</label>
                        <input
                          type={field.includes('to_') ? 'number' : 'text'}
                          value={addRagerForm[field]}
                          onChange={e => setAddRagerForm(prev => ({ ...prev, [field]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full bg-[#111] border border-white/10 text-[#F5F5F0] text-xs px-3 py-2 outline-none focus:border-white/20 placeholder:text-[#52525B]"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">Bio</label>
                    <textarea
                      rows={2}
                      value={addRagerForm.bio}
                      onChange={e => setAddRagerForm(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Short bio (optional)"
                      className="w-full bg-[#111] border border-white/10 text-[#F5F5F0] text-xs px-3 py-2 outline-none focus:border-white/20 placeholder:text-[#52525B] resize-none"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={addManualRager}
                      className="px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {acting ? 'Adding…' : 'Add Rager'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddRager(false); setAddRagerForm(EMPTY_ADD_RAGER); }}
                      className="px-4 py-2 border border-white/10 text-[#71717A] text-xs uppercase tracking-wider hover:text-[#F5F5F0] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Founder offer form ── */}
              {offerMode && offerableCount > 0 && (
                <div className="mt-4 p-4 bg-[#0A0A0A] border border-white/5 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] uppercase tracking-wider text-[#52525B] font-medium">
                      Prepare Founder Mail
                    </p>
                    {savedOffer?.status === 'sent' && (
                      <span className="text-[10px] text-amber-400 uppercase tracking-wider">Already sent · {savedOffer.sent_at?.slice(0, 10)}</span>
                    )}
                  </div>

                  <p className="text-[10px] text-[#3f3f46]">
                    All fields are optional. Included ragers: {offerableCount}.
                  </p>

                  <OfferField label="Intro message">
                    <textarea
                      rows={3}
                      value={offerForm.intro_message}
                      onChange={e => setOffer('intro_message', e.target.value)}
                      placeholder="Personal note to the founder (shown at top of email)"
                      className={textareaCls}
                    />
                  </OfferField>

                  <div className="grid grid-cols-2 gap-3">
                    <OfferField label="Format">
                      <select
                        value={offerForm.format_type}
                        onChange={e => setOffer('format_type', e.target.value)}
                        className={inputCls}
                      >
                        <option value="">— not specified —</option>
                        <option value="online">Online</option>
                        <option value="offline">In-person</option>
                        <option value="hybrid">Hybrid</option>
                      </select>
                    </OfferField>

                    <OfferField label="Duration">
                      <input
                        type="text"
                        value={offerForm.duration_text}
                        onChange={e => setOffer('duration_text', e.target.value)}
                        placeholder="e.g. 60 minutes"
                        className={inputCls}
                      />
                    </OfferField>

                    <OfferField label="Venue / Link">
                      <input
                        type="text"
                        value={offerForm.venue}
                        onChange={e => setOffer('venue', e.target.value)}
                        placeholder="e.g. Zoom / office address"
                        className={inputCls}
                      />
                    </OfferField>

                    <OfferField label="Proposed Dates">
                      <input
                        type="text"
                        value={offerForm.optional_dates}
                        onChange={e => setOffer('optional_dates', e.target.value)}
                        placeholder="e.g. Any weekday in May"
                        className={inputCls}
                      />
                    </OfferField>

                    <OfferField label="Investment / Budget">
                      <input
                        type="text"
                        value={offerForm.budget_text}
                        onChange={e => setOffer('budget_text', e.target.value)}
                        placeholder="e.g. ₹8,000 + GST"
                        className={inputCls}
                      />
                    </OfferField>

                    <OfferField label="Cost Notes">
                      <input
                        type="text"
                        value={offerForm.cost_notes}
                        onChange={e => setOffer('cost_notes', e.target.value)}
                        placeholder="e.g. Invoice after session"
                        className={inputCls}
                      />
                    </OfferField>
                  </div>

                  {/* Status hints for the offer form */}
                  {reconfirmedCount === 0 && reconfirmPending === 0 && shortlistedAccepted > 0 && (
                    <p className="text-[10px] text-[#52525B] bg-white/[0.02] border border-white/5 px-3 py-2">
                      Save the draft first, then send reconfirmation to shortlisted ragers. Once they confirm, send the shortlist to the founder.
                    </p>
                  )}
                  {reconfirmPending > 0 && reconfirmedCount === 0 && (
                    <p className="text-[10px] text-sky-400 bg-sky-500/5 border border-sky-500/10 px-3 py-2">
                      Reconfirmation sent to {reconfirmPending} rager(s) — waiting for responses before shortlist can go to founder.
                    </p>
                  )}
                  {reconfirmedCount > 0 && (
                    <p className="text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 px-3 py-2">
                      {reconfirmedCount} rager(s) reconfirmed ✓ — ready to send shortlist. Founder will select their preferred advisor(s).
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-2 flex-wrap">
                    <button
                      type="button"
                      disabled={offerSaving || acting}
                      onClick={saveOffer}
                      className="px-4 py-2.5 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {offerSaving ? 'Saving…' : 'Save Draft'}
                    </button>

                    {canSendReconfirmation && (
                      <button
                        type="button"
                        disabled={acting || !savedOffer}
                        onClick={sendReconfirmation}
                        title={!savedOffer ? 'Save the draft first' : ''}
                        className="flex items-center gap-2 px-4 py-2.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        Send Reconfirmation ({shortlistedAccepted + reconfirmPending})
                      </button>
                    )}

                    {/* Send shortlist — founder gets individual Select buttons per advisor */}
                    <button
                      type="button"
                      disabled={acting || !canSendToFounder}
                      onClick={sendOffer}
                      title={!canSendToFounder ? (reconfirmedCount === 0 ? 'Wait for rager reconfirmation first' : 'Save the draft first') : ''}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-40"
                    >
                      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Send Shortlist to Founder
                    </button>
                  </div>
                </div>
              )}

              {/* Schedule form */}
              {scheduleMode && canSchedule && (
                <div className="mt-4 p-4 bg-[#0A0A0A] border border-white/5 space-y-3">
                  <p className="text-[10px] uppercase tracking-wider text-[#52525B] font-medium">Session Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">Scheduled Date/Time</label>
                      <input
                        type="datetime-local"
                        value={scheduledAt ? scheduledAt.slice(0, 16) : ''}
                        onChange={e => setScheduledAt(e.target.value)}
                        className="w-full bg-[#111] border border-white/10 text-[#F5F5F0] text-xs px-3 py-2 outline-none focus:border-white/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-wider text-[#52525B] block mb-1">Notes</label>
                      <input
                        type="text"
                        value={sessionNotes}
                        onChange={e => setSessionNotes(e.target.value)}
                        placeholder="e.g. Zoom link, agenda"
                        className="w-full bg-[#111] border border-white/10 text-[#F5F5F0] text-xs px-3 py-2 outline-none focus:border-white/20 placeholder:text-[#52525B]"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={saveSchedule}
                    className="px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {acting ? 'Saving...' : 'Save'}
                  </button>
                  {detail?.enquiry?.scheduled_at && (
                    <p className="text-xs text-[#71717A]">
                      Currently scheduled: {new Date(detail.enquiry.scheduled_at).toLocaleString()}
                      {detail.enquiry.session_notes ? ` — ${detail.enquiry.session_notes}` : ''}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminResponsesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    api.get('/admin/enquiries')
      .then(r => setEnquiries(r.data || []))
      .catch(() => toast.error('Failed to load enquiries'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
    </div>
  );

  const sorted = [...enquiries].reverse();
  const filtered = sorted.filter(e => {
    if (filter === 'active') return !['new', 'declined', 'closed', 'founder_rejected', 'needs_more_candidates'].includes(e.status);
    if (filter === 'confirmed') return ['confirmed', 'confirmed_ready_to_schedule', 'rager_confirmed'].includes(e.status);
    return true;
  });

  const FILTERS = [
    { key: 'active',    label: 'In Progress' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'all',       label: 'All' },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Responses</h1>
        <p className="text-sm text-[#52525B] mt-1">Rager responses, shortlisting, and session management</p>
      </div>

      <div className="flex gap-1 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
              filter === f.key
                ? 'bg-[#DC143C]/10 text-[#DC143C] border border-[#DC143C]/30'
                : 'text-[#52525B] border border-white/5 hover:text-[#A1A1AA] hover:border-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[#52525B] self-center">{filtered.length} enquiries</span>
      </div>

      {filtered.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
          <p className="text-[#52525B] text-sm">No enquiries in this view.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(enq => (
            <EnquiryRow key={enq.id} enq={enq} />
          ))}
        </div>
      )}
    </div>
  );
}
