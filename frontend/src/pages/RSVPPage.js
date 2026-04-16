import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CalendarDays, MapPin, Check, X } from 'lucide-react';

const BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

function fmt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function fmtTime(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return null; }
}

export default function RSVPPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [dietary, setDietary] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${BASE}/api/public/rsvp/${token}`);
        setData(res.data);
      } catch (err) {
        const status = err?.response?.status;
        setError(status === 404 ? 'invalid' : status === 410 ? 'gone' : 'error');
      } finally { setLoading(false); }
    }
    load();
  }, [token]);

  async function submit(attending) {
    setSubmitting(true);
    try {
      const res = await axios.post(`${BASE}/api/public/rsvp/${token}`, {
        attending,
        dietary,
      });
      setDone({ attending, message: res.data.message });
    } catch (err) {
      if (err?.response?.status === 410) setError('gone');
      else setError('submit_error');
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <Shell>
      <div className="flex justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-[#8a8a8a]" />
      </div>
    </Shell>
  );

  if (error === 'invalid') return (
    <Shell>
      <div className="text-center py-16">
        <p className="text-[#888] text-sm">This link is no longer valid.</p>
        <p className="text-[#aaa] text-xs mt-2">Please contact the RAGE team if you believe this is an error.</p>
      </div>
    </Shell>
  );

  if (error === 'gone') return (
    <Shell>
      <div className="text-center py-16">
        <p className="text-[#888] text-sm">This event is no longer active.</p>
        <p className="text-[#aaa] text-xs mt-2">Please contact the RAGE team for more information.</p>
      </div>
    </Shell>
  );

  if (error === 'error' || error === 'submit_error') return (
    <Shell>
      <div className="text-center py-16">
        <p className="text-[#888] text-sm">Something went wrong. Please try again or contact the RAGE team.</p>
      </div>
    </Shell>
  );

  if (!data) return null;

  const { event, invite } = data;
  const alreadyRsvpd = invite.rsvp_status !== 'pending';

  if (done) return (
    <Shell>
      <div className="text-center py-16">
        <div className={`w-12 h-12 mx-auto mb-6 flex items-center justify-center border ${
          done.attending ? 'border-[#1c2b1c] bg-[#1c2b1c]/20' : 'border-[#e8e4dc]'
        }`}>
          {done.attending ? <Check className="w-6 h-6 text-[#2d5a2d]" /> : <X className="w-6 h-6 text-[#888]" />}
        </div>
        <h2 className="text-lg font-light text-[#1a1a1a] mb-3">{done.message}</h2>
        {done.attending && (
          <p className="text-sm text-[#666] leading-relaxed">
            You'll receive a pre-read form shortly.<br />
            Please complete it before the event.
          </p>
        )}
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.15em] text-[#8a8a8a] mb-4">Private Table</p>
        <h1 className="text-2xl font-light text-[#1a1a1a] mb-2">{event.title}</h1>
        {event.theme && (
          <p className="text-sm text-[#888] italic mb-6">"{event.theme}"</p>
        )}
        <div className="space-y-2.5 mb-6">
          {event.date && (
            <div className="flex items-center gap-2.5 text-sm text-[#444]">
              <CalendarDays className="w-4 h-4 text-[#999]" />
              <span>{fmt(event.date)}{fmtTime(event.date) ? `, ${fmtTime(event.date)}` : ''}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2.5 text-sm text-[#444]">
              <MapPin className="w-4 h-4 text-[#999]" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
        {event.description && (
          <p className="text-sm text-[#666] leading-relaxed border-t border-[#e8e4dc] pt-5">
            {event.description}
          </p>
        )}
      </div>

      {alreadyRsvpd ? (
        <div className="border border-[#e8e4dc] p-5 text-center">
          <p className="text-sm text-[#666]">
            You've already responded:{' '}
            <strong className="text-[#1a1a1a]">
              {invite.rsvp_status === 'yes' ? "You're attending" : "You're not attending"}
            </strong>
          </p>
          <p className="text-xs text-[#aaa] mt-2">Contact us if you need to change your response.</p>
        </div>
      ) : (
        <div>
          <hr className="border-[#e8e4dc] mb-6" />
          <p className="text-sm text-[#444] mb-1">Hi {invite.name},</p>
          <p className="text-sm text-[#666] mb-6">Will you join us?</p>

          <div className="mb-5">
            <label className="block text-xs uppercase tracking-[0.1em] text-[#8a8a8a] mb-1.5">
              Dietary requirements (optional)
            </label>
            <input
              type="text"
              value={dietary}
              onChange={e => setDietary(e.target.value)}
              placeholder="e.g. vegetarian, no nuts…"
              className="w-full border border-[#e8e4dc] px-3 py-2 text-sm text-[#1a1a1a] outline-none focus:border-[#999] bg-transparent"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => submit(true)}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1c2b1c] text-white text-sm py-3 hover:bg-[#243524] transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Yes, I'll be there
            </button>
            <button
              onClick={() => submit(false)}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 border border-[#e8e4dc] text-[#888] text-sm py-3 hover:border-[#ccc] hover:text-[#444] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Unable to attend
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ fontFamily: 'Georgia, serif' }} className="min-h-screen bg-[#f9f7f2] flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a] mb-10">R.A.G.E.</p>
        {children}
        <p className="text-[11px] text-[#bbb] mt-12 text-center">
          Radical Alliance for Gender Equity
        </p>
      </div>
    </div>
  );
}
