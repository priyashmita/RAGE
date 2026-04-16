import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, CalendarDays, MapPin, Users } from 'lucide-react';

const BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

function fmt(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

const TYPE_LABEL = { founder: 'Founder', leader: 'Leader', guest: 'Guest' };
const TYPE_COLOR = {
  founder: { bg: '#fff8f8', border: '#f5c0c0', label: '#c0392b' },
  leader:  { bg: '#f8f9ff', border: '#c0c8f5', label: '#2c3e9e' },
  guest:   { bg: '#fafafa', border: '#e8e4dc', label: '#888' },
};

export default function PrereadViewPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${BASE}/api/public/preread-view/${token}`);
        setData(res.data);
      } catch (err) {
        const status = err?.response?.status;
        setError(status === 404 ? 'invalid' : status === 403 ? 'not_attending' : 'error');
      } finally { setLoading(false); }
    }
    load();
  }, [token]);

  if (loading) return (
    <Shell><div className="flex justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-[#8a8a8a]" /></div></Shell>
  );

  if (error === 'invalid') return (
    <Shell><div className="text-center py-16"><p className="text-sm text-[#888]">This link is no longer valid.</p></div></Shell>
  );

  if (error === 'not_attending') return (
    <Shell><div className="text-center py-16"><p className="text-sm text-[#888]">The pre-read package is only available to confirmed guests.</p></div></Shell>
  );

  if (error) return (
    <Shell><div className="text-center py-16"><p className="text-sm text-[#888]">Something went wrong. Please try again.</p></div></Shell>
  );

  if (!data) return null;

  const { event, prereads, pending_prereads, total_confirmed } = data;
  const prc = event.pre_read_content || {};

  return (
    <Shell>
      {/* Event header */}
      <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a8a8a] mb-1">Private Table · Pre-read Package</p>
      <h1 className="text-2xl font-light text-[#1a1a1a] mb-2">{event.title}</h1>
      {event.theme && <p className="text-sm text-[#888] italic mb-5">"{event.theme}"</p>}

      <div className="space-y-2 mb-6">
        {event.date && (
          <div className="flex items-center gap-2.5 text-sm text-[#444]">
            <CalendarDays className="w-4 h-4 text-[#999]" />
            {fmt(event.date)}
          </div>
        )}
        {event.location && (
          <div className="flex items-center gap-2.5 text-sm text-[#444]">
            <MapPin className="w-4 h-4 text-[#999]" />
            {event.location}
          </div>
        )}
        {event.dress_code && (
          <div className="flex items-center gap-2.5 text-sm text-[#666]">
            <span className="text-[10px] uppercase tracking-[0.1em] text-[#999] w-[72px] shrink-0">Dress</span>
            {event.dress_code}
          </div>
        )}
      </div>

      {/* Custom pre-read content from admin */}
      {prc.body && (
        <div className="border border-[#e8e4dc] p-5 mb-8">
          {prc.title && <p className="text-xs uppercase tracking-[0.12em] text-[#888] mb-2">{prc.title}</p>}
          <p className="text-sm text-[#555] leading-relaxed whitespace-pre-line">{prc.body}</p>
        </div>
      )}

      <hr className="border-[#e8e4dc] mb-8" />

      {/* Guest count summary */}
      <div className="flex items-center gap-2 mb-6">
        <Users className="w-4 h-4 text-[#999]" />
        <p className="text-sm text-[#666]">
          {total_confirmed} confirmed guest{total_confirmed !== 1 ? 's' : ''} ·{' '}
          {prereads.length} pre-read{prereads.length !== 1 ? 's' : ''} submitted
        </p>
      </div>

      {/* Pre-reads */}
      {prereads.length === 0 ? (
        <div className="text-center py-10 border border-[#e8e4dc]">
          <p className="text-sm text-[#888]">No pre-reads submitted yet.</p>
          <p className="text-xs text-[#aaa] mt-1">Check back closer to the event date.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {prereads.map((pr, idx) => {
            const colors = TYPE_COLOR[pr.guest_type] || TYPE_COLOR.guest;
            return (
              <div
                key={pr.id || idx}
                style={{ background: colors.bg, borderColor: colors.border }}
                className="border p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base font-medium text-[#1a1a1a]">{pr.name}</h3>
                    <p className="text-xs text-[#888] mt-0.5">
                      {[pr.role, pr.company].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span
                    style={{ color: colors.label, borderColor: colors.border }}
                    className="text-[10px] uppercase tracking-[0.1em] border px-2 py-0.5 shrink-0"
                  >
                    {TYPE_LABEL[pr.guest_type] || 'Guest'}
                  </span>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'In one sentence',    value: pr.one_liner,      strong: true },
                    { label: 'Currently focused on', value: pr.current_focus },
                    { label: 'Bringing to table',  value: pr.bring_to_table },
                    { label: 'Looking for',        value: pr.looking_for },
                  ].filter(f => f.value).map(f => (
                    <div key={f.label}>
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[#999] mb-0.5">{f.label}</p>
                      <p className={`text-sm leading-relaxed ${f.strong ? 'text-[#1a1a1a] font-medium' : 'text-[#555]'}`}>
                        {f.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending pre-reads */}
      {pending_prereads?.length > 0 && (
        <div className="mt-8">
          <p className="text-xs uppercase tracking-[0.1em] text-[#aaa] mb-3">
            Pre-reads pending ({pending_prereads.length})
          </p>
          <div className="space-y-1.5">
            {pending_prereads.map((g, idx) => (
              <div key={g.invite_id || idx} className="flex items-center gap-3 py-2.5 border-b border-[#e8e4dc]">
                <div className="flex-1">
                  <span className="text-sm text-[#888]">{g.name}</span>
                  {g.company && <span className="text-xs text-[#bbb] ml-2">{g.company}</span>}
                </div>
                <span className="text-[10px] text-[#bbb] uppercase tracking-wide">Pending</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#bbb] mt-12 text-center">
        Radical Alliance for Gender Equity · rageforchange.com
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ fontFamily: 'Georgia, serif' }} className="min-h-screen bg-[#f9f7f2] px-4 py-12">
      <div className="max-w-xl mx-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a] mb-10">R.A.G.E.</p>
        {children}
      </div>
    </div>
  );
}
