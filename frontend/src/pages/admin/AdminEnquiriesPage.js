import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';

const STATUS_COLORS = {
  new: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  matching: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending_rager: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  pending_founder: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  declined: 'bg-red-500/10 text-red-400 border-red-500/20',
  closed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const navigate = useNavigate();

  const load = () => {
    api.get('/admin/enquiries').then(r => setEnquiries(r.data || [])).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" /></div>;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Enquiries</h1>
        <p className="text-sm text-[#52525B] mt-1">{enquiries.length} total submissions</p>
      </div>

      {enquiries.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
          <p className="text-[#52525B] text-sm">No enquiries yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...enquiries].reverse().map(enq => (
            <div key={enq.id} className="bg-[#111111] border border-white/8">
              <button type="button" onClick={() => setExpanded(expanded === enq.id ? null : enq.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-medium text-[#F5F5F0] truncate">{enq.name}</span>
                    {enq.company && <span className="text-xs text-[#71717A]">{enq.company}</span>}
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 border rounded-sm ${STATUS_COLORS[enq.status] || STATUS_COLORS.new}`}>
                      {(enq.status || 'new').replace(/_/g, ' ')}
                    </span>
                    {enq.format && <span className="text-[10px] text-[#52525B] uppercase tracking-wider">{enq.format.replace(/_/g, ' ')}</span>}
                  </div>
                  <p className="text-xs text-[#71717A] truncate">{enq.challenge || enq.message || enq.problem_statement || '—'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-[#52525B] font-mono">{enq.created_at?.slice(0, 10)}</span>
                  {expanded === enq.id ? <ChevronDown className="w-3.5 h-3.5 text-[#52525B]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#52525B]" />}
                </div>
              </button>

              {expanded === enq.id && (
                <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      ['Email', enq.email],
                      ['Format', enq.format || enq.interest || '—'],
                      ['Budget', enq.budget || '—'],
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
                      <p className="text-xs text-[#A1A1AA] leading-relaxed">{enq.challenge || enq.problem_statement || enq.message}</p>
                    </div>
                  )}
                  {enq.help_needed?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">Help needed</p>
                      <p className="text-xs text-[#A1A1AA]">{enq.help_needed.join(', ')}</p>
                    </div>
                  )}
                  <div className="pt-2 flex gap-2">
                    <button type="button" onClick={() => navigate(`/admin/matching?enquiry=${enq.id}`)}
                      className="text-xs uppercase tracking-wider px-4 py-2 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors">
                      Match Ragers
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
