import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';

const LOGO_URL = '/logo.png';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // intentionally swallowed — always show neutral success
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/">
          <img src={LOGO_URL} alt="RAGE" className="h-9 w-auto mb-10 invert" />
        </Link>

        {sent ? (
          <div>
            <div className="w-10 h-10 border border-emerald-500/30 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#71717A] mb-3">Check Your Email</p>
            <h1 className="text-2xl font-light text-[#F5F5F0] mb-4">Reset link sent</h1>
            <p className="text-sm text-[#71717A] leading-relaxed mb-8">
              If this email exists, we've sent a reset link. Check your inbox — it may take a minute.
              If you don't see it, check your spam folder.
            </p>
            <Link
              to="/rager-login"
              className="flex items-center gap-2 text-xs text-[#71717A] hover:text-[#DC143C] transition-colors uppercase tracking-wider"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Sign In
            </Link>
          </div>
        ) : (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-3">Password Reset</p>
            <h1 className="text-2xl font-light text-[#F5F5F0] mb-2">Forgot your password?</h1>
            <p className="text-sm text-[#71717A] mb-8">
              Enter your email and we'll send a reset link if an account exists.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-2 block">
                  Email Address
                </Label>
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

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none text-sm tracking-wider uppercase font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
              </Button>
            </form>

            <div className="mt-6">
              <Link
                to="/rager-login"
                className="flex items-center gap-2 text-xs text-[#71717A] hover:text-[#DC143C] transition-colors uppercase tracking-wider"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
