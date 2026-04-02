import { useState } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function AdminSettingsPage() {
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', form);
      toast.success('Password changed');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Settings</h1>
      </div>

      <div className="max-w-sm">
        <div className="mb-2 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#52525B]" />
          <p className="text-sm text-[#A1A1AA] font-medium">Change Password</p>
        </div>
        <p className="text-xs text-[#52525B] mb-5">
          Minimum 8 characters, must include a letter and a number.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Current Password</Label>
            <Input
              type="password"
              value={form.current_password}
              onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
              required
              autoComplete="current-password"
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-10 rounded-none text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">New Password</Label>
            <Input
              type="password"
              value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
              required
              autoComplete="new-password"
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-10 rounded-none text-sm"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">Confirm New Password</Label>
            <Input
              type="password"
              value={form.confirm_password}
              onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
              required
              autoComplete="new-password"
              className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-10 rounded-none text-sm"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
