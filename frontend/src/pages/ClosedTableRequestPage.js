import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Loader2, CheckCircle, Lock } from 'lucide-react';

const DECISION_TYPES = [
  { value: 'fundraising', label: 'Fundraising / Capital Raise' },
  { value: 'hiring', label: 'Hiring / Team Decisions' },
  { value: 'gtm', label: 'Go-to-Market / Growth' },
  { value: 'strategic_pivot', label: 'Strategic Pivot' },
  { value: 'partnership', label: 'Partnerships / M&A' },
  { value: 'financial_structuring', label: 'Financial Structuring' },
  { value: 'policy', label: 'Policy / Regulatory' },
  { value: 'product', label: 'Product / Technology' },
  { value: 'other', label: 'Other' },
];

const STAGES = [
  { value: 'idea', label: 'Idea Stage' },
  { value: 'early', label: 'Early (Pre-revenue / Seed)' },
  { value: 'growth', label: 'Growth (Revenue / Series A–B)' },
  { value: 'scaling', label: 'Scaling (Series C+)' },
  { value: 'institution', label: 'Institution / Fund / Government' },
];

const URGENCIES = [
  { value: 'this_week', label: 'This week', sub: 'Critical decision pending' },
  { value: 'this_month', label: 'This month', sub: 'Active but not urgent' },
  { value: 'exploring', label: 'Exploring', sub: 'Building understanding' },
];

const HELP_OPTIONS = [
  { value: 'capital_access', label: 'Capital access & investor conversations' },
  { value: 'decision_support', label: 'High-stakes decision support' },
  { value: 'market_introductions', label: 'Market introductions & distribution' },
  { value: 'regulatory_guidance', label: 'Regulatory & policy guidance' },
  { value: 'talent', label: 'Talent & team building' },
  { value: 'operational_scaling', label: 'Operational scaling' },
];

const FORMATS = [
  { value: '1on1', label: '1:1 Advisory', sub: 'One expert, deep dive' },
  { value: 'small_group', label: 'Curated Small Group', sub: '4–5 experts, 90 min session' },
  { value: 'not_sure', label: 'Not sure yet', sub: 'Let the team recommend' },
];

