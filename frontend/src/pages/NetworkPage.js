import { useState, useEffect } from 'react';
import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import PageHero from '@/components/PageHero';

const D = { hero:{overline:'',title:'',subtitle:'',body:'',image_url:''}, stats:[], domains:[], cta:{title:'',body:''} };
const WRAP = 'max-w-[1200px] mx-auto px-6 lg:px-8';

export default function NetworkPage() {
  const c = useSiteContent('network', D);
  const [ragers, setRagers] = useState([]);

  useEffect(() => {
    api.get('/public/ragers').then(res => setRagers(res.data || [])).catch(() => {});
  }, []);

  return (
    <div data-testid="network-page">

      <PageHero hero={c.hero} />

      {c.stats.length > 0 && (
        <section className="border-b border-gray-100">
          <div className={WRAP}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200">
              {c.stats.map(s => (
                <div key={s.label} className="bg-white p-8 text-center">
                  <p className="text-4xl font-light text-gray-900 font-mono">{s.value}</p>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mt-2">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {c.domains.length > 0 && (
        <section className="py-14 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-6">Operating Experience Across</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {c.domains.map(d => (
                <div key={d} className="bg-white border border-gray-200 px-5 py-4">
                  <p className="text-sm text-gray-900" style={{fontFamily:'Manrope'}}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {ragers.length > 0 && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            <p className="rage-overline mb-6">The Ragers</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200">
              {ragers.map(m => (
                <div key={m.id} className="bg-white p-8">
                  {m.photo_url ? (
                    <img src={m.photo_url} alt={m.name} className="w-12 h-12 object-cover rounded-full mb-4" />
                  ) : (
                    <div className="w-10 h-10 bg-[#DC143C]/10 flex items-center justify-center mb-4">
                      <span className="text-[#DC143C] text-sm font-semibold font-mono">{m.name.split(' ').map(n=>n[0]).join('')}</span>
                    </div>
                  )}
                  <h3 className="text-base font-semibold text-gray-900 mb-1" style={{fontFamily:'Manrope'}}>{m.name}</h3>
                  <p className="text-xs text-[#DC143C] uppercase tracking-wider mb-1">{m.title}{m.company ? ` · ${m.company}` : ''}</p>
                  {m.location && <p className="text-xs text-gray-400 mb-3">{m.location}</p>}
                  <p className="text-sm text-gray-500 leading-relaxed">{m.bio}</p>
                  {m.categories?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {m.categories.map(cat => <span key={cat} className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5">{cat}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-14">
        <div className={`${WRAP} text-center`}>
          {c.cta.title && <h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4">{c.cta.title}</h2>}
          {c.cta.body && <p className="text-base text-gray-600 mb-8 max-w-md mx-auto">{c.cta.body}</p>}
          <EnquiryDialog interest="general" title="Talk to Us" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="network-enquiry-btn">Get in Touch <ArrowRight className="w-4 h-4 ml-2" /></Button>} />
        </div>
      </section>

    </div>
  );
}
