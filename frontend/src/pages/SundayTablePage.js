import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight, Play, Mic, Eye } from 'lucide-react';
const SI = [Play, Mic, Eye, Play];
const D = { hero:{overline:'',title:'',body:''}, format:{title:'',body:'',body2:''}, episodes:{theme:'',list:[]}, production:[], sponsorship:{overline:'',title:'',body:'',rules:[],stats:[]}, cta:{title:'',body:''} };

export default function SundayTablePage() {
  const c = useSiteContent('sunday_table', D);
  const specs = [{label:'6 episodes per season'},{label:'Fortnightly cadence'},{label:'YouTube primary'},{label:'Short-form clips'}];
  return (
    <div data-testid="sunday-table-page">
      <section className="py-24 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.hero.overline}</p><h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-4xl">{c.hero.title}</h1><p className="mt-6 text-lg text-gray-600 max-w-2xl leading-relaxed">{c.hero.body}</p></div></section>

      <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
        <div><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6">{c.format.title}</h2><p className="text-base text-gray-600 leading-relaxed mb-6">{c.format.body}</p><p className="text-sm text-gray-600 leading-relaxed mb-8">{c.format.body2}</p>
          <div className="grid grid-cols-2 gap-4">{specs.map((s,i)=>{const Icon=SI[i];return(<div key={s.label} className="flex items-center gap-3"><Icon className="w-4 h-4 text-[#DC143C]" /><span className="text-sm text-gray-600">{s.label}</span></div>);})}</div>
        </div>
        <div><p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">{c.episodes.theme}</p><div className="space-y-0">{c.episodes.list.map((ep,i)=>(<div key={i} className="flex items-center gap-4 py-4 border-b border-gray-200"><span className="text-sm font-mono text-[#DC143C] w-8 shrink-0">E{i+1}</span><p className="text-sm text-gray-900 italic" style={{fontFamily:'Playfair Display'}}>{ep}</p></div>))}</div></div>
      </div></div></section>

      <section className="py-20 bg-gray-50 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-12">Production & Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{c.production.map(p=>(<div key={p.label} className="bg-white border border-gray-200 p-6"><p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] font-semibold mb-3">{p.label}</p><p className="text-sm text-gray-600">{p.text}</p></div>))}</div>
      </div></section>

      <section className="py-20 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6">
        <p className="rage-overline mb-4">{c.sponsorship.overline}</p><h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6">{c.sponsorship.title}</h2><p className="text-base text-gray-600 leading-relaxed mb-6">{c.sponsorship.body}</p>
        <div className="space-y-2 text-sm text-gray-500 mb-8">{c.sponsorship.rules?.map((r,i)=><p key={i}>{r}</p>)}</div>
      </div></section>

      <section className="py-20"><div className="max-w-[1400px] mx-auto px-6 text-center"><h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4">{c.cta.title}</h2><p className="text-base text-gray-600 mb-8 max-w-md mx-auto">{c.cta.body}</p>
        <EnquiryDialog interest="sunday-table" title="Sunday Table Sponsorship Enquiry" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="sunday-table-enquiry-btn">Enquire About Sponsorship <ArrowRight className="w-4 h-4 ml-2" /></Button>} />
      </div></section>
    </div>
  );
}
