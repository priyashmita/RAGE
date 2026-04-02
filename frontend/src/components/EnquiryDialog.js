import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

const FORMAT_LABELS = {
  'closed-table':   'Closed Table — 1:1 advisory session',
  'private-table':  'Private Table — curated dinner',
  'sunday-table':   'Sunday Table — documentary feature',
  'general':        'General enquiry',
  'sponsor':        'Sponsorship / partnership',
  'rager':          'Join as a Rager (advisor)',
};

const FORMAT_OPTIONS = [
  { value: 'closed-table',  label: 'Closed Table — 1:1 advisory session' },
  { value: 'private-table', label: 'Private Table — curated dinner' },
  { value: 'sunday-table',  label: 'Sunday Table — documentary feature' },
  { value: 'sponsor',       label: 'Sponsorship / partnership' },
  { value: 'rager',         label: 'Join as a Rager (advisor)' },
  { value: 'general',       label: 'Other / general enquiry' },
];

// Per-category session fees (INR) — indicative pricing shown to founder
const CATEGORY_COSTS = {
  'Finance & Fundraising':   12000,
  'Legal & Compliance':      10000,
  'Marketing & Brand':        8000,
  'Operations & Scale':       8000,
  'Technology & Product':    10000,
  'Strategy & Growth':       12000,
  'People & Culture':         7500,
  'Sales & Distribution':     8000,
  'Media & Communications':   7500,
  'International Expansion': 15000,
};

const CATEGORIES = Object.keys(CATEGORY_COSTS);

// Only show category picker for advisory (closed-table) enquiries
const SHOW_CATEGORIES_FOR = ['closed-table', 'general'];

export function EnquiryDialog({ trigger, interest = 'general', title = 'Get in Touch' }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', company: '', message: '',
    format: interest === 'general' ? '' : interest,
    categories: [],
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleCategory = (cat) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter(c => c !== cat)
        : [...f.categories, cat],
    }));
  };

  const showCategories = SHOW_CATEGORIES_FOR.includes(form.format) || SHOW_CATEGORIES_FOR.includes(interest);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.format) { toast.error('Please select what you are enquiring about'); return; }
    setLoading(true);
    try {
      await api.post('/enquiries', {
        name: form.name,
        email: form.email,
        company: form.company,
        message: form.message,
        interest: form.format,
        format: form.format,
        challenge: form.message,
        categories: form.categories,
      });
      setSent(true);
    } catch {
      toast.error('Failed to submit. Please email contact@rageforgood.com');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSent(false);
    setForm({ name: '', email: '', company: '', message: '', format: interest === 'general' ? '' : interest, categories: [] });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-[#111111] border-white/10 rounded-none max-w-md max-h-[90vh] overflow-y-auto" data-testid="enquiry-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] text-xl font-light">{title}</DialogTitle>
          {interest !== 'general' && FORMAT_LABELS[interest] && (
            <p className="text-xs uppercase tracking-[0.15em] text-[#DC143C] mt-1">{FORMAT_LABELS[interest]}</p>
          )}
        </DialogHeader>

        {sent ? (
          <div className="py-8 text-center" data-testid="enquiry-success">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg text-[#F5F5F0] mb-2">Thank you</p>
            <p className="text-sm text-[#A1A1AA]">We will be in touch within 48 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2" data-testid="enquiry-form">

            {/* Format selector — only show when interest is general */}
            {interest === 'general' && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A]">What are you enquiring about? *</Label>
                <select
                  value={form.format}
                  onChange={e => set('format', e.target.value)}
                  required
                  className="w-full mt-1 bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] text-sm px-3 py-2 focus:outline-none focus:border-[#DC143C]/40 appearance-none"
                >
                  <option value="" disabled>Select one…</option>
                  {FORMAT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Category checkboxes — shown for advisory/general enquiries */}
            {showCategories && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A] block mb-2">What do you need help with?</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => {
                    const active = form.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className={`text-[11px] px-2.5 py-1 border transition-colors ${
                          active
                            ? 'bg-[#DC143C]/10 border-[#DC143C] text-[#DC143C]'
                            : 'bg-transparent border-white/10 text-[#71717A] hover:border-white/25 hover:text-[#A1A1AA]'
                        }`}
                      >
                        {cat}
                        {active && (
                          <span className="ml-1.5 text-[10px] text-[#DC143C]/70">
                            from ₹{(CATEGORY_COSTS[cat] / 1000).toFixed(0)}k
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {form.categories.length > 0 && (
                  <p className="text-[10px] text-[#52525B] mt-2">
                    Session fee from ₹{Math.min(...form.categories.map(c => CATEGORY_COSTS[c])).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Name *</Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" required data-testid="enquiry-name" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Email *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" required data-testid="enquiry-email" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Company / Organisation</Label>
              <Input value={form.company} onChange={e => set('company', e.target.value)} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="enquiry-company" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Tell us what you need</Label>
              <Textarea
                value={form.message}
                onChange={e => set('message', e.target.value)}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 min-h-[80px]"
                placeholder="Describe your challenge or what you're looking for"
                data-testid="enquiry-message"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow text-sm tracking-wider uppercase font-semibold h-11" data-testid="enquiry-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Enquiry'}
            </Button>
            <p className="text-[10px] text-[#71717A] text-center">Or email us at contact@rageforgood.com</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
