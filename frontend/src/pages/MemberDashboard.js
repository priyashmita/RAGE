import { useAuth } from '@/contexts/AuthContext';

export default function MemberDashboard() {
  const { user } = useAuth();

  return (
    <div data-testid="member-dashboard">
      <p className="rage-overline mb-2">Dashboard</p>
      <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0] mb-6">
        Welcome, {user?.name}
      </h1>
      <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center text-[#71717A]">
        Your dashboard is ready. Explore Private Tables to discover curated events.
      </div>
    </div>
  );
}
