import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';

const LOGO_URL = '/logo.png';
const HERO_IMG = 'https://images.unsplash.com/photo-1670383050616-682df7d57b22?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxleGVjdXRpdmUlMjBtZWV0aW5nJTIwZGFyayUyMG1vb2R5fGVufDB8fHx8MTc3NDQ0MTIzNHww&ixlib=rb-4.1.0&q=85';

export default function LoginPage() {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'member' });
  const { login, signup, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true });
  }, [authLoading, user, navigate]);

  if (authLoading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
    </div>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await signup(form);
      }
      toast.success(mode === 'login' ? 'Welcome back' : 'Account created');
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      const network = !err.response ? `Network error — check API URL (${process.env.REACT_APP_BACKEND_URL || 'NOT SET'})` : null;
      toast.error(detail || network || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex" data-testid="login-page">
      {/* Left: Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1670383050616-682df7d57b22?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwxfHxleGVjdXRpdmUlMjBtZWV0aW5nJTIwZGFyayUyMG1vb2R5fGVufDB8fHx8MTc3NDQ0MTIzNHww&ixlib=rb-4.1.0&q=85')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10">
          <Link to="/">
            <img src={LOGO_URL} alt="RAGE" className="h-10 w-auto invert" data-testid="login-logo" />
          </Link>
        </div>
        <div className="relative z-10">
          <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-[#F5F5F0] leading-tight">
            Rager<br />Access
          </h1>
          <p className="mt-6 text-lg text-[#A1A1AA] max-w-md leading-relaxed">
            This login is for RAGE network members, founders, and experts. If you're not yet part of the network, reach out through our public pages.
          </p>
        </div>
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#DC143C] transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to rageforgood.com
          </Link>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile header */}
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#DC143C] transition-colors mb-6">
              <ArrowLeft className="w-4 h-4" /> Back to RAGE
            </Link>
            <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto invert" />
          </div>

          <div className="mb-10">
            <p className="rage-overline mb-3">{mode === 'login' ? 'Member Login' : 'Create Account'}</p>
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-[#F5F5F0]">
              {mode === 'login' ? 'Sign in to your account' : 'Join the RAGE Network'}
            </h2>
            <p className="text-sm text-[#71717A] mt-2">
              {mode === 'login' ? 'For RAGE members, founders, and experts.' : 'Create your RAGE member or expert account.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="auth-form">
            {mode === 'signup' && (
              <>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Full Name</Label>
                  <Input
                    data-testid="signup-name-input"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
                    placeholder="Your full name"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Role</Label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="bg-[#0A0A0A] border border-white/15 text-[#F5F5F0] h-12 rounded-none w-full px-3 focus:ring-1 focus:ring-[#DC143C] focus:border-[#DC143C] outline-none appearance-none cursor-pointer"
                    data-testid="signup-role-select"
                  >
                    <option value="member" className="bg-[#111] text-[#F5F5F0]">Member</option>
                    <option value="founder" className="bg-[#111] text-[#F5F5F0]">Founder</option>
                    <option value="expert" className="bg-[#111] text-[#F5F5F0]">Expert / Advisor</option>
                    <option value="sponsor" className="bg-[#111] text-[#F5F5F0]">Sponsor</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Email</Label>
              <Input
                data-testid="email-input"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">Password</Label>
              <Input
                data-testid="password-input"
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="bg-[#0A0A0A] border-white/15 text-[#F5F5F0] h-12 rounded-none focus:ring-[#DC143C] focus:border-[#DC143C]"
                placeholder="Min 6 characters"
                required
                minLength={6}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow text-sm tracking-wider uppercase font-semibold"
              data-testid="auth-submit-btn"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                <>{mode === 'login' ? 'Sign In' : 'Create Account'} <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-sm text-[#A1A1AA] hover:text-[#DC143C] transition-colors"
              data-testid="toggle-auth-mode"
            >
              {mode === 'login' ? "Need an account? Sign up" : 'Already a member? Sign in'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
