import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight } from 'lucide-react';

const D = {
  hero:        { overline: '', title: '', body: '' },
  format:      { title: '', body: '', body2: '' },
  episodes:    { theme: '', list: [] },
  production:  [],
  sponsorship: { overline: '', title: '', body: '', rules: [], stats: [] },
  cta:         { title: '', body: '' },
};

const WRAP = 'max-w-[1200px] mx-auto px-6 lg:px-8';

export default function SundayTablePage() {
  const c = useSiteContent('sunday_table', D);

  return (
    <div data-testid="sunday-table-page">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="py-12 border-b border-gray-100">
        <div className={WRAP}>
          {c.hero.overline && (
            <p className="rage-overline mb-4">{c.hero.overline}</p>
          )}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-3xl leading-[1.05]">
            {c.hero.title}
          </h1>
          {c.hero.body && (
            <p className="mt-5 text-lg text-gray-600 max-w-xl leading-relaxed">
              {c.hero.body}
            </p>
          )}
        </div>
      </section>

      {/* ── FORMAT + EPISODES ─────────────────────────────────────────────
          Two-column: description left, episode list right.
          Body paragraphs: each a discrete block, consistent text-base size.
          Between paragraphs: 16px gap (not margin — use flex gap).
      ──────────────────────────────────────────────────────────────────── */}
      <section className="py-14 border-b border-gray-100">
        <div className={WRAP}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

            {/* Description block */}
            <div>
              <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6 leading-snug">
                {c.format.title}
              </h2>
              {/* Each paragraph is a separate block — no merging */}
              <div className="flex flex-col gap-4">
                {c.format.body && (
                  <p className="text-base text-gray-600 leading-relaxed">
                    {c.format.body}
                  </p>
                )}
                {c.format.body2 && (
                  <p className="text-base text-gray-600 leading-relaxed">
                    {c.format.body2}
                  </p>
                )}
              </div>
            </div>

            {/* Episode list */}
            <div>
              {c.episodes.theme && (
                <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">
                  {c.episodes.theme}
                </p>
              )}
              <div>
                {c.episodes.list.map((ep, i) => {
                  // Support both new `people` array and legacy `founder`/`company` fields
                  const people = ep.people?.filter(p => p.name) ||
                    (ep.founder ? [{ name: ep.founder, company: ep.company }] : []);
                  return (
                    <div key={i} className="py-4 border-b border-gray-200">
                      <div className="flex items-start gap-4">
                        <span className="text-sm font-mono text-[#DC143C] w-8 shrink-0 mt-0.5">
                          E{i + 1}
                        </span>
                        <div className="flex flex-col gap-1 flex-1">
                          {ep.title && (
                            <p
                              className="text-sm font-medium text-gray-900"
                              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                            >
                              {ep.title}
                            </p>
                          )}
                          {people.length > 0 && (
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                              {people.map((p, j) => (
                                <p key={j} className="text-xs text-gray-500">
                                  {p.name}{p.company ? ` · ${p.company}` : ''}
                                </p>
                              ))}
                            </div>
                          )}
                          {ep.desc && (
                            <p className="text-xs text-gray-400">{ep.desc}</p>
                          )}
                          {ep.date && (
                            <p className="text-[10px] font-mono text-gray-400">{ep.date}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── PRODUCTION & DISTRIBUTION ─────────────────────────────────── */}
      {c.production.length > 0 && (
        <section className="py-14 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6">
              Production & Distribution
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {c.production.map(p => (
                <div key={p.label} className="bg-white border border-gray-200 p-6 flex flex-col gap-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#DC143C] font-semibold">
                    {p.label}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── SPONSORSHIP ───────────────────────────────────────────────── */}
      {c.sponsorship.title && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            <div className="grid grid-cols-12 gap-16 items-start">
              <div className="col-span-12 lg:col-span-4">
                {c.sponsorship.overline && (
                  <p className="rage-overline mb-4">{c.sponsorship.overline}</p>
                )}
                <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 leading-snug">
                  {c.sponsorship.title}
                </h2>
              </div>
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                {c.sponsorship.body && (
                  <p className="text-base text-gray-600 leading-relaxed">
                    {c.sponsorship.body}
                  </p>
                )}
                {c.sponsorship.rules?.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {c.sponsorship.rules.map((r, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-1 h-1 bg-[#DC143C] rounded-full mt-[7px] shrink-0" />
                        <span className="text-sm text-gray-600 leading-relaxed">{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section className="py-14">
        <div className={`${WRAP} text-center`}>
          <h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4">
            {c.cta.title}
          </h2>
          {c.cta.body && (
            <p className="text-base text-gray-600 mb-6 max-w-md mx-auto">
              {c.cta.body}
            </p>
          )}
          <EnquiryDialog
            interest="sunday-table"
            title="Sunday Table Sponsorship Enquiry"
            trigger={
              <Button
                className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold"
                data-testid="sunday-table-enquiry-btn"
              >
                Enquire About Sponsorship <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            }
          />
        </div>
      </section>

    </div>
  );
}