export default function ClosedTableRequestPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    problem_statement: '', decision_type: '', business_stage: '', urgency: 'this_month',
    name: '', email: '', company: '', role: '',
    help_needed: [], preferred_format: 'not_sure', notes: '',
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleHelp = (val) => set('help_needed', form.help_needed.includes(val) ? form.help_needed.filter(v => v !== val) : [...form.help_needed, val]);

  const step1Valid = form.problem_statement.length >= 10 && form.decision_type && form.urgency;
  const step2Valid = form.name && form.email;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/closed-table-requests', form);
      setSubmitted(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Submission failed. Please try again or email contact@rageforgood.com');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-6" data-testid="ct-request-success">
        <div className="max-w-lg text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-6" />
          <h1 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4" style={{ fontFamily: 'Playfair Display' }}>
            Request received.
          </h1>
          <p className="text-base text-gray-600 leading-relaxed mb-3">
            Our team will review your challenge and match you with the right experts within 48 hours.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            You will hear from us at <span className="text-gray-900 font-mono">{form.email}</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to={`/login?next=/dashboard`}>
              <Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none h-10 px-6 text-xs uppercase tracking-wider" data-testid="track-request-btn">
                Track My Request <ArrowRight className="w-3.5 h-3.5 ml-2" />
              </Button>
            </Link>
            <Link to="/closed-table">
              <Button variant="outline" className="border-white/20 text-gray-900 hover:bg-white/5 rounded-none h-10 px-6 text-xs uppercase tracking-wider" data-testid="back-to-closed-table">
                <ArrowLeft className="w-3.5 h-3.5 mr-2" /> Back to Closed Table
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="ct-request-page">
      {/* Header strip */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <Link to="/closed-table" className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-600 transition-colors mb-2">
              <ArrowLeft className="w-3 h-3" /> Closed Table
            </Link>
            <h1 className="text-xl font-normal text-gray-900" style={{ fontFamily: 'Playfair Display' }}>Request a Closed Table</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Lock className="w-3 h-3" /> Confidential
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-3 flex gap-0">
          {[{ n: 1, label: 'Your Challenge' }, { n: 2, label: 'About You' }].map(s => (
            <button key={s.n} onClick={() => s.n < step && setStep(s.n)}
              className={`flex-1 py-2 text-xs uppercase tracking-[0.15em] font-semibold text-center border-b-2 transition-colors ${step === s.n ? 'text-[#DC143C] border-[#DC143C]' : step > s.n ? 'text-gray-600 border-[#A1A1AA]/30 cursor-pointer' : 'text-gray-500 border-transparent'}`}
              data-testid={`step-indicator-${s.n}`}
            >
              <span className="font-mono mr-1.5">{String(s.n).padStart(2, '0')}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Form content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        {step === 1 && (
          <div className="space-y-10 rage-page-in" data-testid="ct-step-1">
            {/* Problem statement */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Your Challenge *</Label>
              <p className="text-sm text-gray-600 mb-3">Describe the decision or problem in one or two sentences.</p>
              <Textarea value={form.problem_statement} onChange={e => set('problem_statement', e.target.value)}
                className="bg-white border-gray-300 text-gray-900 rounded-none min-h-[100px] text-base leading-relaxed"
                placeholder="e.g. We're deciding between two term sheets with different governance terms and need experienced perspectives on long-term implications."
                data-testid="ct-problem-input"
              />
              <p className="text-[10px] text-gray-500 mt-1 font-mono">{form.problem_statement.length} characters</p>
            </div>

            {/* Decision type */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Decision Type *</Label>
              <p className="text-sm text-gray-600 mb-3">What domain does this fall under?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DECISION_TYPES.map(dt => (
                  <button key={dt.value} type="button" onClick={() => set('decision_type', dt.value)}
                    className={`px-4 py-3 text-left text-sm border transition-colors ${form.decision_type === dt.value ? 'bg-[#DC143C]/10 border-[#DC143C] text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
                    data-testid={`dt-${dt.value}`}
                  >{dt.label}</button>
                ))}
              </div>
            </div>

            {/* Urgency */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Urgency *</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {URGENCIES.map(u => (
                  <button key={u.value} type="button" onClick={() => set('urgency', u.value)}
                    className={`px-4 py-3 text-left border transition-colors ${form.urgency === u.value ? 'bg-[#DC143C]/10 border-[#DC143C]' : 'bg-white border-gray-200 hover:border-gray-400'}`}
                    data-testid={`urg-${u.value}`}
                  >
                    <p className={`text-sm font-medium ${form.urgency === u.value ? 'text-gray-900' : 'text-gray-600'}`}>{u.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{u.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Business stage */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Business Stage</Label>
              <div className="flex flex-wrap gap-2">
                {STAGES.map(s => (
                  <button key={s.value} type="button" onClick={() => set('business_stage', s.value)}
                    className={`px-4 py-2 text-xs border transition-colors ${form.business_stage === s.value ? 'bg-[#DC143C]/10 border-[#DC143C] text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
                    data-testid={`stage-${s.value}`}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            {/* Next */}
            <div className="pt-4 border-t border-gray-200 flex justify-end">
              <Button disabled={!step1Valid} onClick={() => setStep(2)}
                className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-11 px-8 text-sm tracking-wider uppercase font-semibold disabled:opacity-30"
                data-testid="ct-next-btn"
              >
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 rage-page-in" data-testid="ct-step-2">
            {/* Summary of step 1 */}
            <div className="bg-white border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500 font-semibold">Your Challenge</p>
                <button onClick={() => setStep(1)} className="text-[10px] text-[#DC143C] hover:text-gray-900 uppercase tracking-wider transition-colors" data-testid="ct-edit-challenge">Edit</button>
              </div>
              <p className="text-sm text-gray-900 leading-relaxed">{form.problem_statement}</p>
              <div className="flex gap-3 mt-3">
                <span className="rage-badge text-[#DC143C] border-[#DC143C]/30">{DECISION_TYPES.find(d => d.value === form.decision_type)?.label}</span>
                <span className="rage-badge text-gray-600">{form.urgency.replace('_', ' ')}</span>
                {form.business_stage && <span className="rage-badge text-gray-500">{form.business_stage}</span>}
              </div>
            </div>

            {/* Contact fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Full Name *</Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 rounded-none h-11" placeholder="Your name"
                  data-testid="ct-name-input" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Email *</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 rounded-none h-11" placeholder="you@company.com"
                  data-testid="ct-email-input" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Company / Organisation</Label>
                <Input value={form.company} onChange={e => set('company', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 rounded-none h-11" placeholder="Your company"
                  data-testid="ct-company-input" />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Role / Designation</Label>
                <Input value={form.role} onChange={e => set('role', e.target.value)}
                  className="bg-white border-gray-300 text-gray-900 rounded-none h-11" placeholder="e.g. Founder & CEO"
                  data-testid="ct-role-input" />
              </div>
            </div>

            {/* Help needed */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">What kind of help do you need?</Label>
              <p className="text-sm text-gray-600 mb-3">Select one or more.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {HELP_OPTIONS.map(h => (
                  <button key={h.value} type="button" onClick={() => toggleHelp(h.value)}
                    className={`px-4 py-3 text-left text-sm border transition-colors ${form.help_needed.includes(h.value) ? 'bg-[#DC143C]/10 border-[#DC143C] text-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`}
                    data-testid={`help-${h.value}`}
                  >{h.label}</button>
                ))}
              </div>
            </div>

            {/* Preferred format */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Preferred Format</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {FORMATS.map(f => (
                  <button key={f.value} type="button" onClick={() => set('preferred_format', f.value)}
                    className={`px-4 py-3 text-left border transition-colors ${form.preferred_format === f.value ? 'bg-[#DC143C]/10 border-[#DC143C]' : 'bg-white border-gray-200 hover:border-gray-400'}`}
                    data-testid={`fmt-${f.value}`}
                  >
                    <p className={`text-sm font-medium ${form.preferred_format === f.value ? 'text-gray-900' : 'text-gray-600'}`}>{f.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{f.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs uppercase tracking-[0.15em] text-gray-500 mb-1 block">Anything else?</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="bg-white border-gray-300 text-gray-900 rounded-none min-h-[70px]"
                placeholder="Any additional context, constraints, or preferences (optional)"
                data-testid="ct-notes-input"
              />
            </div>

            {/* Submit */}
            <div className="pt-4 border-t border-gray-200 flex items-center justify-between">
              <button onClick={() => setStep(1)} className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors" data-testid="ct-back-btn">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <Button disabled={!step2Valid || loading} onClick={handleSubmit}
                className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-11 px-8 text-sm tracking-wider uppercase font-semibold disabled:opacity-30"
                data-testid="ct-submit-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Submit Request <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            </div>

            <p className="text-[10px] text-gray-500 text-center">All information is treated as confidential. Mutual NDAs are signed before any session.</p>
          </div>
        )}
      </div>
    </div>
  );
}
