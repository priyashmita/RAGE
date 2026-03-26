import { Link } from 'react-router-dom';
import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight, Shield, MessageSquare, Users } from 'lucide-react';
const RI = [Shield, MessageSquare, Users];
const D = { hero:{overline:'',title:'',subtitle:'',image_url:''}, what:{title:'',body:'',rules:[]}, table_types:[], flow:{overline:'',title:'',steps:[]}, economics:{stats:[],note:''}, cta:{title:'',body:''} };

export default function PrivateTablePage() {
  const c = useSiteContent('private_table', D);
  return (
    <div data-testid="private-table-page">
      <section className="relative h-[60vh] min-h-[400px] flex items-end"><div className="absolute inset-0"><img src={c.hero.image_url} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" /></div><div className="relative z-10 max-w-[1400px] mx-auto px-6 pb-16 w-full"><p className="rage-overline mb-4 !text-white/70">{c.hero.overline}</p><h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-white">{c.hero.title}</h1><p className="mt-4 text-lg text-white/70 max-w-xl">{c.hero.subtitle}</p></div></section>

      <section className="py-20 border-t border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6">{c.what.title}</h2><p className="text-base text-gray-600 leading-relaxed mb-6">{c.what.body}</p>
          <div className="space-y-3">{c.what.rules.map((r, i) => { const Icon = RI[i]||Shield; return (<div key={i} className="flex items-start gap-3"><Icon className="w-4 h-4 text-[#DC143C] mt-0.5 shrink-0" /><p className="text-sm text-gray-600">{r}</p></div>);})}</div>
        </div>
        <div><p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">Table Types</p><div className="space-y-3">{c.table_types.map(t => (<div key={t.name} className="bg-gray-50 border border-gray-200 p-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-gray-900" style={{fontFamily:'Manrope'}}>{t.name}</p><p className="text-xs text-gray-500 mt-0.5">{t.desc}</p></div><span className="text-sm font-mono text-gray-900 shrink-0 ml-4">{t.fee}</span></div>))}</div></div>
      </div></div></section>

      <section className="py-20 bg-gray-50 border-t border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.flow.overline}</p><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-12">{c.flow.title}</h2>
        <div className="space-y-0">{c.flow.steps.map((s, i) => (<div key={i} className="flex items-start gap-6 py-5 border-b border-gray-200"><div className="w-20 shrink-0"><span className="text-xs font-mono text-[#DC143C]">{s.time}</span></div><div><p className="text-sm font-semibold text-gray-900" style={{fontFamily:'Manrope'}}>{s.label}</p><p className="text-xs text-gray-500 mt-1">{s.desc}</p></div></div>))}</div>
      </div></section>

      <section className="py-20 border-t border-gray-100"><div className="max-w-[1400px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 mb-8">{c.economics.stats.map(s => (<div key={s.label} className="bg-white p-8"><p className="text-3xl font-light text-gray-900 font-mono mb-1">{s.value}</p><p className="text-xs text-gray-400 uppercase tracking-wider">{s.label}</p></div>))}</div>
        <p className="text-sm text-gray-400 italic mb-12">{c.economics.note}</p>
        <EnquiryDialog interest="private-table" title="Request a Private Table" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="private-table-enquiry-btn">{c.cta.title} <ArrowRight className="w-4 h-4 ml-2" /></Button>} />
      </div></section>
    </div>
  );
}
