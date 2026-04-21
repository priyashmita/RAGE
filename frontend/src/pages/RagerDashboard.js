import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, CheckCircle, XCircle, Mail, ChevronRight,
} from 'lucide-react';
import { ragerAuthHeader, clearRagerToken } from '@/lib/ragerAuth';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// ── Status metadata ───────────────────────────────────────────────────────────
// section: 'action' | 'progress' | 'history'
// terminal: true means the allocation is resolved (won't change)

const STATUS_META = {
  // ── Action Required ──────────────────────────────────────────────────────
  pending_rager: {
    label:    'Action required',
    badge:    'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    section:  'action',
    terminal: false,
    next:     null, // has buttons
  },
  reconfirmation_pending: {
    label:    'Reconfirmation needed',
    badge:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
    section:  'action',
    terminal: false,
    next:     'Reply to the reconfirmation email sent to you to confirm your availability.',
  },
  final_disclosure_sent: {
    label:    'Final confirmation needed',
    badge:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
    section:  'action',
    terminal: false,
    next:     'Founder details have been shared. Reply to the final disclosure email to confirm.',
  },

  // ── In Progress ──────────────────────────────────────────────────────────
  rager_accepted: {
    label:    'Accepted — awaiting founder',
    badge:    'text-sky-400 bg-sky-500/10 border-sky-500/20',
    section:  'progress',
    terminal: false,
    next:     'Waiting for the founder to review all candidates. RAGE will reach out soon.',
  },
  reconfirmed_for_offer: {
    label:    'Reconfirmed',
    badge:    'text-sky-400 bg-sky-500/10 border-sky-500/20',
    section:  'progress',
    terminal: false,
    next:     'Your reconfirmation is received. Waiting for the founder to select a candidate.',
  },
  offer_sent_to_founder: {
    label:    'Offer with founder',
    badge:    'text-sky-400 bg-sky-500/10 border-sky-500/20',
    section:  'progress',
    terminal: false,
    next:     'Your offer has been sent to the founder. Awaiting their decision.',
  },
  selected_by_founder: {
    label:    'Selected by founder',
    badge:    'text-teal-400 bg-teal-500/10 border-teal-500/20',
    section:  'progress',
    terminal: false,
    next:     'The founder has selected you. Final disclosure will be sent to you shortly.',
  },
  rager_final_confirmed: {
    label:    'Session confirmed',
    badge:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    section:  'progress',
    terminal: false,
    next:     "You've confirmed. RAGE will coordinate scheduling with you and the founder.",
  },
  confirmed_ready_to_schedule: {
    label:    'Ready to schedule',
    badge:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    section:  'progress',
    terminal: false,
    next:     'All parties confirmed. Expect a scheduling email from RAGE shortly.',
  },
  // backward-compat
  pending_founder: {
    label:    'Awaiting founder decision',
    badge:    'text-orange-400 bg-orange-500/10 border-orange-500/20',
    section:  'progress',
    terminal: false,
    next:     'The founder is reviewing all candidates. RAGE will reach out soon.',
  },

  // ── History / Terminal ────────────────────────────────────────────────────
  confirmed: {
    label:    'Session completed',
    badge:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    section:  'history',
    terminal: true,
    next:     null,
  },
  rager_declined: {
    label:    'You declined',
    badge:    'text-[#71717A] bg-white/5 border-white/10',
    section:  'history',
    terminal: true,
    next:     null,
  },
  reconfirmation_declined: {
    label:    'Declined at reconfirmation',
    badge:    'text-[#71717A] bg-white/5 border-white/10',
    section:  'history',
    terminal: true,
    next:     null,
  },
  not_selected_by_founder: {
    label:    'Not selected',
    badge:    'text-[#71717A] bg-white/5 border-white/10',
    section:  'history',
    terminal: true,
    next:     null,
  },
  founder_declined: {
    label:    'Founder didn\'t proceed',
    badge:    'text-[#71717A] bg-white/5 border-white/10',
    section:  'history',
    terminal: true,
    next:     null,
  },
};

