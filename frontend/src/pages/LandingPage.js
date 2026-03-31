import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { EnquiryDialog } from '@/components/EnquiryDialog';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight, ArrowUpRight, Users, TrendingUp, Banknote, Shield } from 'lucide-react';

const ICON_MAP = { 'Women Founders': TrendingUp, 'Financial Institutions & Funds': Banknote, 'Governments & Multilaterals': Shield };
const D = { hero:{overline:'',title:'',body:'',image_url:'',cta_primary_text:'See How It Works',cta_primary_link:'/private-table',cta_secondary_text:'Request a Table'}, problem:{overline:'',title:'',body:''}, stats:[], focus:{overline:'',title:'',items:[]}, formats:{overline:'',title:'',body:'',items:[]}, users:{overline:'',title:'',body:'',items:[]}, network_preview:{overline:'',title:'',body:'',stats:[],image_url:''}, why_different:{overline:'',title:'',body:'',items:[]}, cta:{title:'',body:'',cta_primary_text:'Request a Table',cta_secondary_text:'Explore Formats'} };

export default function LandingPage() {
  const c = useSiteContent('landing', D);
  return (
    <div data-testid="landing-page">

      {c.hero.title && (
        c.hero.image_url ? (
          <section className="relative min-h-[90vh] flex items-end" data-testid="hero-section">
            <div className="absolute inset-0"><img src={c.hero.image_url} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/20" /></div>
            <div className="relative z-10 max-w-[1400px] mx-auto px-6 pb-20 w-full">
              {c.hero.overline && <p className="rage-overline mb-6 !text-white/70">{c.hero.overline}</p>}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-white leading-[1.05] max-w-4xl">{c.hero.title}</h1>
              {c.hero.body && <p className="mt-8 text-lg text-white/70 max-w-2xl leading-relaxed">{c.hero.body}</p>}
              <div className="mt-10 flex flex-wrap gap-4">
                {c.hero.cta_primary_text && <Link to={c.hero.cta_primary_link || '/private-table'}><Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="hero-explore-btn">{c.hero.cta_primary_text} <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>}
                {c.hero.cta_secondary_text && <EnquiryDialog interest="general" title="Talk to Us" trigger={<Button variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-none h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="hero-enquiry-btn">{c.hero.cta_secondary_text}</Button>} />}
              </div>
            </div>
          </section>
        ) : (
          <section className="py-16 border-b border-gray-100" data-testid="hero-section">
            <div className="max-w-[1400px] mx-auto px-6">
              {c.hero.overline && <p className="rage-overline mb-4">{c.hero.overline}</p>}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 leading-[1.05] max-w-4xl">{c.hero.title}</h1>
              {c.hero.body && <p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">{c.hero.body}</p>}
              <div className="mt-10 flex flex-wrap gap-4">
                {c.hero.cta_primary_text && <Link to={c.hero.cta_primary_link || '/private-table'}><Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="hero-explore-btn">{c.hero.cta_primary_text} <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>}
                {c.hero.cta_secondary_text && <EnquiryDialog interest="general" title="Talk to Us" trigger={<Button variant="outline" className="border-gray-300 text-gray-900 hover:bg-gray-100 rounded-none h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="hero-enquiry-btn">{c.hero.cta_secondary_text}</Button>} />}
              </div>
            </div>
          </section>
        )
      )}

      {(c.problem.title || c.stats.length > 0) && (
        <section className="py-24 border-t border-gray-100" data-testid="problem-section">
          <div className="max-w-[1400px] mx-auto px-6">
            {c.problem.overline && <p className="rage-overline mb-4">{c.problem.overline}</p>}
            {c.problem.title && <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-gray-900 max-w-3xl mb-6">{c.problem.title}</h2>}
            {c.problem.body && <p className="text-lg text-gray-600 max-w-2xl mb-16 leading-relaxed">{c.problem.body}</p>}
            {c.stats.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200">
                {c.stats.map(s => (<div key={s.label} className="bg-white p-8"><p className="text-4xl font-light text-gray-900 font-mono mb-2">{s.value}</p><p className="text-sm text-gray-900 font-medium mb-1" style={{fontFamily:'Manrope'}}>{s.label}</p><p className="text-xs text-gray-400">{s.sub}</p></div>))}
              </div>
            )}
          </div>
        </section>
      )}

      {c.focus.title && (
        <section className="py-24 bg-gray-50 border-t border-gray-100" data-testid="focus-section">
          <div className="max-w-[1400px] mx-auto px-6">
            {c.focus.overline && <p className="rage-overline mb-4">{c.focus.overline}</p>}
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-gray-900 max-w-3xl mb-16">{c.focus.title}</h2>
            {c.focus.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200">
                {c.focus.items.map(f => (<div key={f.num} className="bg-white p-10"><span className="text-[#DC143C] font-mono text-sm">{f.num}</span><h3 className="text-xl font-medium text-gray-900 mt-3 mb-4" style={{fontFamily:'Playfair Display'}}>{f.title}</h3><p className="text-sm text-gray-600 leading-relaxed">{f.text}</p></div>))}
              </div>
            )}
          </div>
        </section>
      )}

      {(c.formats.title || c.formats.items.length > 0) && (
        <section className="py-24 border-t border-gray-100" data-testid="formats-section">
          <div className="max-w-[1400px] mx-auto px-6">
            {c.formats.overline && <p className="rage-overline mb-4">{c.formats.overline}</p>}
            {c.formats.title && <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-gray-900 max-w-3xl mb-6">{c.formats.title}</h2>}
            {c.formats.body && <p className="text-lg text-gray-600 max-w-2xl mb-16 leading-relaxed">{c.formats.body}</p>}
            {c.formats.items.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {c.formats.items.map((f, i) => (<Link to={f.link} key={f.title} className="group" data-testid={`format-card-${i}`}><div className="bg-white border border-gray-200 p-8 h-full flex flex-col hover:border-gray-400 hover:shadow-md transition-all duration-300"><span className="rage-overline mb-4">{f.tag}</span><h3 className="text-2xl font-normal text-gray-900 mb-4" style={{fontFamily:'Playfair Display'}}>{f.title}</h3><p className="text-sm text-gray-600 leading-relaxed flex-1 mb-6">{f.desc}</p><div className="flex items-center justify-between pt-4 border-t border-gray-100"><span className="text-xs text-gray-400 font-mono">{f.price}</span><ArrowUpRight className="w-4 h-4 text-[#DC143C] group-hover:translate-x-1 transition-transform duration-200" /></div></div></Link>))}
              </div>
            )}
          </div>
        </section>
      )}

      {c.users.title && (
        <section className="py-24 bg-gray-50 border-t border-gray-100" data-testid="users-section">
          <div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              {c.users.overline && <p className="rage-overline mb-4">{c.users.overline}</p>}
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-gray-900 mb-6">{c.users.title}</h2>
              {c.users.body && <p className="text-base text-gray-600 leading-relaxed">{c.users.body}</p>}
            </div>
            {c.users.items.length > 0 && (
              <div className="space-y-4">{c.users.items.map(u => { const Icon = ICON_MAP[u.label] || Users; return (<div key={u.label} className="flex items-start gap-4 p-5 bg-white border border-gray-200 hover:border-gray-300 transition-colors"><div className="w-10 h-10 bg-[#DC143C]/10 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-[#DC143C]" /></div><div><p className="text-sm font-semibold text-gray-900" style={{fontFamily:'Manrope'}}>{u.label}</p><p className="text-xs text-gray-500 mt-0.5">{u.desc}</p></div></div>);})}</div>
            )}
          </div></div>
        </section>
      )}

      {c.network_preview.title && (
        <section className="py-24 border-t border-gray-100" data-testid="network-preview-section">
          <div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              {c.network_preview.overline && <p className="rage-overline mb-4">{c.network_preview.overline}</p>}
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-gray-900 mb-6">{c.network_preview.title}</h2>
              {c.network_preview.body && <p className="text-base text-gray-600 leading-relaxed mb-8">{c.network_preview.body}</p>}
              {c.network_preview.stats.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-8">{c.network_preview.stats.map(s => (<div key={s.label} className="bg-gray-50 border border-gray-200 p-4"><p className="text-2xl font-light text-gray-900 font-mono">{s.value}</p><p className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">{s.label}</p></div>))}</div>
              )}
              <Link to="/network" className="inline-flex items-center gap-2 text-sm text-[#DC143C] hover:text-gray-900 transition-colors font-medium" data-testid="view-network-link">View the Network <ArrowRight className="w-4 h-4" /></Link>
            </div>
            {c.network_preview.image_url && (
              <div className="relative h-80 lg:h-[420px]"><img src={c.network_preview.image_url} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-r from-white/60 to-transparent" /></div>
            )}
          </div></div>
        </section>
      )}

      {c.why_different.title && (
        <section className="py-24 bg-gray-50 border-t border-gray-100" data-testid="why-different-section">
          <div className="max-w-[1400px] mx-auto px-6 text-center">
            {c.why_different.overline && <p className="rage-overline mb-4">{c.why_different.overline}</p>}
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight text-gray-900 mb-6 max-w-3xl mx-auto">{c.why_different.title}</h2>
            {c.why_different.body && <p className="text-base text-gray-600 max-w-2xl mx-auto mb-16 leading-relaxed">{c.why_different.body}</p>}
            {c.why_different.items.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{c.why_different.items.map(d => (<div key={d.title} className="bg-white border border-gray-200 p-6 text-left"><h4 className="text-sm font-semibold text-gray-900 mb-2" style={{fontFamily:'Manrope'}}>{d.title}</h4><p className="text-xs text-gray-500">{d.desc}</p></div>))}</div>
            )}
          </div>
        </section>
      )}

      {c.cta.title && (
        <section className="py-24 border-t border-gray-100" data-testid="cta-section">
          <div className="max-w-[1400px] mx-auto px-6 text-center">
            <h2 className="text-4xl md:text-5xl font-light tracking-tighter text-gray-900 mb-4">{c.cta.title}</h2>
            {c.cta.body && <p className="text-base text-gray-600 mb-10 max-w-xl mx-auto">{c.cta.body}</p>}
            <div className="flex flex-wrap justify-center gap-4">
              {c.cta.cta_primary_text && <EnquiryDialog interest="closed-table" title="Request a Closed Table" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="cta-closed-table">{c.cta.cta_primary_text}</Button>} />}
              {c.cta.cta_secondary_text && <Link to="/private-table"><Button variant="outline" className="border-gray-300 text-gray-900 hover:bg-gray-100 rounded-none h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="cta-explore">{c.cta.cta_secondary_text}</Button></Link>}
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
