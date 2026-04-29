import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight, Lock, Clock, Users, Repeat } from 'lucide-react';

const RI = [Lock, Clock, Users, Repeat];
const D = {
  hero:         { overline: '', title: '', subtitle: '', image_url: '' },
  what:         { title: '', body: '' },
  how_it_works: { title: '', steps: [] },
  rules:        { title: '', items: [] },
  tiers:        [],
  precedents:   { overline: '', title: '', body: '', items: [] },
  faqs:         [],
  cta:          { title: '', body: '' },
};

const WRAP = 'max-w-[1200px] mx-auto px-6 lg:px-8';

export default function ClosedTablePage() {
  const c = useSiteContent('closed_table', D);

  return (
    <div data-testid="closed-table-page">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      {c.hero.title && (
        c.hero.image_url ? (
          <section className="relative h-[60vh] min-h-[400px] flex items-end">
            <div className="absolute inset-0">
              <img src={c.hero.image_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" />
            </div>
            <div className={`relative z-10 ${WRAP} pb-16 w-full`}>
              {c.hero.overline && <p className="rage-overline mb-4 !text-white/70">{c.hero.overline}</p>}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-white">{c.hero.title}</h1>
              {c.hero.subtitle && <p className="mt-4 text-lg text-white/70 max-w-2xl leading-relaxed">{c.hero.subtitle}</p>}
            </div>
          </section>
        ) : (
          <section className="py-12 border-b border-gray-100">
            <div className={WRAP}>
              {c.hero.overline && <p className="rage-overline mb-4">{c.hero.overline}</p>}
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-3xl leading-[1.05]">{c.hero.title}</h1>
              {c.hero.subtitle && <p className="mt-5 text-lg text-gray-600 max-w-xl leading-relaxed">{c.hero.subtitle}</p>}
            </div>
          </section>
        )
      )}

      {/* ── WHAT IS CLOSED TABLE — py-14 ─────────────────────────────────── */}
      {c.what.title && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            <div className="grid grid-cols-12 gap-16 items-start">
              <div className="col-span-12 lg:col-span-4">
                <h2 className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 leading-snug">{c.what.title}</h2>
              </div>
              <div className="col-span-12 lg:col-span-8">
                {c.what.body && <p className="text-base text-gray-600 leading-relaxed">{c.what.body}</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── HOW IT WORKS — py-14 (56px) ───────────────────────────────────
          Heading → grid: 24px. Step inner padding: 24px. Step gap: 8px.
      ──────────────────────────────────────────────────────────────────── */}
      {c.how_it_works.title && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            <h2 className="text-3xl font-normal tracking-tight text-gray-900 mb-6">
              {c.how_it_works.title}
            </h2>
            {c.how_it_works.steps.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200">
                {c.how_it_works.steps.map(s => (
                  <div key={s.step} className="bg-white p-6 flex flex-col gap-2">
                    <span className="text-[#DC143C] font-mono text-sm">{s.step}</span>
                    <h3
                      className="text-base font-medium text-gray-900 leading-snug"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      {s.label}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── RULES + PRICING — py-14 (56px) ───────────────────────────────
          Column gap: 48px. Heading → content: 24px.
          Rules items: 16px gap. Pricing label → cards: 16px.
          Cards: p-5 (20px), gap-3 (12px) between cards.
      ──────────────────────────────────────────────────────────────────── */}
      {(c.rules.title || c.tiers.length > 0) && (
        <section className="py-14 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

              {/* Rules */}
              {c.rules.title && (
                <div className="flex flex-col h-full">
                  <h2 className="text-2xl font-normal tracking-tight text-gray-900 mb-6">
                    {c.rules.title}
                  </h2>
                  {c.rules.items.length > 0 && (
                    <div className="flex flex-col flex-1 justify-between gap-4">
                      {c.rules.items.map((r, i) => {
                        const Icon = RI[i] || Lock;
                        return (
                          <div key={r.title} className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-[#DC143C]/10 flex items-center justify-center shrink-0">
                              <Icon className="w-3.5 h-3.5 text-[#DC143C]" />
                            </div>
                            <div className="flex flex-col gap-1">
                              <p
                                className="text-sm font-semibold text-gray-900"
                                style={{ fontFamily: 'Manrope, sans-serif' }}
                              >
                                {r.title}
                              </p>
                              <p className="text-xs text-gray-500 leading-relaxed">{r.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Formats — [Title] / [Price] / [Description] stacked */}
              {c.tiers.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-400 font-semibold mb-4">
                    Formats
                  </p>
                  <div className="flex flex-col gap-3">
                    {c.tiers.map(t => (
                      <div key={t.name} className="bg-white border border-gray-200 p-5 flex flex-col gap-2">
                        <h4
                          className="text-sm font-semibold text-gray-900 leading-snug"
                          style={{ fontFamily: 'Manrope, sans-serif' }}
                        >
                          {t.name}
                        </h4>
                        <p className="text-sm font-mono text-gray-700">{t.price}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{t.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ── WHAT FOUNDERS BRING — py-12 (48px) ───────────────────────────
          Heading → body: 12px. Tight, connected to sections above/below.
      ──────────────────────────────────────────────────────────────────── */}
      {c.precedents.title && (
        <section className="py-12 border-b border-gray-100">
          <div className={WRAP}>
            {c.precedents.overline && (
              <p className="rage-overline mb-3">{c.precedents.overline}</p>
            )}
            <h2 className="text-2xl font-normal tracking-tight text-gray-900 mb-3">
              {c.precedents.title}
            </h2>
            {c.precedents.body && (
              <p className="text-base text-gray-600 leading-relaxed">
                {c.precedents.body}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── FAQs — py-12 (48px) ───────────────────────────────────────────
          Title → first item: 20px. Question → answer: 8px.
          Between items: 20px.
      ──────────────────────────────────────────────────────────────────── */}
      {c.faqs?.length > 0 && (
        <section className="py-12 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>
            <h2 className="text-2xl font-normal tracking-tight text-gray-900 mb-5">
              FAQs
            </h2>
            <div className="flex flex-col gap-5">
              {c.faqs.map((f, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <p
                    className="text-sm font-semibold text-gray-900"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    {f.q}
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA — py-16 (64px) ────────────────────────────────────────── */}
      {c.cta.title && (
        <section className="py-16">
          <div className={`${WRAP} text-center`}>
            <h2 className="text-3xl font-light tracking-tighter text-gray-900 mb-3">
              {c.cta.title}
            </h2>
            {c.cta.body && (
              <p className="text-base text-gray-600 mb-8 max-w-md mx-auto">
                {c.cta.body}
              </p>
            )}
            <Link to="/closed-table/request">
              <Button
                className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold"
                data-testid="closed-table-request-btn"
              >
                Request a Closed Table <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>
      )}

    </div>
  );
}
