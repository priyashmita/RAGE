import { useSiteContent } from '@/hooks/useSiteContent';
const D = { hero:{overline:'',title:'',body:''}, content:{sections:[]} };

export default function PrivacyPage() {
  const c = useSiteContent('privacy', D);
  return (
    <div data-testid="privacy-page" className="rage-page-in">
      <section className="py-24 border-b border-gray-100"><div className="max-w-[1400px] mx-auto px-6"><p className="rage-overline mb-4">{c.hero.overline}</p><h1 className="text-5xl sm:text-6xl font-light tracking-tighter text-gray-900 max-w-3xl">{c.hero.title}</h1><p className="mt-6 text-lg text-gray-600">{c.hero.body}</p></div></section>

      <section className="py-16"><div className="max-w-3xl mx-auto px-6 space-y-10">
        {c.content.sections?.map((s, i) => (
          <div key={i}>
            <h2 className="text-xl font-medium text-gray-900 mb-3" style={{fontFamily:'Playfair Display'}}>{s.title}</h2>
            <p className="text-base text-gray-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div></section>
    </div>
  );
}
