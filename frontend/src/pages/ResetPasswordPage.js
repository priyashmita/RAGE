import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';

const LOGO_URL = '/logo.png';

function redirectByRole(role, navigate) {
  if (role === 'admin') navigate('/admin', { replace: true });
  else if (role === 'rager') navigate('/rager-dashboard', { replace: true });
  else navigate('/dashboard', { replace: true });
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithData } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | invalid | valid | submitting
  const [form, setForm] = useState({ password: '', confirm_password: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.get('/auth/validate-token', { params: { token, type: 'reset' } })
      .then(res => setStatus(res.data.valid ? 'valid' : 'invalid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setStatus('submitting');
    try {
      const res = await api.post('/auth/reset-password', {
        token,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      loginWithData(res.data.token, res.data.user);
      redirectByRole(res.data.user.role, navigate);
    } catch (err) {
      setError(err.response?.data?.detail || 'Reset failed. Please request a new link.');
      setStatus('valid');
    }
  };

  if (status === 'loading') {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link to="/">
            <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto mx-auto mb-10 invert" />
          </Link>
          <div className="w-10 h-10 border border-[#DC143C]/30 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-5 h-5 text-[#DC143C]" />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Link Expired</p>
          <h1 className="text-2xl font-light text-[#F5F5F0] mb-4">
            This reset link is no longer valid
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed mb-8">
            Password reset links expire after 2 hours. Request a new one below.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block text-xs uppercase tracking-wider text-[#A1A1AA] border border-white/10 px-6 py-3 hover:border-white/25 hover:text-[#F5F5F0] transition-colors"
          >
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2 text-sm text-[#71717A] hover:text-[#DC143C] transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Password Reset</p>
          <h1 className="text-2xl font-light text-[#F5F5F0] mb-2">Set a new password</h1>
          <p className="text-sm text-[#71717A]">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">
              New Password
            </Label>
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              autoComplete="new-password"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
              placeholder="Min 8 characters, one uppercase, one number"
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">
              Confirm Password
            </Label>
            <Input
              type="password"
              value={form.confirm_password}
              onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
              required
              autoComplete="new-password"
              className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
              placeholder="Repeat password"
            />
          </div>

          {error && (
            <p className="text-sm text-[#DC143C] bg-[#DC143C]/5 border border-[#DC143C]/20 px-4 py-3">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={status === 'submitting'}
            className="w-full h-12 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-sm tracking-wider uppercase font-semibold"
          >
            {status === 'submitting'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : 'Reset Password'
            }
          </Button>
        </form>
      </div>
    </div>
  );
}
