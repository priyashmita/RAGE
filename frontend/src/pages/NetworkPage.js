import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight } from 'lucide-react';
const D = { hero:{overline:'',title:'',body:''}, stats:[], domains:[], members:[], cta:{title:'',body:''} };

export default function NetworkPage() {
  const c = useSiteContent('network', D);
  return (
    <div data-testid="network-page">
      <section className="py-24 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.hero.overline}</p><h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-4xl leading-[1.05]">{c.hero.title}</h1><p className="mt-8 text-lg text-gray-600 max-w-2xl leading-relaxed">{c.hero.body}</p></div></section>

      <section className="border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">{c.stats.map(s=>(<div key={s.label} className="bg-white p-8 text-center"><p className="text-4xl font-light text-gray-900 font-mono">{s.value}</p><p className="text-xs text-gray-400 uppercase tracking-wider mt-2">{s.label}</p></div>))}</div></div></section>

      <section className="py-20 bg-gray-50 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-6">Operating Experience Across</p><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{c.domains.map(d=>(<div key={d} className="bg-white border border-gray-200 px-5 py-4"><p className="text-sm text-gray-900" style={{fontFamily:'Manrope'}}>{d}</p></div>))}</div></div></section>

      <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">Select Members</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 mt-8">{c.members.map(m=>(<div key={m.name} className="bg-white p-8"><div className="w-10 h-10 bg-[#DC143C]/10 flex items-center justify-center mb-4"><span className="text-[#DC143C] text-sm font-semibold font-mono">{m.name.split(' ').map(n=>n[0]).join('')}</span></div><h3 className="text-base font-semibold text-gray-900 mb-1" style={{fontFamily:'Manrope'}}>{m.name}</h3><p className="text-xs text-[#DC143C] uppercase tracking-wider mb-3">{m.role}</p><p className="text-sm text-gray-500 leading-relaxed">{m.bio}</p></div>))}</div>
      </div></section>

      <section className="py-20"><div className="max-w-[1400px] mx-auto px-6 text-center"><h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4">{c.cta.title}</h2><p className="text-base text-gray-600 mb-8 max-w-md mx-auto">{c.cta.body}</p>
        <EnquiryDialog interest="general" title="Talk to Us" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="network-enquiry-btn">Get in Touch <ArrowRight className="w-4 h-4 ml-2" /></Button>} />
      </div></section>
    </div>
  );
}
