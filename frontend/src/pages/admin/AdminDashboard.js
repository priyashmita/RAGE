import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Users, Zap, Calendar, CreditCard, FileText, Activity, Plus, Play, CheckCircle, Loader2, ShieldCheck, Mail, MessageSquare, PenLine, UserPlus } from 'lucide-react';

/* ✅ FIXED IMPORT */
import AdminContentEditor from '@/pages/admin/AdminContentEditor';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [matches, setMatches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [ctRequests, setCtRequests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [networkMembers, setNetworkMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchAll = useCallback(async () => {
    try {
      const [statsR, usersR, reqsR, matchR, sessR, evtR, payR, logR, enqR] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/requests'),
        api.get('/admin/matches'),
        api.get('/admin/sessions'),
        api.get('/events'),
        api.get('/admin/payments'),
        api.get('/admin/audit-logs'),
        api.get('/admin/enquiries')
      ]);

      setStats(statsR.data);
      setUsers(usersR.data);
      setRequests(reqsR.data);
      setMatches(matchR.data);
      setSessions(sessR.data);
      setEvents(evtR.data);
      setPayments(payR.data);
      setAuditLogs(logR.data);
      setEnquiries(enqR.data);

    } catch {
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') fetchAll();
  }, [user, fetchAll]);

  if (user?.role !== 'admin')
    return <div className="text-[#71717A] text-center py-20">Access denied</div>;

  if (loading)
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div>Users: {stats.users || 0}</div>
        </TabsContent>

        {/* ENQUIRIES */}
        <TabsContent value="enquiries">
          {enquiries.map(e => (
            <div key={e.id}>{e.name}</div>
          ))}
        </TabsContent>

        {/* CONTENT */}
        <TabsContent value="content">
          <AdminContentEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
