import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Calendar, Mail } from 'lucide-react';

const ENQ_STATUS_COLORS = {
  new:                         'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  matching:                    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending_rager:               'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pending_founder:             'bg-orange-500/10 text-orange-400 border-orange-500/20',
  pending_founder_offer:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  rager_confirmation_pending:  'bg-sky-500/10 text-sky-400 border-sky-500/20',
  confirmed:                   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  founder_accepted:            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  founder_rejected:            'bg-red-500/10 text-red-400 border-red-500/20',
  declined:                    'bg-red-500/10 text-red-400 border-red-500/20',
  closed:                      'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const ALLOC_STATUS_LABELS = {
  pending_rager:               { label: 'Awaiting response',        color: 'text-[#71717A]' },
  rager_accepted:              { label: 'Accepted',                 color: 'text-emerald-400' },
  rager_declined:              { label: 'Declined',                 color: 'text-red-400' },
  pending_founder:             { label: 'Offer in progress',        color: 'text-orange-400' },
  confirmed:                   { label: 'Confirmed',                color: 'text-emerald-400' },
  founder_declined:            { label: 'Not chosen',               color: 'text-[#52525B]' },
  rager_confirmation_pending:  { label: 'Awaiting rager confirm',   color: 'text-sky-400' },
  rager_confirmed:             { label: 'Rager confirmed',          color: 'text-emerald-400' },
  rager_declined_final:        { label: 'Rager unavailable',        color: 'text-red-400' },
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

  const sendOffer = async () => {
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${enq.id}/founder-offer`, offerForm);
      await api.post(`/admin/enquiries/${enq.id}/send-founder-offer`);
      toast.success('Proposal sent to founder');
      setOfferMode(false);
      setSavedOffer(null);
      setOfferLoaded(false);
      setDetail(null);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send proposal');
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

  const allocations = detail?.allocations || [];
  // Ragers available for offer: shortlisted+accepted OR already in offer pipeline
  const offerableCount = allocations.filter(a =>
    (a.shortlist_status === 'shortlisted' && a.status === 'rager_accepted') ||
    ['pending_founder', 'rager_confirmation_pending', 'rager_confirmed'].includes(a.status)
  ).length;
  const TERMINAL = ['founder_rejected', 'confirmed', 'declined', 'closed', 'rager_confirmed'];
  const canPrepareOffer = offerableCount > 0 && !TERMINAL.includes(enq.status) && enq.status !== 'rager_confirmation_pending';
  const canSchedule     = ['confirmed', 'founder_accepted', 'rager_confirmed'].includes(enq.status);

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
                              {canShortlist && (
                                <div className="flex items-center gap-1.5">
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
                                </div>
                              )}
                              {alloc.status === 'confirmed' && (
                                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Chosen
                                </span>
                              )}
                              {alloc.status === 'pending_founder' && (
                                <span className="text-[10px] text-orange-400">Awaiting founder</span>
                              )}
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
                {canPrepareOffer && (
                  <button
                    type="button"
                    onClick={() => { setScheduleMode(false); setOfferMode(v => { if (!v) openOfferMode(); return !v; }); }}
                    className={`flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors border ${
                      offerMode
                        ? 'bg-[#DC143C]/10 text-[#DC143C] border-[#DC143C]/30'
                        : 'bg-[#DC143C] hover:bg-[#B01030] text-white border-transparent'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {offerMode ? 'Close' : 'Prepare Founder Mail'}
                  </button>
                )}

                {canSchedule && (
                  <button
                    type="button"
                    onClick={() => { setOfferMode(false); setScheduleMode(v => !v); }}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#A1A1AA] text-xs uppercase tracking-wider transition-colors border border-white/10"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {scheduleMode ? 'Cancel' : 'Schedule Session'}
                  </button>
                )}

                {enq.status === 'pending_founder_offer' && (
                  <p className="text-xs text-amber-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Proposal sent — awaiting founder response
                  </p>
                )}

                {enq.status === 'rager_confirmation_pending' && (
                  <p className="text-xs text-sky-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Founder accepted — awaiting rager confirmation
                  </p>
                )}

                {enq.status === 'founder_rejected' && (
                  <p className="text-xs text-red-400">
                    <XCircle className="w-3 h-3 inline mr-1" />
                    Founder declined proposal
                  </p>
                )}

                {enq.status === 'confirmed' && (
                  <p className="text-xs text-emerald-400">
                    <CheckCircle className="w-3 h-3 inline mr-1" />
                    Session confirmed — ready to schedule
                  </p>
                )}
              </div>

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

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      disabled={acting}
                      onClick={sendOffer}
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      Send to Founder
                    </button>
                    <button
                      type="button"
                      disabled={offerSaving || acting}
                      onClick={saveOffer}
                      className="px-4 py-2.5 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                    >
                      {offerSaving ? 'Saving…' : 'Save Draft'}
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
    if (filter === 'active') return !['new', 'declined', 'closed', 'founder_rejected'].includes(e.status);
    if (filter === 'confirmed') return ['confirmed', 'rager_confirmed'].includes(e.status);
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
