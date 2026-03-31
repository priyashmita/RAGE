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

export function EnquiryDialog({ trigger, interest = 'general', title = 'Get in Touch' }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', company: '', message: '',
    format: interest === 'general' ? '' : interest,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    setForm({ name: '', email: '', company: '', message: '', format: interest === 'general' ? '' : interest });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-[#111111] border-white/10 rounded-none max-w-md" data-testid="enquiry-dialog">
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
