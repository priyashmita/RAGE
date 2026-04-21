import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ragerAuthHeader } from '@/lib/ragerAuth';

const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function RagerChangePasswordPage() {
  const [form, setForm] = useState({
    current_password: '',
    new_password:     '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${BACKEND}/api/rager/change-password`,
        form,
        { headers: ragerAuthHeader() }
      );
      toast.success('Password updated successfully');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-1">Rager Portal</p>
        <h1 className="text-2xl font-light text-[#F5F5F0]">Change Password</h1>
        <p className="text-sm text-[#52525B] mt-1">
          Use a strong password with at least 8 characters, one uppercase letter, and one number.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-[#111111] border border-white/8 p-6 max-w-sm"
      >
        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">
            Current Password
          </Label>
          <Input
            type="password"
            value={form.current_password}
            onChange={set('current_password')}
            required
            autoComplete="current-password"
            className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-10 rounded-none text-sm"
          />
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">
            New Password
          </Label>
          <Input
            type="password"
            value={form.new_password}
            onChange={set('new_password')}
            required
            autoComplete="new-password"
            className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-10 rounded-none text-sm"
          />
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-wider text-[#71717A] mb-1 block">
            Confirm New Password
          </Label>
          <Input
            type="password"
            value={form.confirm_password}
            onChange={set('confirm_password')}
            required
            autoComplete="new-password"
            className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0] h-10 rounded-none text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full h-10 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-xs uppercase tracking-wider"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update Password'}
        </Button>
      </form>

      <p className="text-xs text-[#3F3F46] mt-6">
        Forgot your current password?{' '}
        <a href="/forgot-password" className="text-[#71717A] hover:text-[#DC143C] transition-colors">
          Reset via email
        </a>
      </p>
    </main>
  );
}
