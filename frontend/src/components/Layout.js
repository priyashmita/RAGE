import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { LayoutDashboard, Calendar, Shield, User, LogOut, ChevronDown } from 'lucide-react';

const LOGO_URL = '/logo.png';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['founder', 'admin'] },
  { to: '/events', label: 'Private Tables', icon: Calendar, roles: ['founder', 'admin'] },
  { to: '/admin', label: 'Admin', icon: Shield, roles: ['admin'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(user?.role === 'admin' ? '/admin-login' : '/rager-login');
  };

  const filtered = navItems.filter(item => item.roles.includes(user?.role));

  return (
    <div className="dark-ui min-h-screen bg-[#050505]" data-testid="app-layout">
      {/* Header */}
      <header className="rage-glass fixed top-0 left-0 right-0 z-50 h-16" data-testid="app-header">
        <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <NavLink to="/dashboard" className="flex items-center gap-3 shrink-0" data-testid="logo-link">
            <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto invert" />
          </NavLink>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1" data-testid="main-nav">
            {filtered.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors duration-200 border-b-2 ${
                    isActive ? 'text-[#DC143C] border-[#DC143C]' : 'text-[#A1A1AA] border-transparent hover:text-[#F5F5F0]'
                  }`
                }
                data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-[#F5F5F0] transition-colors outline-none" data-testid="user-menu-trigger">
              <div className="w-8 h-8 bg-[#1A1A1A] border border-white/10 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span className="hidden md:block max-w-[120px] truncate">{user?.name}</span>
              <ChevronDown className="w-3 h-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#111111] border-white/10 rounded-none min-w-[180px]">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-[#F5F5F0]">{user?.name}</p>
                <p className="text-xs text-[#71717A]">{user?.email}</p>
                <span className="inline-block mt-1 rage-badge text-[#DC143C]">{user?.role}</span>
              </div>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={handleLogout} className="text-[#A1A1AA] hover:text-[#F5F5F0] focus:text-[#F5F5F0] focus:bg-white/5 rounded-none cursor-pointer" data-testid="logout-btn">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <main className="pt-16 min-h-screen">
        <div className="max-w-[1400px] mx-auto px-6 py-8 rage-page-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
