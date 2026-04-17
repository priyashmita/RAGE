import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard, FileText, Users, Inbox, Zap, BarChart2, LogOut, ChevronDown, User, Menu, X, BookUser, Settings, MessageSquare, UtensilsCrossed, Mic
} from 'lucide-react';
import { useState } from 'react';

const LOGO_URL = '/logo.png';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/content', label: 'Content', icon: FileText },
  { to: '/admin/ragers', label: 'Ragers', icon: Users },
  { to: '/admin/contacts', label: 'Contacts', icon: BookUser },
  { to: '/admin/enquiries', label: 'Enquiries', icon: Inbox },
  { to: '/admin/matching', label: 'Matching', icon: Zap },
  { to: '/admin/responses', label: 'Responses', icon: MessageSquare },
  { to: '/admin/events',    label: 'Private Table', icon: UtensilsCrossed },
  { to: '/admin/podcast',   label: 'Podcast',       icon: Mic },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin-login');
  };

  const Sidebar = ({ onNavClick }) => (
    <div className="flex flex-col h-full">
      <div className="px-5 py-5 border-b border-white/8">
        <NavLink to="/admin" onClick={onNavClick}>
          <img src={LOGO_URL} alt="RAGE" className="h-10 w-auto invert" />
        </NavLink>
        <p className="text-[10px] text-[#DC143C] uppercase tracking-[0.2em] mt-1.5 font-semibold">Admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-[#DC143C]/10 text-[#DC143C] border-l-2 border-[#DC143C] pl-[10px]'
                  : 'text-[#71717A] hover:text-[#F5F5F0] hover:bg-white/[0.03]'
              }`
            }
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/8">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-[#71717A] hover:text-[#F5F5F0] transition-colors outline-none">
            <div className="w-7 h-7 bg-[#1A1A1A] border border-white/10 flex items-center justify-center shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-medium text-[#F5F5F0] truncate">{user?.name}</p>
              <p className="text-[10px] text-[#52525B] truncate">{user?.email}</p>
            </div>
            <ChevronDown className="w-3 h-3 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="bg-[#111111] border-white/10 rounded-none min-w-[180px]">
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem onClick={handleLogout} className="text-[#A1A1AA] hover:text-[#F5F5F0] focus:text-[#F5F5F0] focus:bg-white/5 rounded-none cursor-pointer">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="dark-ui min-h-screen bg-[#050505] flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-[#080808] border-r border-white/8 fixed h-screen z-40">
        <Sidebar />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#080808] border-b border-white/8 flex items-center justify-between px-4">
        <img src={LOGO_URL} alt="RAGE" className="h-8 w-auto invert" />
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-[#A1A1AA] hover:text-[#F5F5F0] transition-colors">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-[#080808] border-r border-white/8">
            <Sidebar onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-56 min-h-screen pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
