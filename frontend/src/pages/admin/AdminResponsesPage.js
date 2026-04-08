import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronRight, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';

const ENQ_STATUS_COLORS = {
  new:             'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  matching:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending_rager:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pending_founder: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  confirmed:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  declined:        'bg-red-500/10 text-red-400 border-red-500/20',
  closed:          'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const ALLOC_STATUS_LABELS = {
  pending_rager:    { label: 'Awaiting response', color: 'text-[#71717A]' },
  rager_accepted:   { label: 'Accepted', color: 'text-emerald-400' },
  rager_declined:   { label: 'Declined', color: 'text-red-400' },
  pending_founder:  { label: 'Sent to founder', color: 'text-orange-400' },
  confirmed:        { label: 'Confirmed', color: 'text-emerald-400' },
  founder_declined: { label: 'Not chosen', color: 'text-[#52525B]' },
};

const SHORTLIST_COLORS = {
  shortlisted: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected:    'bg-red-500/10 text-red-400 border-red-500/20',
};

function EnquiryRow({ enq }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [acting, setActing] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(enq.scheduled_at || '');
  const [sessionNotes, setSessionNotes] = useState(enq.session_notes || '');

  const loadDetail = useCallback(async () => {
    if (detail) return;
    setLoadingDetail(true);
    try {
      const res = await api.get(`/admin/enquiries/${enq.id}/responses`);
      setDetail(res.data);
      setScheduledAt(res.data.enquiry?.scheduled_at || '');
      setSessionNotes(res.data.enquiry?.session_notes || '');
    } catch {
      toast.error('Failed to load responses');
    } finally {
      setLoadingDetail(false);
    }
  }, [enq.id, detail]);

  const toggle = () => {
    if (!open) loadDetail();
    setOpen(v => !v);
  };

  const shortlist = async (allocId, status) => {
    setActing(true);
    try {
      await api.patch(`/admin/allocations/${allocId}/shortlist`, { shortlist_status: status });
      toast.success(status ? `Marked as ${status}` : 'Reset');
      setDetail(null); // force reload
      loadDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally {
      setActing(false);
    }
  };

  const sendShortlist = async () => {
    setActing(true);
    try {
      const res = await api.post(`/admin/enquiries/${enq.id}/send-shortlist`);
      toast.success(`Shortlist sent to founder — ${res.data.advisors_shown} advisor(s)`);
      setDetail(null);
      loadDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to send shortlist');
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
      loadDetail();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update session');
    } finally {
      setActing(false);
    }
  };

  const allocations = detail?.allocations || [];
  const shortlistedCount = allocations.filter(a => a.shortlist_status === 'shortlisted' && a.status === 'rager_accepted').length;
  const canSendShortlist = shortlistedCount > 0 && ['pending_rager', 'matching', 'new'].includes(enq.status);

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
                        const isAccepted = alloc.status === 'rager_accepted';
                        const canShortlist = isAccepted;
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
                {canSendShortlist && (
                  <button
                    type="button"
                    disabled={acting}
                    onClick={sendShortlist}
                    className="flex items-center gap-2 px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Send Shortlist to Founder ({shortlistedCount})
                  </button>
                )}

                {enq.status === 'confirmed' && (
                  <button
                    type="button"
                    onClick={() => setScheduleMode(v => !v)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-[#A1A1AA] text-xs uppercase tracking-wider transition-colors border border-white/10"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    {scheduleMode ? 'Cancel' : 'Schedule Session'}
                  </button>
                )}

                {enq.status === 'pending_founder' && (
                  <p className="text-xs text-[#52525B]">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Awaiting founder selection
                  </p>
                )}
              </div>

              {/* Schedule form */}
              {scheduleMode && enq.status === 'confirmed' && (
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

                  {/* Show current schedule if set */}
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
  const [filter, setFilter] = useState('active'); // 'active' | 'confirmed' | 'all'

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
    if (filter === 'active') return !['new', 'declined', 'closed'].includes(e.status);
    if (filter === 'confirmed') return e.status === 'confirmed';
    return true;
  });

  const FILTERS = [
    { key: 'active', label: 'In Progress' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Responses</h1>
        <p className="text-sm text-[#52525B] mt-1">Rager responses, shortlisting, and session management</p>
      </div>

      {/* Filter tabs */}
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
