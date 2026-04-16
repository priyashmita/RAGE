import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Check } from 'lucide-react';

const BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const FIELDS = [
  {
    key:         'one_liner',
    label:       'One-liner',
    description: 'Describe what you do in one sentence.',
    placeholder: 'We help small businesses access working capital in 48 hours.',
    required:    true,
    rows:        2,
  },
  {
    key:         'current_focus',
    label:       'Current focus',
    description: 'What are you working on right now? What keeps you up at night?',
    placeholder: 'Series A raise, hiring VP Sales, expanding to tier-2 cities.',
    required:    true,
    rows:        3,
  },
  {
    key:         'bring_to_table',
    label:       'What you bring to the table',
    description: 'What knowledge, network, or experience can you offer others in the room?',
    placeholder: 'Distribution network across 200+ cities, fintech regulatory expertise.',
    required:    true,
    rows:        3,
  },
  {
    key:         'looking_for',
    label:       'What you\'re looking for',
    description: 'What would make this evening valuable for you? Be specific.',
    placeholder: 'Introductions to Series A-ready investors. Advice on building a sales team.',
    required:    true,
    rows:        3,
  },
  {
    key:         'open_question',
    label:       'Open question (for our team only)',
    description: 'Anything you\'d like us to know privately — a question, a challenge, or something you\'d like us to keep in mind for the evening. This is not shared with other guests.',
    placeholder: 'Optional…',
    required:    false,
    rows:        3,
  },
];

export default function PrereadFormPage() {
  const { token } = useParams();
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    one_liner: '', current_focus: '', bring_to_table: '', looking_for: '', open_question: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${BASE}/api/public/preread/${token}`);
        setMeta(res.data);
        if (res.data.existing) {
          const ex = res.data.existing;
          setForm({
            one_liner:      ex.one_liner      || '',
            current_focus:  ex.current_focus  || '',
            bring_to_table: ex.bring_to_table || '',
            looking_for:    ex.looking_for    || '',
            open_question:  ex.open_question  || '',
          });
        }
      } catch (err) {
        const status = err?.response?.status;
        if (status === 404) setError('invalid');
        else if (status === 403) setError('not_attending');
        else setError('error');
      } finally { setLoading(false); }
    }
    load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    const missing = FIELDS.filter(f => f.required && !form[f.key]?.trim());
    if (missing.length) {
      alert(`Please complete: ${missing.map(f => f.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      await axios.post(`${BASE}/api/public/preread/${token}`, form);
      setDone(true);
    } catch (err) {
      alert(err?.response?.data?.detail || 'Submission failed. Please try again.');
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
        <p className="text-sm text-[#888]">This link is no longer valid.</p>
      </div>
    </Shell>
  );

  if (error === 'not_attending') return (
    <Shell>
      <div className="text-center py-16">
        <p className="text-sm text-[#888]">The pre-read form is only available to confirmed attendees.</p>
        <p className="text-xs text-[#aaa] mt-2">Please RSVP first, then return to this link.</p>
      </div>
    </Shell>
  );

  if (error) return (
    <Shell>
      <div className="text-center py-16">
        <p className="text-sm text-[#888]">Something went wrong. Please try again.</p>
      </div>
    </Shell>
  );

  if (done) return (
    <Shell>
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-6 flex items-center justify-center border border-[#1c2b1c] bg-[#1c2b1c]/20">
          <Check className="w-6 h-6 text-[#2d5a2d]" />
        </div>
        <h2 className="text-lg font-light text-[#1a1a1a] mb-2">Pre-read submitted</h2>
        <p className="text-sm text-[#666]">See you at the table.</p>
      </div>
    </Shell>
  );

  if (!meta) return null;

  const { event, invite, submitted } = meta;

  return (
    <Shell>
      <p className="text-[10px] uppercase tracking-[0.15em] text-[#8a8a8a] mb-1">Private Table · Pre-read</p>
      <h1 className="text-xl font-light text-[#1a1a1a] mb-1">{event.title}</h1>
      {event.theme && <p className="text-xs text-[#999] italic mb-6">"{event.theme}"</p>}

      <div className="border-t border-[#e8e4dc] pt-5 mb-8">
        <p className="text-sm text-[#444] mb-1">Hi {invite.name},</p>
        <p className="text-sm text-[#666] leading-relaxed">
          Your responses help us curate conversations and introductions on the evening.
          They'll be shared with other confirmed guests before the dinner — except your open question,
          which stays with our team.
        </p>
        {submitted && (
          <p className="text-xs text-[#888] mt-3 border-l-2 border-[#e8e4dc] pl-3">
            You've already submitted. You can update your answers below.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-xs uppercase tracking-[0.12em] text-[#8a8a8a] mb-1">
              {f.label}
              {f.required && <span className="ml-1 text-red-400">*</span>}
            </label>
            <p className="text-xs text-[#aaa] mb-2 leading-relaxed">{f.description}</p>
            <textarea
              value={form[f.key]}
              onChange={e => setForm(fm => ({ ...fm, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              rows={f.rows}
              className="w-full border border-[#e8e4dc] px-3 py-2.5 text-sm text-[#1a1a1a] outline-none focus:border-[#999] bg-transparent resize-none leading-relaxed"
            />
          </div>
        ))}

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-[#1c2b1c] text-white text-sm py-3.5 hover:bg-[#243524] transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitted ? 'Update Pre-read' : 'Submit Pre-read'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ fontFamily: 'Georgia, serif' }} className="min-h-screen bg-[#f9f7f2] px-4 py-12">
      <div className="max-w-lg mx-auto">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a8a8a] mb-10">R.A.G.E.</p>
        {children}
        <p className="text-[11px] text-[#bbb] mt-12 text-center">Radical Alliance for Gender Equity</p>
      </div>
    </div>
  );
}
