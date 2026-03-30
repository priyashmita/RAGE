import { useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, X, ArrowRight } from 'lucide-react';

const LOGO_URL = '/logo.png';

const navLinks = [
  { to: '/about', label: 'About' },
  { to: '/private-table', label: 'Private Table' },
  { to: '/closed-table', label: 'Closed Table' },
  { to: '/sunday-table', label: 'Sunday Table' },
  { to: '/network', label: 'Network' },
  { to: '/insights', label: 'Insights' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white" data-testid="public-layout">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/90 backdrop-blur-md border-b border-gray-100" data-testid="public-header">
        <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          <Link to="/" className="shrink-0" data-testid="public-logo-link">
            <img src={LOGO_URL} alt="RAGE" className="h-12 w-auto" />
          </Link>
          <nav className="hidden lg:flex items-center gap-1" data-testid="public-nav">
            {navLinks.map(l => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) => `px-3 py-2 text-[13px] font-medium tracking-wide transition-colors duration-200 ${isActive ? 'text-[#DC143C]' : 'text-gray-500 hover:text-gray-900'}`}
                data-testid={`public-nav-${l.label.toLowerCase().replace(/\s/g, '-')}`}
              >{l.label}</NavLink>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold tracking-wider uppercase text-white bg-[#DC143C] hover:bg-[#B01030] transition-colors" data-testid="go-to-dashboard-btn">Dashboard <ArrowRight className="w-3.5 h-3.5" /></Link>
            ) : (
              <Link to="/member-login" className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold tracking-wider uppercase text-gray-900 border border-gray-300 hover:border-gray-500 hover:bg-gray-50 transition-all" data-testid="member-login-btn">Member Login</Link>
            )}
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden text-gray-700 p-2" data-testid="mobile-menu-toggle">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-1 shadow-lg" data-testid="mobile-menu">
            {navLinks.map(l => (
              <NavLink key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `block px-3 py-2.5 text-sm ${isActive ? 'text-[#DC143C]' : 'text-gray-600'}`}
              >{l.label}</NavLink>
            ))}
            <div className="pt-3 border-t border-gray-100">
              <Link to={user ? '/dashboard' : '/member-login'} onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 text-sm text-[#DC143C] font-semibold">{user ? 'Dashboard' : 'Member Login'}</Link>
            </div>
          </div>
        )}
      </header>
      <main className="pt-16"><Outlet /></main>
      <footer className="border-t border-gray-100 bg-gray-50" data-testid="public-footer">
        <div className="max-w-[1400px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-2">
              <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto mb-4" />
              <p className="text-sm text-gray-500 max-w-sm leading-relaxed">The Radical Alliance for Gender Equity. Addressing gender inequity through outcomes, not advocacy.</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">Formats</p>
              <div className="space-y-2">
                {[['Private Table','/private-table'],['Closed Table','/closed-table'],['Sunday Table','/sunday-table']].map(([l,t]) => (
                  <Link key={t} to={t} className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">Company</p>
              <div className="space-y-2">
                <Link to="/about" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">About</Link>
                <Link to="/network" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Network</Link>
                <Link to="/contact" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Contact</Link>
                <Link to="/privacy" className="block text-sm text-gray-500 hover:text-gray-900 transition-colors">Privacy</Link>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-400">&copy; {new Date().getFullYear()} R.A.G.E. — Radical Alliance for Gender Equity. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
