import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, MapPin, Users, CreditCard, Loader2, Minus, Plus, Building, CheckCircle, Clock } from 'lucide-react';

const HERO_IMG = 'https://images.unsplash.com/photo-1748551204300-f227d5af350f?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxOTF8MHwxfHNlYXJjaHwzfHxleGNsdXNpdmUlMjBkaW5uZXIlMjBtZWV0aW5nJTIwbHV4dXJ5fGVufDB8fHx8MTc3NDQ0MTI0MHww&ixlib=rb-4.1.0&q=85';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentConfig, setPaymentConfig] = useState({ razorpay_available: false, bank_transfer_available: true });
  const [bookingEvent, setBookingEvent] = useState(null);
  const [seats, setSeats] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [evtRes, cfgRes] = await Promise.all([
        api.get('/events'),
        api.get('/payment-config').catch(() => ({ data: { razorpay_available: false, bank_transfer_available: true } }))
      ]);
      setEvents(evtRes.data);
      setPaymentConfig(cfgRes.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBankTransfer = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/bookings/bank-transfer', { event_id: bookingEvent.id, seats });
      setBookingSuccess({ type: 'bank_transfer', booking: res.data.booking });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRazorpay = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/payments/create-order', { event_id: bookingEvent.id, seats });
      const { order_id, amount, currency, razorpay_key_id } = res.data;
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error('Payment gateway failed to load'); setSubmitting(false); return; }
      const options = {
        key: razorpay_key_id, amount, currency, order_id,
        name: 'RAGE', description: `${bookingEvent.title} - ${seats} seat(s)`,
        handler: async (response) => {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              event_id: bookingEvent.id, seats
            });
            setBookingSuccess({ type: 'razorpay' });
            fetchData();
          } catch { toast.error('Payment verification failed'); }
        },
        theme: { color: '#DC143C' }
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment initiation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const closeDialog = () => { setBookingEvent(null); setBookingSuccess(null); setSeats(1); };

  if (loading) return <div className="flex items-center justify-center h-64 text-[#A1A1AA]"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div data-testid="events-page">
      {/* Hero */}
      <div className="relative h-64 mb-10 overflow-hidden" data-testid="events-hero">
        <img src={HERO_IMG} alt="Private Tables" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 h-full flex flex-col justify-end p-8">
          <p className="rage-overline mb-2">Exclusive Access</p>
          <h1 className="text-4xl md:text-5xl font-light tracking-tighter text-[#F5F5F0]">Private Tables</h1>
          <p className="text-base text-[#A1A1AA] mt-2 max-w-lg">Curated dinners and intimate roundtables with industry leaders. Limited seats.</p>
        </div>
      </div>

      {/* Events grid */}
      {events.length === 0 ? (
        <div className="border border-white/5 bg-[#0A0A0A] p-16 text-center text-[#71717A]">
          <Calendar className="w-8 h-8 mx-auto mb-4 text-[#DC143C]" />
          <p className="text-lg">No upcoming events</p>
          <p className="text-sm mt-1">Check back soon for new private table announcements.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map(event => (
            <Card key={event.id} className="bg-[#111111] border-white/8 rounded-none overflow-hidden rage-card group" data-testid={`event-card-${event.id}`}>
              <div className="h-40 relative overflow-hidden">
                <img src={event.image_url || HERO_IMG} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-black/40" />
                <Badge className="absolute top-3 right-3 bg-[#DC143C] text-white rounded-none border-none text-[10px]">{event.available_seats} seats left</Badge>
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-medium text-[#F5F5F0] mb-2" style={{ fontFamily: 'Manrope' }}>{event.title}</h3>
                <p className="text-sm text-[#A1A1AA] line-clamp-2 mb-4">{event.description}</p>
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-[#71717A]"><Calendar className="w-3.5 h-3.5" />{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                  {event.venue && <div className="flex items-center gap-2 text-xs text-[#71717A]"><MapPin className="w-3.5 h-3.5" />{event.venue}</div>}
                  <div className="flex items-center gap-2 text-xs text-[#71717A]"><Users className="w-3.5 h-3.5" />{event.total_seats} total seats</div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <span className="text-xl font-mono text-[#F5F5F0]"><span className="text-xs text-[#71717A] mr-1">INR</span>{event.price_per_seat?.toLocaleString()}<span className="text-xs text-[#71717A] ml-1">/ seat</span></span>
                  <Button onClick={() => { setBookingEvent(event); setSeats(1); setBookingSuccess(null); }} disabled={event.available_seats <= 0} className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow text-xs" data-testid={`book-event-${event.id}`}>
                    {event.available_seats > 0 ? 'Reserve Seat' : 'Sold Out'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking dialog */}
      <Dialog open={!!bookingEvent} onOpenChange={closeDialog}>
        <DialogContent className="bg-[#111111] border-white/10 rounded-none max-w-md" data-testid="booking-dialog">
          {bookingSuccess ? (
            /* Success state */
            <div className="py-6 text-center" data-testid="booking-success">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#F5F5F0] mb-2" style={{ fontFamily: 'Manrope' }}>
                {bookingSuccess.type === 'razorpay' ? 'Booking confirmed' : 'Seats reserved'}
              </h3>
              {bookingSuccess.type === 'bank_transfer' && (
                <div className="text-sm text-[#A1A1AA] space-y-2">
                  <p>Your seats are held. Our team will share bank transfer details within 24 hours.</p>
                  <p className="text-xs text-[#71717A]">Booking reference: <span className="font-mono text-[#F5F5F0]">{bookingSuccess.booking?.id?.slice(0, 8)}</span></p>
                </div>
              )}
              {bookingSuccess.type === 'razorpay' && (
                <p className="text-sm text-[#A1A1AA]">Payment confirmed. You're all set.</p>
              )}
              <Button onClick={closeDialog} variant="outline" className="mt-6 border-white/15 text-[#A1A1AA] rounded-none" data-testid="close-booking-success">Done</Button>
            </div>
          ) : bookingEvent && (
            /* Booking form */
            <div>
              <DialogHeader>
                <DialogTitle className="text-[#F5F5F0] text-xl">Reserve Seats</DialogTitle>
              </DialogHeader>
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="text-base font-medium text-[#F5F5F0]" style={{ fontFamily: 'Manrope' }}>{bookingEvent.title}</h4>
                  <p className="text-sm text-[#71717A] mt-1">{new Date(bookingEvent.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-[#71717A] mb-3 block">Number of Seats</Label>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => setSeats(Math.max(1, seats - 1))} className="rounded-none border-white/15 h-10 w-10" data-testid="seats-minus"><Minus className="w-4 h-4" /></Button>
                    <span className="text-2xl font-mono text-[#F5F5F0] w-12 text-center">{seats}</span>
                    <Button variant="outline" size="icon" onClick={() => setSeats(Math.min(bookingEvent.available_seats, seats + 1))} className="rounded-none border-white/15 h-10 w-10" data-testid="seats-plus"><Plus className="w-4 h-4" /></Button>
                    <span className="text-xs text-[#71717A]">of {bookingEvent.available_seats} available</span>
                  </div>
                </div>
                <div className="border-t border-white/8 pt-4">
                  <div className="flex justify-between items-center mb-5">
                    <span className="text-sm text-[#A1A1AA]">Total</span>
                    <span className="text-2xl font-mono text-[#F5F5F0]"><span className="text-xs text-[#71717A] mr-1">INR</span>{(seats * bookingEvent.price_per_seat).toLocaleString()}</span>
                  </div>

                  {/* Payment options */}
                  <p className="text-[10px] uppercase tracking-widest text-[#71717A] mb-3 font-semibold">Payment Options</p>
                  <div className="space-y-2">
                    {/* Bank Transfer — always available */}
                    <Button onClick={handleBankTransfer} disabled={submitting} className="w-full bg-[#1A1A1A] hover:bg-[#222] text-[#F5F5F0] border border-white/10 hover:border-white/20 rounded-none h-auto py-3 px-4 justify-start" data-testid="pay-bank-transfer">
                      <div className="flex items-center gap-3 w-full">
                        <Building className="w-4 h-4 text-[#DC143C] shrink-0" />
                        <div className="text-left flex-1">
                          <p className="text-sm font-medium">Bank Transfer</p>
                          <p className="text-[10px] text-[#71717A] font-normal mt-0.5">Reserve now. Payment details shared within 24 hours.</p>
                        </div>
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <Badge className="bg-emerald-500/20 text-emerald-400 rounded-none border-none text-[9px] shrink-0">Available</Badge>}
                      </div>
                    </Button>

                    {/* Razorpay — gated */}
                    {paymentConfig.razorpay_available ? (
                      <Button onClick={handleRazorpay} disabled={submitting} className="w-full bg-[#1A1A1A] hover:bg-[#222] text-[#F5F5F0] border border-white/10 hover:border-white/20 rounded-none h-auto py-3 px-4 justify-start" data-testid="pay-razorpay">
                        <div className="flex items-center gap-3 w-full">
                          <CreditCard className="w-4 h-4 text-[#DC143C] shrink-0" />
                          <div className="text-left flex-1">
                            <p className="text-sm font-medium">Pay Online</p>
                            <p className="text-[10px] text-[#71717A] font-normal mt-0.5">Instant confirmation via Razorpay.</p>
                          </div>
                          <Badge className="bg-emerald-500/20 text-emerald-400 rounded-none border-none text-[9px] shrink-0">Available</Badge>
                        </div>
                      </Button>
                    ) : (
                      <div className="w-full bg-[#0A0A0A] border border-white/5 rounded-none py-3 px-4 flex items-center gap-3 opacity-60 cursor-not-allowed" data-testid="pay-razorpay-coming-soon">
                        <CreditCard className="w-4 h-4 text-[#71717A] shrink-0" />
                        <div className="text-left flex-1">
                          <p className="text-sm text-[#71717A]">Online Payment</p>
                          <p className="text-[10px] text-[#71717A] mt-0.5">Coming soon via Razorpay.</p>
                        </div>
                        <Badge className="bg-white/5 text-[#71717A] rounded-none border-none text-[9px] shrink-0"><Clock className="w-2.5 h-2.5 mr-1 inline" />Soon</Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