const EARNED_STATUSES  = new Set(['confirmed', 'rager_final_confirmed', 'confirmed_ready_to_schedule']);
const PENDING_STATUSES = new Set(['rager_accepted', 'reconfirmed_for_offer', 'offer_sent_to_founder', 'selected_by_founder', 'pending_founder']);

// ── Formatters ────────────────────────────────────────────────────────────────

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sessionType(alloc) {
  const f = alloc.enquiry?.format || '';
  if (!f) return 'Advisory Session';
  return f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function metaFor(status) {
  return STATUS_META[status] || {
    label:    status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    badge:    'text-[#71717A] bg-white/5 border-white/10',
    section:  'history',
    terminal: true,
    next:     null,
  };
}

// ── Earnings ──────────────────────────────────────────────────────────────────

function EarningsSection({ allocations }) {
  const totalEarned    = allocations
    .filter(a => EARNED_STATUSES.has(a.status))
    .reduce((s, a) => s + (a.payout_to_rager || 0), 0);

  const pendingPay     = allocations
    .filter(a => PENDING_STATUSES.has(a.status))
    .reduce((s, a) => s + (a.payout_to_rager || 0), 0);

  const completedCount = allocations.filter(a => EARNED_STATUSES.has(a.status)).length;

  return (
    <section className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">Earnings</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111111] border border-white/8 p-5">
          <p className="text-xs uppercase tracking-wider text-[#52525B] mb-2">Total Earned</p>
          <p className="text-2xl font-light text-[#F5F5F0]">{fmt(totalEarned)}</p>
        </div>
        <div className="bg-[#111111] border border-white/8 p-5">
          <p className="text-xs uppercase tracking-wider text-[#52525B] mb-2">Pending</p>
          <p className="text-2xl font-light text-[#A1A1AA]">{fmt(pendingPay)}</p>
          <p className="text-[10px] text-[#3F3F46] mt-1">Accepted, awaiting completion</p>
        </div>
        <div className="bg-[#111111] border border-white/8 p-5">
          <p className="text-xs uppercase tracking-wider text-[#52525B] mb-2">Sessions</p>
          <p className="text-2xl font-light text-[#F5F5F0]">{completedCount}</p>
          <p className="text-[10px] text-[#3F3F46] mt-1">Completed</p>
        </div>
      </div>
    </section>
  );
}

// ── Allocation Card ───────────────────────────────────────────────────────────
// Renders stage-aware disclosed data — never more than what's been sent to rager.

function AllocationCard({ alloc, onRespond, responding }) {
  const status = alloc.status;
  const meta   = metaFor(status);
  const brief  = alloc.brief_data;
  const offer  = alloc.offer_data;
  const founder = alloc.founder_data;
  const enquiry = alloc.enquiry || {};

  const isActionRequired = meta.section === 'action';
  const isPendingRager   = status === 'pending_rager';

  const borderClass = isActionRequired
    ? 'border-[#DC143C]/20'
    : meta.section === 'progress'
    ? 'border-white/8'
    : 'border-white/5';

  return (
    <div className={`bg-[#111111] border ${borderClass} p-5 flex flex-col gap-4`}>

      {/* ── Header: session type + status badge + date ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-sm font-medium text-[#F5F5F0]">{sessionType(alloc)}</p>
          {enquiry.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {enquiry.categories.map(cat => (
                <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-[#DC143C]/10 border border-[#DC143C]/20 text-[#DC143C]">
                  {cat}
                </span>
              ))}
            </div>
          )}
          {enquiry.created_at && (
            <p className="text-[10px] text-[#3F3F46]">{fmtDate(enquiry.created_at)}</p>
          )}
        </div>
        <span className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 border ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      {/* ── Brief data (always shown when available) ── */}
      {brief && (
        <div className="flex flex-col gap-3 pt-1 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#52525B]">Request summary</p>

          {brief.situation && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">Situation</p>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">{brief.situation}</p>
            </div>
          )}

          {brief.what_they_need && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">What they need</p>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">{brief.what_they_need}</p>
            </div>
          )}

          {brief.help_items?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-1">Specific help needed</p>
              <ul className="flex flex-col gap-1">
                {brief.help_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#A1A1AA]">
                    <span className="w-1 h-1 bg-[#DC143C] rounded-full mt-[7px] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Compact label row */}
          <div className="flex flex-wrap gap-2">
            {brief.stage_label && (
              <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/8 text-[#71717A]">
                {brief.stage_label}
              </span>
            )}
            {brief.urgency_label && (
              <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/8 text-[#71717A]">
                {brief.urgency_label}
              </span>
            )}
            {brief.format_label && (
              <span className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/8 text-[#71717A]">
                {brief.format_label}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Offer data (reconfirmation+ only) ── */}
      {offer && (
        <div className="flex flex-col gap-3 pt-1 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#52525B]">Session details</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {offer.format_type && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">Format</p>
                <p className="text-sm text-[#A1A1AA]">{offer.format_type}</p>
              </div>
            )}
            {offer.duration_text && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">Duration</p>
                <p className="text-sm text-[#A1A1AA]">{offer.duration_text}</p>
              </div>
            )}
            {offer.budget_text && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">Budget</p>
                <p className="text-sm text-[#A1A1AA]">{offer.budget_text}</p>
              </div>
            )}
            {offer.venue && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">Venue</p>
                <p className="text-sm text-[#A1A1AA]">{offer.venue}</p>
              </div>
            )}
          </div>
          {offer.optional_dates && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#3F3F46] mb-0.5">Proposed dates</p>
              <p className="text-sm text-[#A1A1AA]">{offer.optional_dates}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Founder identity (final disclosure+ only) ── */}
      {founder && (founder.name || founder.email) && (
        <div className="flex flex-col gap-2 pt-1 border-t border-emerald-500/20 bg-emerald-500/5 -mx-5 -mb-4 px-5 pb-4 mt-1">
          <div className="flex items-center gap-1.5 pt-3">
            <CheckCircle className="w-3 h-3 text-emerald-400" />
            <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400">Founder revealed</p>
          </div>
          {founder.name && (
            <p className="text-sm font-medium text-[#F5F5F0]">{founder.name}</p>
          )}
          {founder.email && (
            <p className="text-sm text-emerald-400">{founder.email}</p>
          )}
        </div>
      )}

      {/* ── Advisory fee ── */}
      {alloc.payout_to_rager > 0 && (
        <div className="pt-1 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-0.5">Your advisory fee</p>
          <p className="text-sm font-medium text-[#F5F5F0]">{fmt(alloc.payout_to_rager)}</p>
        </div>
      )}

      {/* ── CTA ── */}
      {isPendingRager && (
        <div className="flex gap-2 pt-1 border-t border-white/5">
          <button
            disabled={!!responding}
            onClick={() => onRespond(alloc.id, 'accept')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {responding === alloc.id + 'accept'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <CheckCircle className="w-3.5 h-3.5" />}
            I'm available
          </button>
          <button
            disabled={!!responding}
            onClick={() => onRespond(alloc.id, 'decline')}
            className="flex items-center gap-1.5 px-4 py-2 border border-white/10 text-[#71717A] hover:text-[#F5F5F0] hover:border-white/20 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {responding === alloc.id + 'decline'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <XCircle className="w-3.5 h-3.5" />}
            Not this time
          </button>
        </div>
      )}

      {!isPendingRager && meta.next && (
        <div className="flex items-start gap-2 pt-1 border-t border-white/5">
          <ChevronRight className="w-3 h-3 text-[#52525B] mt-[3px] shrink-0" />
          <p className="text-xs text-[#71717A] leading-relaxed">{meta.next}</p>
        </div>
      )}

    </div>
  );
}

// ── Section wrappers ──────────────────────────────────────────────────────────

function ActionSection({ cards, onRespond, responding }) {
  return (
    <section className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">
        Action Required
        {cards.length > 0 && (
          <span className="text-[#DC143C] ml-1">({cards.length})</span>
        )}
      </p>
      {cards.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-white/8 p-8 text-center">
          <p className="text-sm text-[#52525B]">No pending actions. You're all caught up.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map(alloc => (
            <AllocationCard
              key={alloc.id}
              alloc={alloc}
              onRespond={onRespond}
              responding={responding}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProgressSection({ cards }) {
  if (cards.length === 0) return null;

  return (
    <section className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">
        In Progress
        <span className="text-[#A1A1AA] ml-1">({cards.length})</span>
      </p>
      <div className="flex flex-col gap-3">
        {cards.map(alloc => (
          <AllocationCard
            key={alloc.id}
            alloc={alloc}
            onRespond={null}
            responding={null}
          />
        ))}
      </div>
    </section>
  );
}

function HistorySection({ cards }) {
  if (cards.length === 0) return null;

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">History</p>
      <div className="flex flex-col gap-2">
        {cards.map(alloc => {
          const meta    = metaFor(alloc.status);
          const isEarned = EARNED_STATUSES.has(alloc.status);
          return (
            <div key={alloc.id} className="bg-[#0A0A0A] border border-white/5 px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="text-sm text-[#F5F5F0] truncate">{sessionType(alloc)}</p>
                <div className="flex items-center gap-3">
                  {alloc.enquiry?.created_at && (
                    <p className="text-[11px] text-[#52525B]">{fmtDate(alloc.enquiry.created_at)}</p>
                  )}
                  {alloc.payout_to_rager > 0 && isEarned && (
                    <p className="text-[11px] text-emerald-500">{fmt(alloc.payout_to_rager)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isEarned && (
                  <span title="Completed — contact details sent via email">
                    <Mail className="w-3.5 h-3.5 text-[#52525B]" />
                  </span>
                )}
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${meta.badge}`}>
                  {meta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function RagerDashboard() {
  const navigate = useNavigate();
  const { rager } = useOutletContext();
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [responding, setResponding]   = useState(null);

  useEffect(() => {
    axios
      .get(`${BACKEND}/api/rager/allocations`, { headers: ragerAuthHeader() })
      .then(res => setAllocations(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          clearRagerToken();
          navigate('/rager-login', { replace: true });
        } else {
          toast.error('Failed to load requests');
        }
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const handleRespond = async (allocationId, response) => {
    setResponding(allocationId + response);
    try {
      await axios.post(
        `${BACKEND}/api/rager/allocations/${allocationId}/respond`,
        { response },
        { headers: ragerAuthHeader() }
      );
      setAllocations(prev =>
        prev.map(a =>
          a.id === allocationId
            ? { ...a, status: response === 'accept' ? 'rager_accepted' : 'rager_declined' }
            : a
        )
      );
      toast.success(
        response === 'accept'
          ? "You've accepted — RAGE will be in touch."
          : "Noted, you've declined this request."
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to respond');
    } finally {
      setResponding(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
      </div>
    );
  }

  const actionCards   = allocations.filter(a => metaFor(a.status).section === 'action');
  const progressCards = allocations.filter(a => metaFor(a.status).section === 'progress');
  const historyCards  = allocations
    .filter(a => metaFor(a.status).section === 'history')
    .slice(0, 15);

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">

      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-1">Rager Portal</p>
        <h1 className="text-2xl font-light text-[#F5F5F0]">
          Welcome back, {rager.name.split(' ')[0]}
        </h1>
        {(rager.title || rager.company) && (
          <p className="text-sm text-[#52525B] mt-1">
            {rager.title}{rager.company ? ` · ${rager.company}` : ''}
          </p>
        )}
      </div>

      <EarningsSection allocations={allocations} />

      <ActionSection
        cards={actionCards}
        onRespond={handleRespond}
        responding={responding}
      />

      <ProgressSection cards={progressCards} />

      <HistorySection cards={historyCards} />

    </main>
  );
}
