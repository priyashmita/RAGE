import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
    </div>
  );

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(form.email, form.password, remember);
      if (res.user.role !== 'admin') {
        toast.error('Admin access only');
        return;
      }
      navigate('/admin');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const network = !err.response
        ? `Network error (${process.env.REACT_APP_BACKEND_URL || 'https://rage-production.up.railway.app'})`
        : null;
      toast.error(detail || network || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-[#71717A] mb-2">RAGE Internal</p>
          <h1 className="text-2xl font-light text-[#F5F5F0] tracking-tight">Admin Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-11 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Password</Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-11 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
              required
              autoComplete="current-password"
            />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#DC143C]"
            />
            <span className="text-xs text-[#71717A]">Remember me</span>
          </label>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-sm tracking-wider uppercase font-semibold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
}
