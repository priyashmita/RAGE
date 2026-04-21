import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { ragerAuthHeader, clearRagerToken } from '@/lib/ragerAuth';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const STATUS_LABELS = {
  pending_rager:    { label: 'Awaiting your response',  color: 'text-yellow-400  bg-yellow-500/10  border-yellow-500/20'  },
  rager_accepted:   { label: 'You accepted',            color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rager_declined:   { label: 'You declined',            color: 'text-red-400     bg-red-500/10     border-red-500/20'     },
  pending_founder:  { label: 'Founder reviewing',       color: 'text-orange-400  bg-orange-500/10  border-orange-500/20'  },
  confirmed:        { label: 'Confirmed',               color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  founder_declined: { label: 'Not selected',            color: 'text-[#71717A]   bg-white/5        border-white/10'       },
};

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

// ── Earnings ─────────────────────────────────────────────────────────────────

function EarningsSection({ allocations }) {
  const totalEarned  = allocations
    .filter(a => a.status === 'confirmed')
    .reduce((s, a) => s + (a.payout_to_rager || 0), 0);

  const pendingPay   = allocations
    .filter(a => a.status === 'rager_accepted')
    .reduce((s, a) => s + (a.payout_to_rager || 0), 0);

  const completedCount = allocations.filter(a => a.status === 'confirmed').length;

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
          <p className="text-[10px] text-[#3F3F46] mt-1">Accepted, awaiting confirmation</p>
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

// ── Pending Actions ───────────────────────────────────────────────────────────

function PendingCard({ alloc, onRespond, responding }) {
  const enquiry = alloc.enquiry || {};
  const isPending = alloc.status === 'pending_rager';

  return (
    <div className="bg-[#111111] border border-[#DC143C]/20 p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium text-[#F5F5F0]">{sessionType(alloc)}</p>
          {enquiry.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {enquiry.categories.map(cat => (
                <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-[#DC143C]/10 border border-[#DC143C]/20 text-[#DC143C]">
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 border text-yellow-400 bg-yellow-500/10 border-yellow-500/20 whitespace-nowrap">
          Action required
        </span>
      </div>

      {enquiry.challenge && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">What they need</p>
          <p className="text-sm text-[#A1A1AA] leading-relaxed">{enquiry.challenge}</p>
        </div>
      )}

      {alloc.payout_to_rager > 0 && (
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Your advisory fee</p>
          <p className="text-sm text-[#F5F5F0]">{fmt(alloc.payout_to_rager)}</p>
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 mt-4">
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
    </div>
  );
}

function PendingActionsSection({ pending, onRespond, responding }) {
  if (pending.length === 0) {
    return (
      <section className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">Pending Actions</p>
        <div className="bg-[#0A0A0A] border border-white/8 p-8 text-center">
          <p className="text-sm text-[#52525B]">No pending actions. You're all caught up.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-10">
      <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">
        Pending Actions <span className="text-[#DC143C]">({pending.length})</span>
      </p>
      <div className="space-y-3">
        {pending.map(alloc => (
          <PendingCard
            key={alloc.id}
            alloc={alloc}
            onRespond={onRespond}
            responding={responding}
          />
        ))}
      </div>
    </section>
  );
}

// ── Activity History ──────────────────────────────────────────────────────────

function ActivitySection({ history }) {
  if (history.length === 0) {
    return (
      <section>
        <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">Activity</p>
        <div className="bg-[#0A0A0A] border border-white/8 p-8 text-center">
          <p className="text-sm text-[#52525B]">
            You have no activity yet. You'll see requests here when they come in.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-4">Recent Activity</p>
      <div className="divide-y divide-white/5 border border-white/8 bg-[#111111]">
        {history.map(alloc => {
          const status = STATUS_LABELS[alloc.status] || { label: alloc.status, color: 'text-[#71717A]' };
          const isConfirmed = alloc.status === 'confirmed';

          return (
            <div key={alloc.id} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm text-[#F5F5F0] truncate">{sessionType(alloc)}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {alloc.enquiry?.created_at && (
                    <p className="text-[11px] text-[#52525B]">{fmtDate(alloc.enquiry.created_at)}</p>
                  )}
                  {alloc.payout_to_rager > 0 && (
                    <p className="text-[11px] text-[#71717A]">{fmt(alloc.payout_to_rager)}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isConfirmed && (
                  <span title="Contact details sent via email">
                    <Mail className="w-3.5 h-3.5 text-[#52525B]" />
                  </span>
                )}
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border ${status.color}`}>
                  {status.label}
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
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

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

  const pending = allocations.filter(a => a.status === 'pending_rager');
  const history = allocations
    .filter(a => a.status !== 'pending_rager')
    .slice(0, 10);

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      {/* Page title */}
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
      <PendingActionsSection
        pending={pending}
        onRespond={handleRespond}
        responding={responding}
      />
      <ActivitySection history={history} />
    </main>
  );
}
