import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, LogOut, CheckCircle, XCircle } from 'lucide-react';

const LOGO_URL = '/logo.png';
const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const STATUS_LABELS = {
  pending_rager:   { label: 'Awaiting your response', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  rager_accepted:  { label: 'You accepted',           color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  rager_declined:  { label: 'You declined',           color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  pending_founder: { label: 'Founder reviewing',      color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  confirmed:       { label: 'Confirmed',              color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  founder_declined:{ label: 'Not selected',           color: 'text-[#71717A] bg-white/5 border-white/10' },
};

function authHeader() {
  const token = localStorage.getItem('rage_rager_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function RagerDashboard() {
  const navigate = useNavigate();
  const [rager, setRager] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('rage_rager_token');
    if (!token) { navigate('/rager-login', { replace: true }); return; }

    const headers = authHeader();
    Promise.all([
      axios.get(`${BACKEND}/api/rager/me`, { headers }),
      axios.get(`${BACKEND}/api/rager/allocations`, { headers }),
    ]).then(([meRes, allocRes]) => {
      setRager(meRes.data);
      setAllocations(allocRes.data);
    }).catch(err => {
      if (err.response?.status === 401) {
        localStorage.removeItem('rage_rager_token');
        navigate('/rager-login', { replace: true });
      } else {
        toast.error('Failed to load dashboard');
      }
    }).finally(() => setLoading(false));
  }, []); // eslint-disable-line

  const handleRespond = async (allocationId, response) => {
    setResponding(allocationId + response);
    try {
      await axios.post(
        `${BACKEND}/api/rager/allocations/${allocationId}/respond`,
        { response },
        { headers: authHeader() }
      );
      setAllocations(prev => prev.map(a =>
        a.id === allocationId
          ? { ...a, status: response === 'accept' ? 'rager_accepted' : 'rager_declined' }
          : a
      ));
      toast.success(response === 'accept' ? "You've accepted — RAGE will be in touch." : "Noted, you've declined this request.");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to respond');
    } finally {
      setResponding(null);
    }
  };

  const logout = () => {
    localStorage.removeItem('rage_rager_token');
    navigate('/rager-login', { replace: true });
  };

  if (loading) return (
    <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
    </div>
  );

  const pending = allocations.filter(a => a.status === 'pending_rager');
  const others  = allocations.filter(a => a.status !== 'pending_rager');

  return (
    <div className="dark-ui min-h-screen bg-[#050505]">
      {/* Header */}
      <header className="border-b border-white/8 bg-[#0A0A0A]">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto" />
          <div className="flex items-center gap-4">
            {rager && <span className="text-sm text-[#A1A1AA]">{rager.name}</span>}
            <button onClick={logout} className="text-[#52525B] hover:text-[#A1A1AA] transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Rager Portal</p>
          <h1 className="text-3xl font-light text-[#F5F5F0]">My Requests</h1>
          {rager && <p className="text-sm text-[#52525B] mt-1">{rager.title}{rager.company ? ` · ${rager.company}` : ''}</p>}
        </div>

        {allocations.length === 0 && (
          <div className="border border-white/8 bg-[#0A0A0A] p-12 text-center">
            <p className="text-[#52525B] text-sm">No advisory requests yet. We'll notify you when a match comes through.</p>
          </div>
        )}

        {/* Pending responses first */}
        {pending.length > 0 && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-3">Action required</p>
            <div className="space-y-3">
              {pending.map(alloc => (
                <AllocationCard key={alloc.id} alloc={alloc} onRespond={handleRespond} responding={responding} />
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div>
            {pending.length > 0 && <p className="text-xs uppercase tracking-[0.2em] text-[#52525B] mb-3">History</p>}
            <div className="space-y-3">
              {others.map(alloc => (
                <AllocationCard key={alloc.id} alloc={alloc} onRespond={handleRespond} responding={responding} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function AllocationCard({ alloc, onRespond, responding }) {
  const statusInfo = STATUS_LABELS[alloc.status] || { label: alloc.status, color: 'text-[#71717A]' };
  const enquiry = alloc.enquiry || {};
  const isPending = alloc.status === 'pending_rager';
  const isConfirmed = alloc.status === 'confirmed';

  return (
    <div className={`bg-[#111111] border p-5 ${isPending ? 'border-[#DC143C]/20' : 'border-white/8'}`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-medium text-[#F5F5F0]">
            {(enquiry.format || 'Advisory Session').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </p>
          {enquiry.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {enquiry.categories.map(cat => (
                <span key={cat} className="text-[10px] px-1.5 py-0.5 bg-[#DC143C]/10 border border-[#DC143C]/20 text-[#DC143C]">{cat}</span>
              ))}
            </div>
          )}
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border whitespace-nowrap ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {enquiry.challenge && (
        <p className="text-sm text-[#A1A1AA] leading-relaxed mb-3">
          <span className="text-xs uppercase tracking-wider text-[#52525B] block mb-1">What they need</span>
          {enquiry.challenge}
        </p>
      )}

      {alloc.payout_to_rager > 0 && (
        <p className="text-sm text-[#F5F5F0] mb-3">
          <span className="text-xs uppercase tracking-wider text-[#52525B] block mb-1">Your advisory fee</span>
          ₹{alloc.payout_to_rager.toLocaleString()}
        </p>
      )}

      {/* Full contact details only shown on confirmed */}
      {isConfirmed && (
        <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-xs uppercase tracking-wider text-emerald-400 mb-1">Confirmed — contact details shared via email</p>
          <p className="text-xs text-[#71717A]">Check your email for the founder's contact details and session logistics.</p>
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
