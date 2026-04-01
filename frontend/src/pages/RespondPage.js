import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

const LOGO_URL = '/logo.png';

export default function RespondPage() {
  const { anon_token } = useParams();
  const [status, setStatus] = useState('loading'); // loading | invalid | already_responded | valid | submitting | done
  const [data, setData] = useState(null);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    api.get(`/respond/${anon_token}`)
      .then(res => {
        if (!res.data.valid) {
          setStatus('invalid');
        } else if (res.data.already_responded) {
          setData(res.data);
          setStatus('already_responded');
        } else {
          setData(res.data);
          setStatus('valid');
        }
      })
      .catch(() => setStatus('invalid'));
  }, [anon_token]);

  const handleRespond = async (response) => {
    setStatus('submitting');
    try {
      const res = await api.post(`/respond/${anon_token}`, { response });
      setSubmitted({ status: res.data.status, message: res.data.message });
      setStatus('done');
    } catch (err) {
      if (err.response?.status === 410) {
        setStatus('invalid');
      } else {
        setStatus('valid');
      }
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
      </div>
    );
  }

  // ── Expired / invalid ────────────────────────────────────────────────────────

  if (status === 'invalid') {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto mx-auto mb-10 invert" />
          <div className="w-10 h-10 border border-[#DC143C]/30 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-5 h-5 text-[#DC143C]" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Link Expired</p>
          <h1 className="text-2xl font-light text-[#F5F5F0] mb-4">
            This link is no longer valid
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed mb-8">
            Response links expire after 7 days. Contact the RAGE team if you're still interested in this session.
          </p>
          <a
            href="mailto:hello@rageforchange.com"
            className="inline-block text-xs uppercase tracking-wider text-[#A1A1AA] border border-white/10 px-6 py-3 hover:border-white/25 hover:text-[#F5F5F0] transition-colors"
          >
            Contact RAGE
          </a>
        </div>
      </div>
    );
  }

  // ── Already responded ────────────────────────────────────────────────────────

  if (status === 'already_responded') {
    const accepted = data?.status === 'accepted';
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto mx-auto mb-10 invert" />
          <div className={`w-10 h-10 border flex items-center justify-center mx-auto mb-6 ${accepted ? 'border-emerald-500/30' : 'border-white/10'}`}>
            {accepted
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : <X className="w-5 h-5 text-[#71717A]" />
            }
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#71717A] mb-3">Already Responded</p>
          <h1 className="text-2xl font-light text-[#F5F5F0] mb-4">
            {accepted ? 'You expressed interest' : 'You passed on this one'}
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed">
            {accepted
              ? "You've already confirmed interest. The RAGE team will be in touch."
              : "You've already declined this request. No further action needed."
            }
          </p>
        </div>
      </div>
    );
  }

  // ── Done — just submitted ─────────────────────────────────────────────────────

  if (status === 'done') {
    const accepted = submitted?.status === 'accepted';
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto mx-auto mb-10 invert" />
          <div className={`w-10 h-10 border flex items-center justify-center mx-auto mb-6 ${accepted ? 'border-emerald-500/30' : 'border-white/10'}`}>
            {accepted
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              : <X className="w-5 h-5 text-[#71717A]" />
            }
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Response Recorded</p>
          <h1 className="text-2xl font-light text-[#F5F5F0] mb-4">
            {accepted ? 'Thank you for your interest' : 'No problem — thank you'}
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed">
            {submitted?.message}
          </p>
        </div>
      </div>
    );
  }

  // ── Valid — show brief and action buttons ─────────────────────────────────────

  const { brief, challenge, sector, stage, geography, decision_type, fee } = data || {};

  const metaItems = [
    sector       && { label: 'Sector',    value: sector },
    stage        && { label: 'Stage',     value: stage },
    geography    && { label: 'Geography', value: geography },
    decision_type && { label: 'Type',     value: decision_type },
    fee          && { label: 'Session Fee', value: `₹${Number(fee).toLocaleString('en-IN')}` },
  ].filter(Boolean);

  return (
    <div className="dark-ui min-h-screen bg-[#050505] px-4 py-16">
      <div className="w-full max-w-lg mx-auto">
        <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto mb-12 invert" />

        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Closed Table Request</p>
        <h1 className="text-3xl font-light tracking-tight text-[#F5F5F0] mb-2">
          We have a founder who needs your expertise
        </h1>
        <p className="text-sm text-[#71717A] mb-10">
          Under Chatham House Rule — no founder details are shared at this stage.
        </p>

        {/* Brief */}
        {(brief || challenge) && (
          <div className="bg-[#0A0A0A] border border-white/5 p-6 mb-6">
            <p className="text-xs uppercase tracking-wider text-[#52525B] mb-3">Brief</p>
            <p className="text-[#A1A1AA] text-sm leading-relaxed">{brief || challenge}</p>
          </div>
        )}

        {/* Meta grid */}
        {metaItems.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-10">
            {metaItems.map(item => (
              <div key={item.label} className="bg-[#0A0A0A] border border-white/5 px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-[#52525B] mb-1">{item.label}</p>
                <p className="text-sm text-[#F5F5F0]">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <p className="text-xs text-[#52525B] uppercase tracking-wider mb-4">
            Are you available for this session?
          </p>
          <Button
            onClick={() => handleRespond('accept')}
            disabled={status === 'submitting'}
            className="w-full h-12 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-sm tracking-wider uppercase font-semibold flex items-center justify-center gap-2"
          >
            {status === 'submitting'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <><Check className="w-4 h-4" /> I'm Interested</>
            }
          </Button>
          <Button
            onClick={() => handleRespond('decline')}
            disabled={status === 'submitting'}
            variant="outline"
            className="w-full h-12 bg-transparent border-white/10 text-[#A1A1AA] hover:bg-white/5 hover:text-[#F5F5F0] hover:border-white/20 rounded-none text-sm tracking-wider uppercase font-semibold flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> Pass
          </Button>
        </div>

        <p className="text-xs text-[#3F3F46] text-center mt-10">
          Your identity remains confidential at this stage. RAGE coordinates all introductions.
        </p>
      </div>
    </div>
  );
}
