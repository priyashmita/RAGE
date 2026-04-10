import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'https://rage-production.up.railway.app';

// Public axios — no auth interceptor, no 401 redirect
const pub = axios.create({ baseURL: `${BACKEND}/api` });

const LOGO_URL = '/logo.png';

export default function FounderSelectPage() {
  const { token } = useParams();
  const [status, setStatus]       = useState('loading'); // loading | invalid | active | already_responded | submitting | success
  const [data, setData]           = useState(null);
  const [selected, setSelected]   = useState([]);
  const [expanded, setExpanded]   = useState({});
  const [error, setError]         = useState('');
  const [successType, setSuccessType] = useState('');

  useEffect(() => {
    pub.get(`/public/shortlist/${token}`)
      .then(res => {
        setData(res.data);
        if (res.data.already_responded) {
          setSuccessType(res.data.response_type);
          setStatus('already_responded');
        } else {
          setStatus('active');
        }
      })
      .catch(err => {
        if (err.response?.status === 410) {
          setStatus('invalid');
          setError('This shortlist is no longer active.');
        } else {
          setStatus('invalid');
          setError('This link is invalid or has expired.');
        }
      });
  }, [token]);

  function toggleAdvisor(allocId) {
    setSelected(prev =>
      prev.includes(allocId)
        ? prev.filter(id => id !== allocId)
        : [...prev, allocId]
    );
  }

  function toggleExpanded(allocId) {
    setExpanded(prev => ({ ...prev, [allocId]: !prev[allocId] }));
  }

  async function submitResponse(responseType) {
    setStatus('submitting');
    setError('');
    try {
      await pub.post(`/public/shortlist/${token}/respond`, {
        response_type:      responseType,
        selected_alloc_ids: responseType === 'selection' ? selected : [],
      });
      setSuccessType(responseType);
      setStatus('success');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
      setStatus('active');
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#dc143c] animate-spin" />
      </div>
    );
  }

  // ── Invalid / expired ────────────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <PageShell>
        <div className="text-center py-16 px-6">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#dc143c] mb-6">R.A.G.E.</p>
          <h1 className="text-2xl font-light text-white mb-4">Link not found</h1>
          <p className="text-[#71717a] text-sm leading-relaxed max-w-sm mx-auto">
            {error || 'This link is invalid or has expired. Please contact RAGE if you need assistance.'}
          </p>
        </div>
      </PageShell>
    );
  }

  // ── Already responded / Success ──────────────────────────────────────────────
  if (status === 'already_responded' || status === 'success') {
    const messages = {
      selection:   { title: 'Selection received', body: "We've noted your selection. We'll confirm availability and be in touch with next steps." },
      more_options: { title: 'Noted', body: "We'll source additional advisors for your request. Expect to hear from us soon." },
      reject_all:  { title: 'Noted', body: "Thank you for letting us know. We'll review and suggest alternative advisors." },
    };
    const msg = messages[successType] || { title: 'Response recorded', body: "We've received your response. The RAGE team will be in touch." };
    return (
      <PageShell>
        <div className="text-center py-16 px-6">
          <CheckCircle2 className="h-12 w-12 text-[#dc143c] mx-auto mb-6" />
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#dc143c] mb-4">R.A.G.E.</p>
          <h1 className="text-2xl font-light text-white mb-4">{msg.title}</h1>
          <p className="text-[#71717a] text-sm leading-relaxed max-w-sm mx-auto">{msg.body}</p>
        </div>
      </PageShell>
    );
  }

  const { session, advisors } = data;

  // ── Session details ───────────────────────────────────────────────────────────
  const sessionFields = [
    ['Format',         session.format_type ? session.format_type.charAt(0).toUpperCase() + session.format_type.slice(1) : ''],
    ['Duration',       session.duration_text],
    ['Venue',          session.venue],
    ['Proposed Dates', session.optional_dates],
    ['Investment',     session.budget_text],
  ].filter(([, v]) => v);

  return (
    <PageShell>
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="border-b border-[#dc143c] pb-6 mb-8">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[#dc143c] mb-3">R.A.G.E.</p>
          <h1 className="text-[22px] font-light text-white">Your Advisor Shortlist</h1>
        </div>

        {/* Intro */}
        <p className="text-[#a1a1aa] text-sm leading-relaxed mb-6">
          {session.intro_message || `We've shortlisted ${advisors.length} advisor${advisors.length !== 1 ? 's' : ''} for your request. Select the one${advisors.length !== 1 ? '(s)' : ''} you'd like to proceed with.`}
        </p>

        {/* Session details */}
        {sessionFields.length > 0 && (
          <div className="border-l-4 border-[#dc143c] pl-5 py-4 bg-[#0f0f0f] mb-8">
            <p className="text-[10px] tracking-[0.15em] uppercase text-[#71717a] mb-3">Session Details</p>
            <table className="w-full text-sm">
              <tbody>
                {sessionFields.map(([k, v]) => (
                  <tr key={k}>
                    <td className="text-[#71717a] text-[11px] uppercase tracking-wide pr-6 py-1.5 align-top whitespace-nowrap">{k}</td>
                    <td className="text-[#e5e5e5] py-1.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Instruction */}
        <p className="text-[10px] tracking-[0.15em] uppercase text-[#71717a] mb-4">
          Select Advisor{advisors.length !== 1 ? 's' : ''} — choose one or more
        </p>

        {/* Advisor cards */}
        <div className="space-y-3 mb-8">
          {advisors.map(advisor => {
            const isSelected = selected.includes(advisor.alloc_id);
            const isExpanded = expanded[advisor.alloc_id];
            return (
              <div
                key={advisor.alloc_id}
                onClick={() => toggleAdvisor(advisor.alloc_id)}
                className={`border cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? 'border-[#dc143c] bg-[#1a0508]'
                    : 'border-[#2a2a2a] bg-[#0f0f0f] hover:border-[#444]'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-base">{advisor.name}</p>
                      {(advisor.title || advisor.company) && (
                        <p className="text-[#dc143c] text-[11px] uppercase tracking-wide mt-0.5">
                          {advisor.title}{advisor.company ? ` · ${advisor.company}` : ''}
                        </p>
                      )}
                      {advisor.categories?.length > 0 && (
                        <p className="text-[#71717a] text-[11px] mt-2">{advisor.categories.join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 mt-1">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 border flex items-center justify-center transition-colors ${
                        isSelected ? 'border-[#dc143c] bg-[#dc143c]' : 'border-[#444]'
                      }`}>
                        {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      {/* Expand toggle */}
                      {advisor.bio && (
                        <button
                          onClick={e => { e.stopPropagation(); toggleExpanded(advisor.alloc_id); }}
                          className="text-[#71717a] hover:text-white transition-colors"
                          aria-label="Toggle bio"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bio (expandable) */}
                  {advisor.bio && isExpanded && (
                    <p className="text-[#a1a1aa] text-sm leading-relaxed mt-4 border-t border-[#1a1a1a] pt-4">
                      {advisor.bio}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Primary CTA */}
        <button
          disabled={selected.length === 0 || status === 'submitting'}
          onClick={() => submitResponse('selection')}
          className="w-full bg-[#dc143c] text-white py-4 text-[11px] tracking-[0.15em] uppercase font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#b01030] transition-colors mb-3"
        >
          {status === 'submitting'
            ? 'Submitting...'
            : selected.length > 0
              ? `Confirm Selection (${selected.length})`
              : 'Select at least one advisor'
          }
        </button>

        {/* Secondary options */}
        <button
          disabled={status === 'submitting'}
          onClick={() => submitResponse('more_options')}
          className="w-full border border-[#3a3a3a] text-[#a1a1aa] py-3 text-[11px] tracking-[0.12em] uppercase hover:border-[#666] hover:text-white transition-colors mb-3"
        >
          Request more advisors
        </button>

        <div className="text-center">
          <button
            disabled={status === 'submitting'}
            onClick={() => submitResponse('reject_all')}
            className="text-[#71717a] text-xs underline hover:text-[#a1a1aa] transition-colors"
          >
            None of these — not the right fit
          </button>
        </div>

        <p className="text-[#52525b] text-xs leading-relaxed mt-8 text-center">
          Questions? Reply to the email from RAGE and we'll be in touch.
        </p>
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <img src={LOGO_URL} alt="RAGE" className="h-8" />
      </div>
      {children}
    </div>
  );
}
