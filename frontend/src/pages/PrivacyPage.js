import { useSiteContent } from '@/hooks/useSiteContent';
const D = {
  hero: { overline: 'Legal', title: 'Terms & Privacy', body: '' },
  terms_title: 'Terms & Conditions',
  terms_body: '',
  privacy_title: 'Privacy Policy',
  privacy_body: '',
  copyright: '',
  company_name: 'RAGE',
  registered_address: '',
};

export default function PrivacyPage() {
  const c = useSiteContent('legal', D);
  return (
    <div data-testid="privacy-page">
      <section className="py-24 border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6">
          <p className="rage-overline mb-4">{c.hero.overline}</p>
          <h1 className="text-5xl sm:text-6xl font-light tracking-tighter text-gray-900 max-w-3xl">{c.hero.title}</h1>
          {c.hero.body && <p className="mt-6 text-lg text-gray-600">{c.hero.body}</p>}
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6 space-y-12">
          {c.terms_title && (
            <div>
              <h2 className="text-xl font-medium text-gray-900 mb-4" style={{ fontFamily: 'Playfair Display' }}>{c.terms_title}</h2>
              <p className="text-base text-gray-600 leading-relaxed">{c.terms_body}</p>
            </div>
          )}
          {c.privacy_title && (
            <div>
              <h2 className="text-xl font-medium text-gray-900 mb-4" style={{ fontFamily: 'Playfair Display' }}>{c.privacy_title}</h2>
              <p className="text-base text-gray-600 leading-relaxed">{c.privacy_body}</p>
            </div>
          )}
          {c.registered_address && (
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">{c.company_name}</p>
              <p className="text-sm text-gray-500">{c.registered_address}</p>
            </div>
          )}
          {c.copyright && <p className="text-xs text-gray-400 pt-6 border-t border-gray-100">{c.copyright}</p>}
        </div>
      </section>
    </div>
  );
}
