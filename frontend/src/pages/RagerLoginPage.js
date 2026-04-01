import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

const LOGO_URL = '/logo.png';
const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

export default function RagerLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  const existing = localStorage.getItem('rage_rager_token');
  if (existing) return <Navigate to="/rager-dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${BACKEND}/api/rager/login`, { email, password });
      if (remember) {
        localStorage.setItem('rage_rager_token', res.data.access_token);
      } else {
        sessionStorage.setItem('rage_rager_token', res.data.access_token);
        localStorage.removeItem('rage_rager_token');
      }
      navigate('/rager-dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark-ui min-h-screen bg-[#050505] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 bg-[#080808] border-r border-white/5">
        <Link to="/">
          <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto invert" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-4">Rager Login</p>
          <h1 className="text-5xl font-light tracking-tighter text-[#F5F5F0] leading-tight mb-6">
            Sign in to<br />your portal
          </h1>
          <p className="text-sm text-[#71717A] leading-relaxed max-w-xs">
            This portal is for approved RAGERS only. Access is by invitation — all accounts are created by the RAGE team.
          </p>
        </div>
        <p className="text-xs text-[#3F3F46]">rageforchange.com</p>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile header */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2 text-sm text-[#71717A] hover:text-[#DC143C] transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" /> Back
            </Link>
            <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto invert" />
          </div>

          <div className="mb-10">
            <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Rager Login</p>
            <h2 className="text-3xl font-light tracking-tight text-[#F5F5F0]">Sign in</h2>
            <p className="text-sm text-[#A1A1AA] mt-2">For approved RAGERS only.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#A1A1AA] mb-2 block">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#A1A1AA] mb-2 block">Password</Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
                placeholder="Your password"
              />
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between border-t border-white/5 pt-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-[#DC143C] border-white/20"
                />
                <span className="text-sm text-[#A1A1AA]">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-[#A1A1AA] hover:text-[#DC143C] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-sm tracking-wider uppercase font-semibold mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
            </Button>
          </form>

          <p className="text-xs text-[#52525B] text-center mt-8">
            Need access?{' '}
            <a href="mailto:hello@rageforchange.com" className="text-[#71717A] hover:text-[#DC143C] transition-colors">
              Contact the RAGE team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
