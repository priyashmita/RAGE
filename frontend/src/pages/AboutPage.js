import { Link } from 'react-router-dom';
import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight } from 'lucide-react';
const D = { hero:{overline:'',title:'',body:''}, mission:{title:'',quote:'',body:'',body2:''}, business_first:{overline:'',title:'',body:'',items:[]}, community:{overline:'',title:'',body:'',stats:[],image_url:'',highlights:[]}, focus_areas:{overline:'',title:'',items:[]}, cta:{title:'',body:''} };

export default function AboutPage() {
  const c = useSiteContent('about', D);
  return (
    <div data-testid="about-page">
      <section className="py-24 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.hero.overline}</p><h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-4xl leading-[1.05]">{c.hero.title}</h1><p className="mt-8 text-lg text-gray-600 max-w-2xl leading-relaxed">{c.hero.body}</p></div></section>

      <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16"><div><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6">{c.mission.title}</h2><p className="text-2xl text-gray-600 leading-relaxed font-light" style={{fontFamily:'Playfair Display'}}>{c.mission.quote}</p></div><div><p className="text-base text-gray-600 leading-relaxed mb-6">{c.mission.body}</p><p className="text-base text-gray-600 leading-relaxed">{c.mission.body2}</p></div></div></div></section>

      <section className="py-20 bg-gray-50 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.business_first.overline}</p><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6 max-w-2xl">{c.business_first.title}</h2><p className="text-base text-gray-600 max-w-2xl mb-12 leading-relaxed">{c.business_first.body}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200">{c.business_first.items.map(d => (<div key={d.num} className="bg-white p-8"><span className="text-[#DC143C] font-mono text-sm">{d.num}</span><h3 className="text-lg font-medium text-gray-900 mt-2 mb-3" style={{fontFamily:'Playfair Display'}}>{d.title}</h3><p className="text-sm text-gray-600 leading-relaxed">{d.text}</p></div>))}</div>
      </div></section>

      <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="relative h-72 lg:h-[360px]"><img src={c.community.image_url} alt="" className="w-full h-full object-cover" /></div>
        <div><p className="rage-overline mb-4">{c.community.overline}</p><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6">{c.community.title}</h2><p className="text-base text-gray-600 leading-relaxed mb-6">{c.community.body}</p>
          <div className="space-y-2 text-sm text-gray-600">{c.community.highlights?.map((h, i) => <p key={i}>{h}</p>)}</div>
          <div className="grid grid-cols-3 gap-4 mt-8">{c.community.stats.map(s => (<div key={s.label} className="bg-gray-50 border border-gray-200 p-4"><p className="text-xl font-light text-gray-900 font-mono">{s.value}</p><p className="text-[9px] uppercase tracking-widest text-gray-400 mt-1">{s.label}</p></div>))}</div>
        </div>
      </div></div></section>

      <section className="py-20 bg-gray-50 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.focus_areas.overline}</p><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-12 max-w-2xl">{c.focus_areas.title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{c.focus_areas.items.map(a => (<div key={a.title} className="bg-white border border-gray-200 p-8"><h3 className="text-lg font-medium text-gray-900 mb-4" style={{fontFamily:'Playfair Display'}}>{a.title}</h3><ul className="space-y-3">{a.points?.map((item, i) => (<li key={i} className="flex items-start gap-2"><span className="w-1 h-1 bg-[#DC143C] rounded-full mt-2 shrink-0" /><span className="text-sm text-gray-600 leading-relaxed">{item}</span></li>))}</ul></div>))}</div>
      </div></section>

      <section className="py-20"><div className="max-w-[1400px] mx-auto px-6 text-center"><h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4">{c.cta.title}</h2><p className="text-base text-gray-600 mb-8">{c.cta.body}</p>
        <div className="flex flex-wrap justify-center gap-4"><EnquiryDialog interest="general" title="Talk to Us" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="about-enquiry-btn">Request Access <ArrowRight className="w-4 h-4 ml-2" /></Button>} /><Link to="/network"><Button variant="outline" className="border-gray-300 text-gray-900 hover:bg-gray-100 rounded-none h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="about-network-btn">View the Network</Button></Link></div>
      </div></section>
    </div>
  );
}
