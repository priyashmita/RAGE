import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronRight, Archive, RotateCcw } from 'lucide-react';

const STATUS_COLORS = {
  new:             'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  matching:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending_rager:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pending_founder: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  confirmed:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  declined:        'bg-red-500/10 text-red-400 border-red-500/20',
  closed:          'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const REASONS = ['testing', 'duplicate', 'invalid', 'other'];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminEnquiriesPage() {
  const navigate = useNavigate();

  const [enquiries, setEnquiries]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [filter, setFilter]                 = useState('active');
  const [expanded, setExpanded]             = useState(null);
  const [selected, setSelected]             = useState(new Set());
  const [bulkReason, setBulkReason]         = useState('testing');
  const [archiveTarget, setArchiveTarget]   = useState(null); // { id, reason }
  const [acting, setActing]                 = useState(false);
  const [page, setPage]                     = useState(1);
  const PAGE_SIZE                           = 25;

  const load = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    setArchiveTarget(null);
    api.get('/admin/enquiries', { params: { filter } })
      .then(r => setEnquiries(r.data || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // ── Per-row archive / restore ─────────────────────────────────────────────

  const handleArchive = async (id, reason) => {
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${id}/archive`, { reason });
      toast.success('Enquiry archived');
      setArchiveTarget(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to archive');
    } finally {
      setActing(false);
    }
  };

  const handleRestore = async (id) => {
    setActing(true);
    try {
      await api.post(`/admin/enquiries/${id}/restore`);
      toast.success('Enquiry restored');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to restore');
    } finally {
      setActing(false);
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleBulkArchive = async () => {
    if (selected.size === 0) return;
    setActing(true);
    try {
      const res = await api.post('/admin/enquiries/bulk-archive', {
        enquiry_ids: [...selected],
        reason: bulkReason,
      });
      toast.success(`${res.data.modified} enquiries archived`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk archive failed');
    } finally {
      setActing(false);
    }
  };

  const handleBulkRestore = async () => {
    if (selected.size === 0) return;
    setActing(true);
    try {
      const res = await api.post('/admin/enquiries/bulk-restore', {
        enquiry_ids: [...selected],
      });
      toast.success(`${res.data.modified} enquiries restored`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk restore failed');
    } finally {
      setActing(false);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleSelect = (id) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const toggleSelectAll = () =>
    setSelected(
      selected.size === enquiries.length
        ? new Set()
        : new Set(enquiries.map(e => e.id))
    );

  const sorted    = [...enquiries].reverse();
  const pageCount = Math.ceil(sorted.length / PAGE_SIZE);
  const paged     = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Enquiries</h1>
        <p className="text-sm text-[#52525B] mt-1">
          {enquiries.length} {filter === 'all' ? 'total' : filter}
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 mb-6 border-b border-white/8">
        {['active', 'archived', 'all'].map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setExpanded(null); setPage(1); }}
            className={`px-5 py-2 text-xs uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              filter === f
                ? 'border-[#DC143C] text-[#F5F5F0]'
                : 'border-transparent text-[#52525B] hover:text-[#A1A1AA]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-[#111111] border border-white/8 px-4 py-3">
          <span className="text-xs text-[#A1A1AA]">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select
              value={bulkReason}
              onChange={e => setBulkReason(e.target.value)}
              className="bg-[#0A0A0A] border border-white/10 text-[#A1A1AA] text-xs px-2 py-1 focus:outline-none"
            >
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              disabled={acting}
              onClick={handleBulkArchive}
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider px-3 py-1 bg-[#DC143C]/10 border border-[#DC143C]/20 text-[#DC143C] hover:bg-[#DC143C]/20 transition-colors disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Archive className="w-3 h-3" />}
              Archive
            </button>
            <button
              disabled={acting}
              onClick={handleBulkRestore}
              className="flex items-center gap-1.5 text-xs uppercase tracking-wider px-3 py-1 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 transition-colors disabled:opacity-50"
            >
              {acting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              Restore
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors ml-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
        </div>
      ) : enquiries.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
          <p className="text-[#52525B] text-sm">
            {filter === 'archived' ? 'No archived enquiries.' : 'No enquiries yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">

          {/* Select-all row */}
          {enquiries.length > 1 && (
            <div className="flex items-center gap-2 px-1 pb-1">
              <input
                type="checkbox"
                checked={selected.size === enquiries.length && enquiries.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 accent-[#DC143C] cursor-pointer"
              />
              <span className="text-[10px] text-[#52525B] uppercase tracking-wider cursor-pointer select-none" onClick={toggleSelectAll}>
                Select all
              </span>
            </div>
          )}

          {paged.map(enq => {
            const isArchived      = !!enq.is_archived;
            const isArchivingThis = archiveTarget?.id === enq.id;
            const isExpanded      = expanded === enq.id;

            return (
              <div
                key={enq.id}
                className={`border ${
                  isArchived
                    ? 'bg-[#0A0A0A] border-white/5'
                    : selected.has(enq.id)
                    ? 'bg-[#111111] border-[#DC143C]/20'
                    : 'bg-[#111111] border-white/8'
                }`}
              >
                {/* Row header */}
                <div className="flex items-center gap-3 p-4">

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(enq.id)}
                    onChange={() => toggleSelect(enq.id)}
                    onClick={e => e.stopPropagation()}
                    className="w-4 h-4 accent-[#DC143C] shrink-0 cursor-pointer"
                  />

                  {/* Main content row (expand on click) */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : enq.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-[#F5F5F0] truncate max-w-[200px]">
                        {enq.name}
                      </span>
                      {enq.company && (
                        <span className="text-xs text-[#71717A] truncate max-w-[120px]">{enq.company}</span>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${STATUS_COLORS[enq.status] || STATUS_COLORS.new}`}>
                        {(enq.status || 'new').replace(/_/g, ' ')}
                      </span>
                      {isArchived && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border border-[#52525B]/30 text-[#52525B] bg-[#52525B]/10">
                          archived{enq.archive_reason ? ` · ${enq.archive_reason}` : ''}
                        </span>
                      )}
                      {enq.format && (
                        <span className="text-[10px] text-[#52525B] uppercase tracking-wider hidden sm:inline">
                          {enq.format.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#71717A] truncate">
                      {enq.challenge || enq.message || enq.problem_statement || '—'}
                    </p>
                  </button>

                  {/* Right side */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-[#52525B] font-mono block">
                        {enq.created_at?.slice(0, 10)}
                      </span>
                      {isArchived && enq.archived_at && (
                        <span className="text-[10px] text-[#3F3F46] font-mono block">
                          {fmtDate(enq.archived_at)}
                        </span>
                      )}
                    </div>

                    {/* Per-row action */}
                    {isArchived ? (
                      <button
                        disabled={acting}
                        onClick={() => handleRestore(enq.id)}
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 transition-colors disabled:opacity-50"
                        title="Restore enquiry"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setArchiveTarget(
                            isArchivingThis ? null : { id: enq.id, reason: 'testing' }
                          )
                        }
                        className={`flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border transition-colors ${
                          isArchivingThis
                            ? 'border-[#DC143C]/40 text-[#DC143C] bg-[#DC143C]/10'
                            : 'border-white/10 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20'
                        }`}
                        title="Archive enquiry"
                      >
                        <Archive className="w-3 h-3" />
                        <span className="hidden sm:inline">Archive</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpanded(isExpanded ? null : enq.id)}
                      className="text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                    >
                      {isExpanded
                        ? <ChevronDown className="w-3.5 h-3.5" />
                        : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Inline archive reason picker */}
                {isArchivingThis && (
                  <div className="px-4 py-2.5 flex items-center gap-3 border-t border-[#DC143C]/15 bg-[#DC143C]/5">
                    <span className="text-[10px] uppercase tracking-wider text-[#DC143C] shrink-0">
                      Reason
                    </span>
                    <select
                      value={archiveTarget.reason}
                      onChange={e => setArchiveTarget(t => ({ ...t, reason: e.target.value }))}
                      className="bg-[#0A0A0A] border border-white/10 text-[#A1A1AA] text-xs px-2 py-1 focus:outline-none"
                    >
                      {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button
                      disabled={acting}
                      onClick={() => handleArchive(enq.id, archiveTarget.reason)}
                      className="flex items-center gap-1.5 text-xs uppercase tracking-wider px-3 py-1 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors disabled:opacity-50"
                    >
                      {acting
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setArchiveTarget(null)}
                      className="text-[10px] text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        ['Email',   enq.email],
                        ['Format',  enq.format || enq.interest || '—'],
                        ['Budget',  enq.budget || '—'],
                        ['Urgency', enq.urgency || '—'],
                      ].map(([label, val]) => (
                        <div key={label}>
                          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">{label}</p>
                          <p className="text-xs text-[#A1A1AA]">{val}</p>
                        </div>
                      ))}
                    </div>

                    {(enq.challenge || enq.problem_statement || enq.message) && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Challenge</p>
                        <p className="text-xs text-[#A1A1AA] leading-relaxed">
                          {enq.challenge || enq.problem_statement || enq.message}
                        </p>
                      </div>
                    )}

                    {enq.help_needed?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Help needed</p>
                        <p className="text-xs text-[#A1A1AA]">{enq.help_needed.join(', ')}</p>
                      </div>
                    )}

                    {/* Archive metadata (expanded detail) */}
                    {isArchived && (enq.archive_reason || enq.archived_by || enq.archived_at) && (
                      <div className="border-t border-white/5 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {enq.archive_reason && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Reason</p>
                            <p className="text-xs text-[#71717A]">{enq.archive_reason}</p>
                          </div>
                        )}
                        {enq.archived_by && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Archived by</p>
                            <p className="text-xs text-[#71717A] truncate">{enq.archived_by}</p>
                          </div>
                        )}
                        {enq.archived_at && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Archived on</p>
                            <p className="text-xs text-[#71717A]">{fmtDate(enq.archived_at)}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {!isArchived && (
                      <div className="pt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/matching?enquiry=${enq.id}`)}
                          className="text-xs uppercase tracking-wider px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors"
                        >
                          Match Ragers
                        </button>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <span className="text-[10px] text-[#52525B]">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="text-[10px] uppercase tracking-wider px-3 py-1 border border-white/8 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pageCount || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === '…' ? (
                      <span key={`ellipsis-${i}`} className="text-[10px] text-[#3F3F46] px-2 py-1">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`text-[10px] px-3 py-1 border transition-colors ${
                          page === p
                            ? 'border-[#DC143C]/40 text-[#DC143C]'
                            : 'border-white/8 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  disabled={page === pageCount}
                  onClick={() => setPage(p => p + 1)}
                  className="text-[10px] uppercase tracking-wider px-3 py-1 border border-white/8 text-[#52525B] hover:text-[#A1A1AA] hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
