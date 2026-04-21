import { useEffect, useState } from 'react';
import { Outlet, useNavigate, NavLink, Link } from 'react-router-dom';
import axios from 'axios';
import { Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { getRagerToken, ragerAuthHeader, clearRagerToken } from '@/lib/ragerAuth';

const LOGO_URL = '/logo.png';
const BACKEND = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const navLinkClass = ({ isActive }) =>
  `text-xs uppercase tracking-wider transition-colors ${
    isActive ? 'text-[#F5F5F0]' : 'text-[#71717A] hover:text-[#A1A1AA]'
  }`;

export default function RagerLayout() {
  const navigate = useNavigate();
  const [rager, setRager] = useState(null);

  useEffect(() => {
    const token = getRagerToken();
    if (!token) {
      navigate('/rager-login', { replace: true });
      return;
    }

    axios
      .get(`${BACKEND}/api/rager/me`, { headers: ragerAuthHeader() })
      .then(res => setRager(res.data))
      .catch(err => {
        if (err.response?.status === 401) {
          clearRagerToken();
          navigate('/rager-login', { replace: true });
        } else {
          toast.error('Failed to load account');
        }
      });
  }, []); // eslint-disable-line

  const logout = () => {
    clearRagerToken();
    navigate('/rager-login', { replace: true });
  };

  if (!rager) {
    return (
      <div className="dark-ui min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#A1A1AA]" />
      </div>
    );
  }

  return (
    <div className="dark-ui min-h-screen bg-[#050505]">
      {/* Header / Nav */}
      <header className="border-b border-white/8 bg-[#0A0A0A] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/rager/dashboard">
            <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto" />
          </Link>

          <div className="flex items-center gap-6">
            <nav className="hidden sm:flex items-center gap-6">
              <NavLink to="/rager/dashboard" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/rager/profile" className={navLinkClass}>
                Profile
              </NavLink>
              <NavLink to="/rager/change-password" className={navLinkClass}>
                Password
              </NavLink>
            </nav>

            <span className="text-sm text-[#52525B] hidden sm:block">
              {rager.name}
            </span>

            <button
              onClick={logout}
              className="text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden border-t border-white/5 px-6 py-2 flex gap-5">
          <NavLink to="/rager/dashboard" className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/rager/profile" className={navLinkClass}>
            Profile
          </NavLink>
          <NavLink to="/rager/change-password" className={navLinkClass}>
            Password
          </NavLink>
        </div>
      </header>

      <Outlet context={{ rager, setRager }} />
    </div>
  );
}
