import { useState } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, CheckCircle } from 'lucide-react';

export function EnquiryDialog({ trigger, interest = 'general', title = 'Get in Touch' }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/enquiries', { ...form, interest });
      setSent(true);
      toast.success('Enquiry submitted');
    } catch {
      toast.error('Failed to submit. Please email contact@rageforgood.com');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => { setSent(false); setForm({ name: '', email: '', company: '', message: '' }); };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="bg-[#111111] border-white/10 rounded-none max-w-md" data-testid="enquiry-dialog">
        <DialogHeader>
          <DialogTitle className="text-[#F5F5F0] text-xl">{title}</DialogTitle>
        </DialogHeader>
        {sent ? (
          <div className="py-8 text-center" data-testid="enquiry-success">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg text-[#F5F5F0] mb-2" style={{ fontFamily: 'Manrope' }}>Thank you</p>
            <p className="text-sm text-[#A1A1AA]">We will be in touch within 48 hours.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2" data-testid="enquiry-form">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Name</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" required data-testid="enquiry-name" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" required data-testid="enquiry-email" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Company / Organisation</Label>
              <Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1" data-testid="enquiry-company" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A]">Message</Label>
              <Textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] rounded-none mt-1 min-h-[80px]" placeholder="Tell us what you're looking for" data-testid="enquiry-message" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow text-sm tracking-wider uppercase font-semibold h-11" data-testid="enquiry-submit">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit Enquiry'}
            </Button>
            <p className="text-[10px] text-[#71717A] text-center">Or email us directly at contact@rageforgood.com</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
