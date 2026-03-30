import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight, Lock, Clock, Users, Repeat } from 'lucide-react';
const RI = [Lock, Clock, Users, Repeat];
const D = { hero:{overline:'',title:'',body:''}, how_it_works:{title:'',steps:[]}, rules:{title:'',items:[]}, tiers:[], precedents:{overline:'',title:'',body:'',items:[]}, faqs:[], cta:{title:'',body:''} };

export default function ClosedTablePage() {
  const c = useSiteContent('closed_table', D);
  return (
    <div data-testid="closed-table-page">

      {c.hero.title && (
        <section className="py-24 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6">
          {c.hero.overline && <p className="rage-overline mb-4">{c.hero.overline}</p>}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-4xl">{c.hero.title}</h1>
          {c.hero.body && <p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">{c.hero.body}</p>}
        </div></section>
      )}

      {c.how_it_works.title && (
        <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-12">{c.how_it_works.title}</h2>
          {c.how_it_works.steps.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200">{c.how_it_works.steps.map(s => (<div key={s.step} className="bg-white p-8"><span className="text-[#DC143C] font-mono text-sm">{s.step}</span><h3 className="text-lg font-medium text-gray-900 mt-2 mb-3" style={{fontFamily:'Playfair Display'}}>{s.label}</h3><p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p></div>))}</div>
          )}
        </div></section>
      )}

      {(c.rules.title || c.tiers.length > 0) && (
        <section className="py-20 bg-gray-50 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {c.rules.title && (
            <div>
              <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-8">{c.rules.title}</h2>
              {c.rules.items.length > 0 && (
                <div className="space-y-5">{c.rules.items.map((r, i) => { const Icon = RI[i]||Lock; return (<div key={r.title} className="flex items-start gap-4"><div className="w-9 h-9 bg-[#DC143C]/10 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-[#DC143C]" /></div><div><p className="text-sm font-semibold text-gray-900" style={{fontFamily:'Manrope'}}>{r.title}</p><p className="text-xs text-gray-500 mt-1">{r.desc}</p></div></div>);})}</div>
              )}
            </div>
          )}
          {c.tiers.length > 0 && (
            <div><p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">Pricing</p><div className="space-y-4">{c.tiers.map(t => (<div key={t.name} className="bg-white border border-gray-200 p-6"><div className="flex items-baseline justify-between mb-2"><h4 className="text-base font-semibold text-gray-900" style={{fontFamily:'Manrope'}}>{t.name}</h4><span className="text-lg font-mono text-gray-900">{t.price}</span></div><p className="text-sm text-gray-600">{t.desc}</p></div>))}</div></div>
          )}
        </div></div></section>
      )}

      {c.precedents.title && (
        <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6">
          {c.precedents.overline && <p className="rage-overline mb-4">{c.precedents.overline}</p>}
          <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-4">{c.precedents.title}</h2>
          {c.precedents.body && <p className="text-base text-gray-600 mb-12 max-w-xl">{c.precedents.body}</p>}
        </div></section>
      )}

      {c.faqs?.length > 0 && (
        <section className="py-20 bg-gray-50 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6">
          <p className="rage-overline mb-8">FAQs</p>
          <div className="space-y-6 max-w-2xl">{c.faqs.map((f, i) => (<div key={i}><p className="text-sm font-semibold text-gray-900 mb-2">{f.q}</p><p className="text-sm text-gray-600">{f.a}</p></div>))}</div>
        </div></section>
      )}

      {c.cta.title && (
        <section className="py-20"><div className="max-w-[1400px] mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4">{c.cta.title}</h2>
          {c.cta.body && <p className="text-base text-gray-600 mb-8 max-w-md mx-auto">{c.cta.body}</p>}
          <Link to="/closed-table/request"><Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="closed-table-request-btn">Request a Closed Table <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div></section>
      )}

    </div>
  );
}
