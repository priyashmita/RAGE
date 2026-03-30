import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { FileText, Users, Inbox, Zap, ArrowRight, Loader2 } from 'lucide-react';

const STAT_CARDS = [
  { key: 'ragers', label: 'Ragers', sub: 'public_ragers', subLabel: 'public', href: '/admin/ragers', icon: Users, color: '#DC143C' },
  { key: 'enquiries', label: 'Enquiries', href: '/admin/enquiries', icon: Inbox, color: '#A1A1AA' },
  { key: 'pending_allocations', label: 'Pending Matches', href: '/admin/matching', icon: Zap, color: '#A1A1AA' },
  { key: 'users', label: 'Platform Users', href: '/admin/ragers', icon: Users, color: '#A1A1AA' },
];

const QUICK_LINKS = [
  { to: '/admin/content', icon: FileText, label: 'Edit Content', desc: 'Update page copy, logos, and CMS' },
  { to: '/admin/ragers', icon: Users, label: 'Manage Ragers', desc: 'Add, edit, and publish Rager profiles' },
  { to: '/admin/matching', icon: Zap, label: 'Matching', desc: 'Allocate advisors to enquiries' },
  { to: '/admin/enquiries', icon: Inbox, label: 'Enquiries', desc: 'View all submitted requests' },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then(r => setStats(r.data))
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] mb-2 font-semibold">Admin</p>
        <h1 className="text-3xl font-light text-[#F5F5F0] tracking-tight">Overview</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {STAT_CARDS.map(card => (
          <Link key={card.key} to={card.href} className="bg-[#0A0A0A] border border-white/8 p-5 hover:border-white/20 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <card.icon className="w-4 h-4" style={{ color: card.color }} />
              <ArrowRight className="w-3.5 h-3.5 text-[#52525B] group-hover:text-[#A1A1AA] transition-colors" />
            </div>
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#52525B]" />
            ) : (
              <>
                <p className="text-2xl font-light text-[#F5F5F0]">{stats?.[card.key] ?? '—'}</p>
                <p className="text-xs text-[#52525B] mt-0.5">
                  {card.label}
                  {card.sub && stats?.[card.sub] !== undefined
                    ? ` · ${stats[card.sub]} ${card.subLabel}`
                    : ''}
                </p>
              </>
            )}
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <p className="text-xs uppercase tracking-[0.15em] text-[#52525B] mb-4 font-semibold">Quick Access</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUICK_LINKS.map(link => (
            <Link key={link.to} to={link.to} className="flex items-start gap-4 bg-[#0A0A0A] border border-white/8 p-5 hover:border-white/20 transition-colors group">
              <div className="w-9 h-9 bg-[#111] border border-white/8 flex items-center justify-center shrink-0 mt-0.5">
                <link.icon className="w-4 h-4 text-[#71717A] group-hover:text-[#DC143C] transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#F5F5F0]">{link.label}</p>
                <p className="text-xs text-[#52525B] mt-0.5">{link.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
