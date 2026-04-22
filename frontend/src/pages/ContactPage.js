import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight, Mail } from 'lucide-react';
const D = { hero:{overline:'',title:'',body:''}, details:{email:'contact@rageforgood.com',note:''}, cta:{title:'',body:''} };

export default function ContactPage() {
  const c = useSiteContent('contact', D);
  return (
    <div data-testid="contact-page">

      {c.hero.title && (
        <section className="py-12 border-b border-gray-100"><div className="max-w-[1200px] mx-auto px-6 lg:px-8">
          {c.hero.overline && <p className="rage-overline mb-4">{c.hero.overline}</p>}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-3xl leading-[1.05]">{c.hero.title}</h1>
          {c.hero.body && <p className="mt-5 text-lg text-gray-600 max-w-xl leading-relaxed">{c.hero.body}</p>}
        </div></section>
      )}

      <section className="py-14"><div className="max-w-[1200px] mx-auto px-6 lg:px-8"><div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <div className="bg-gray-50 border border-gray-200 p-8 mb-6">
            <div className="flex items-center gap-3 mb-4"><Mail className="w-5 h-5 text-[#DC143C]" /><p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold">Email</p></div>
            <a href={`mailto:${c.details.email}`} className="text-xl text-gray-900 hover:text-[#DC143C] transition-colors font-mono">{c.details.email}</a>
            {c.details.note && <p className="text-sm text-gray-500 mt-3">{c.details.note}</p>}
          </div>
        </div>
        <div>
          {c.cta.title && <h2 className="text-2xl font-normal tracking-tight text-gray-900 mb-6" style={{fontFamily:'Playfair Display'}}>{c.cta.title}</h2>}
          {c.cta.body && <p className="text-sm text-gray-600 mb-6">{c.cta.body}</p>}
          <EnquiryDialog interest="general" title="Get in Touch" trigger={<Button className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold" data-testid="contact-enquiry-btn">Send Enquiry <ArrowRight className="w-4 h-4 ml-2" /></Button>} />
        </div>
      </div></div></section>

    </div>
  );
}
