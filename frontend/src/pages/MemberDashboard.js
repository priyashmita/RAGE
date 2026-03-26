import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Clock, TrendingDown, TrendingUp, Loader2, AlertTriangle } from 'lucide-react';

export default function MemberDashboard() {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [planRes, ledgerRes] = await Promise.all([
        api.get('/members/plan'),
        api.get('/members/ledger')
      ]);
      setPlan(planRes.data);
      setLedger(ledgerRes.data);
    } catch (err) {
      // Member may not have a plan if they're a sponsor/founder
      if (err.response?.status !== 404) toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64 text-[#A1A1AA]"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  if (!plan) {
    return (
      <div data-testid="member-dashboard">
        <p className="rage-overline mb-2">Dashboard</p>
        <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0] mb-6">Welcome, {user?.name}</h1>
        <div className="border border-white/5 bg-[#0A0A0A] p-12 text-center text-[#71717A]">
          Your dashboard is ready. Explore Private Tables to discover curated events.
        </div>
      </div>
    );
  }

  const totalMin = plan.free_minutes_total || 300;
  const usedMin = plan.free_minutes_used || 0;
  const remainingMin = Math.max(totalMin - usedMin, 0);
  const usedPct = Math.round((usedMin / totalMin) * 100);
  const isExhausted = remainingMin <= 0;

  return (
    <div data-testid="member-dashboard">
      <div className="mb-10">
        <p className="rage-overline mb-2">Member Portal</p>
        <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0]">
          Time Bank
        </h1>
      </div>

      {/* Credit Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <Card className="bg-[#111111] border-white/8 rounded-none md:col-span-2" data-testid="credit-balance-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs uppercase tracking-widest text-[#71717A]">Credit Balance</p>
              <Clock className="w-4 h-4 text-[#DC143C]" />
            </div>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-5xl font-light text-[#F5F5F0] font-mono">{Math.floor(remainingMin / 60)}</span>
              <span className="text-lg text-[#71717A]">hrs</span>
              <span className="text-2xl font-light text-[#A1A1AA] font-mono">{remainingMin % 60}</span>
              <span className="text-sm text-[#71717A]">min remaining</span>
            </div>
            <Progress value={100 - usedPct} className="h-1.5 bg-[#1A1A1A] rounded-none" />
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-[#71717A]">{usedMin} min used</span>
              <span className="text-[10px] text-[#71717A]">{totalMin} min total</span>
            </div>
          </CardContent>
        </Card>

        <div className="rage-stat" data-testid="plan-type-card">
          <p className="text-xs uppercase tracking-widest text-[#71717A] mb-1">Plan</p>
          <p className="text-2xl font-light text-[#F5F5F0] capitalize">{plan.is_paid ? 'Paid' : 'Free'}</p>
          <Badge variant="outline" className={`rounded-none mt-2 text-[10px] ${plan.is_paid ? 'text-[#DC143C] border-[#DC143C]/30' : 'text-emerald-500 border-emerald-500/30'}`}>
            {plan.is_paid ? 'Paid Mode' : 'Free Tier'}
          </Badge>
        </div>

        <div className="rage-stat" data-testid="sessions-count-card">
          <p className="text-xs uppercase tracking-widest text-[#71717A] mb-1">Transactions</p>
          <p className="text-2xl font-light text-[#F5F5F0] font-mono">{ledger.length}</p>
        </div>
      </div>

      {/* Exhausted Warning */}
      {isExhausted && (
        <div className="bg-[#DC143C]/10 border border-[#DC143C]/30 p-5 flex items-center gap-4 mb-10" data-testid="credit-exhausted-warning">
          <AlertTriangle className="w-5 h-5 text-[#DC143C] shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#F5F5F0]">Free credits exhausted</p>
            <p className="text-xs text-[#A1A1AA]">Your free advisory hours have been used. Future sessions will be billed. Contact admin for credit top-up.</p>
          </div>
        </div>
      )}

      {/* Ledger */}
      <div>
        <h3 className="text-2xl font-normal text-[#F5F5F0] mb-4">Credit Ledger</h3>
        {ledger.length === 0 ? (
          <div className="border border-white/5 bg-[#0A0A0A] p-8 text-center text-[#71717A]">No transactions yet.</div>
        ) : (
          <div className="border border-white/8 bg-[#111111] rage-table">
            <Table>
              <TableHeader>
                <TableRow className="border-white/8 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map(entry => (
                  <TableRow key={entry.id} className="border-white/5 hover:bg-white/[0.02]">
                    <TableCell className="font-mono text-xs text-[#A1A1AA]">{new Date(entry.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        {entry.type === 'credit' ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                        <span className={entry.type === 'credit' ? 'text-emerald-500' : 'text-red-400'}>{entry.type}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-[#F5F5F0]">{entry.amount} min</TableCell>
                    <TableCell className="font-mono text-[#A1A1AA]">{entry.balance_after} min</TableCell>
                    <TableCell className="text-[#A1A1AA] text-sm">{entry.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
