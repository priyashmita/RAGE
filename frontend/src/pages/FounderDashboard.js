import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, ArrowRight, CheckCircle, Clock, XCircle, Mail } from 'lucide-react';

const STATUS_CONFIG = {
  Received:          { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',  icon: Clock },
  'Under Review':    { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',        icon: Clock },
  'Finding Advisors':{ color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: Clock },
  'Advisors Ready':  { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',  icon: Mail },
  Confirmed:         { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  'No Match Found':  { color: 'bg-red-500/10 text-red-400 border-red-500/20',           icon: XCircle },
  Closed:            { color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',         icon: XCircle },
};

const NEXT_STEP = {
  Received:          'Our team is reviewing your request.',
  'Under Review':    'We are curating the right advisors for your challenge.',
  'Finding Advisors':'We have reached out to potential advisors and are awaiting their responses.',
  'Advisors Ready':  'Check your email — advisors are ready. Click the button in the email to confirm your choice.',
  Confirmed:         'Your session is confirmed. Your advisor will be in touch shortly.',
  'No Match Found':  'We were unable to find the right match at this time. We will reach out if a suitable advisor becomes available.',
  Closed:            'This request has been closed.',
};

export default function FounderDashboard() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/founders/enquiries')
      .then(r => setEnquiries(r.data || []))
      .catch(() => toast.error('Failed to load your requests'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Dashboard</p>
          <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">
            {user?.name || 'Your Requests'}
          </h1>
          <p className="text-sm text-[#52525B] mt-1">{user?.email}</p>
        </div>
        <Link
          to="/closed-table/request"
          className="flex items-center gap-2 text-xs uppercase tracking-wider px-5 py-2.5 bg-[#DC143C] hover:bg-[#B01030] text-white transition-colors"
        >
          New Request <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Enquiry list */}
      {enquiries.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center">
          <p className="text-[#52525B] text-sm mb-4">No requests yet.</p>
          <Link
            to="/closed-table/request"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-[#DC143C] hover:underline"
          >
            Submit your first request <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {enquiries.map(enq => {
            const founderStatus = enq.founder_status || 'Received';
            const cfg = STATUS_CONFIG[founderStatus] || STATUS_CONFIG['Received'];
            const StatusIcon = cfg.icon;
            const confirmedAdvisor = enq.advisors?.find(a => a.status === 'confirmed');

            return (
              <div key={enq.id} className="bg-[#111111] border border-white/8 p-6">
                {/* Row 1: title + status */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#F5F5F0] mb-1">
                      {enq.problem_statement || enq.challenge || enq.message || 'Request'}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {enq.company && <span className="text-xs text-[#71717A]">{enq.company}</span>}
                      {(enq.format || enq.interest) && (
                        <span className="text-[10px] text-[#52525B] uppercase tracking-wider">
                          {(enq.format || enq.interest).replace(/_/g, ' ')}
                        </span>
                      )}
                      {enq.decision_type && (
                        <span className="text-[10px] text-[#52525B] uppercase tracking-wider">
                          {enq.decision_type.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 border rounded-sm ${cfg.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {founderStatus}
                    </span>
                  </div>
                </div>

                {/* Next step callout */}
                <div className="bg-[#0A0A0A] border border-white/5 px-4 py-3 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-[#52525B] mb-1">What happens next</p>
                  <p className="text-xs text-[#A1A1AA] leading-relaxed">{NEXT_STEP[founderStatus]}</p>
                </div>

                {/* Confirmed advisor card */}
                {confirmedAdvisor && (
                  <div className="border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2">Your Confirmed Advisor</p>
                    <p className="text-sm font-medium text-[#F5F5F0]">{confirmedAdvisor.name}</p>
                    {(confirmedAdvisor.title || confirmedAdvisor.company) && (
                      <p className="text-xs text-[#DC143C] mt-0.5">
                        {confirmedAdvisor.title}{confirmedAdvisor.company ? ` · ${confirmedAdvisor.company}` : ''}
                      </p>
                    )}
                    {confirmedAdvisor.email && (
                      <p className="text-xs text-[#A1A1AA] mt-1">{confirmedAdvisor.email}</p>
                    )}
                    {confirmedAdvisor.categories?.length > 0 && (
                      <p className="text-[10px] text-[#52525B] mt-2">{confirmedAdvisor.categories.join(' · ')}</p>
                    )}
                  </div>
                )}

                {/* Footer: date */}
                <p className="text-[10px] text-[#52525B] font-mono mt-4">
                  Submitted {enq.created_at?.slice(0, 10) || '—'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
