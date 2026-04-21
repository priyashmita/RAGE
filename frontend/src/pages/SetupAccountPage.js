import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { setRagerToken } from '@/lib/ragerAuth';

const LOGO_URL = '/logo.png';

function redirectByRole(role, navigate) {
  if (role === 'admin') navigate('/admin', { replace: true });
  else if (role === 'rager') navigate('/rager/dashboard', { replace: true });
  else navigate('/dashboard', { replace: true });
}

export default function SetupAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithData } = useAuth();
  const token = searchParams.get('token');

  const [status, setStatus] = useState('loading'); // loading | invalid | valid | submitting
  const [tokenData, setTokenData] = useState(null);
  const [form, setForm] = useState({ password: '', confirm_password: '' });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.get('/auth/validate-token', { params: { token, type: 'invite' } })
      .then(res => {
        if (res.data.valid) {
          setTokenData(res.data);
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      })
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
      const res = await api.post('/auth/setup-password', {
        token,
        password: form.password,
        confirm_password: form.confirm_password,
      });
      if (res.data.user.role === 'rager') {
        // Rager tokens must go to rage_rager_token, not the shared rage_token
        setRagerToken(res.data.token, true);
        navigate('/rager/dashboard', { replace: true });
      } else {
        loginWithData(res.data.token, res.data.user);
        redirectByRole(res.data.user.role, navigate);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Setup failed. Please try again or request a new invite link.');
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
            This setup link is no longer valid
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed mb-8">
            Invitation links expire after 48 hours. Contact the RAGE team to request a new one.
          </p>
          <a
            href="mailto:hello@rageforchange.com"
            className="inline-block text-xs uppercase tracking-wider text-[#A1A1AA] border border-white/10 px-6 py-3 hover:border-white/25 hover:text-[#F5F5F0] transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="dark-ui min-h-screen bg-[#050505] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 bg-[#080808] border-r border-white/5">
        <Link to="/">
          <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto invert" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-4">Welcome to RAGE</p>
          <h1 className="text-5xl font-light tracking-tighter text-[#F5F5F0] leading-tight mb-6">
            Set up<br />your account
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed max-w-xs">
            You've been invited to join the RAGE network. Create a password to activate your account.
          </p>
          {tokenData?.email && (
            <p className="text-xs text-[#52525B] mt-6">
              Invitation for{' '}
              <span className="text-[#A1A1AA]">{tokenData.email}</span>
            </p>
          )}
        </div>
        <p className="text-xs text-[#3F3F46]">rageforchange.com</p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2 text-sm text-[#71717A] hover:text-[#DC143C] transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto invert" />
          </div>

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Account Setup</p>
            <h2 className="text-3xl font-light tracking-tight text-[#F5F5F0]">Create your password</h2>
            {tokenData?.email && (
              <p className="text-sm text-[#71717A] mt-2">
                Setting up account for {tokenData.email}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">
                Password
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
              className="w-full h-12 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-sm tracking-wider uppercase font-semibold mt-2"
            >
              {status === 'submitting'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : 'Activate Account'
              }
            </Button>
          </form>

          <p className="text-xs text-[#3F3F46] text-center mt-8">
            Need help?{' '}
            <a
              href="mailto:hello@rageforchange.com"
              className="text-[#71717A] hover:text-[#DC143C] transition-colors"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
