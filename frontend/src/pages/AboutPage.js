import { Link } from 'react-router-dom';
import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight } from 'lucide-react';

const D = {
  hero:           { overline: '', title: '', body: '' },
  mission:        { title: '', quote: '', body: '', body2: '' },
  business_first: { overline: '', title: '', body: '', items: [] },
  community:      { overline: '', title: '', body: '', stats: [], image_url: '', highlights: [] },
  focus_areas:    { overline: '', title: '', items: [] },
  team:           [],
  cta:            { title: '', body: '' },
};

/* Shared container — max 1200px, consistent margins */
const WRAP = 'max-w-[1200px] mx-auto px-6 lg:px-8';

export default function AboutPage() {
  const c = useSiteContent('about', D);

  return (
    <div data-testid="about-page">

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      {c.hero.title && (
        <section className="py-16 border-b border-gray-100">
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
      )}

      {/* ── MISSION / WHY RAGE EXISTS ─────────────────────────────────────────
          Layout: 12-col grid — left 4 cols (hook), right 8 cols (body)
          Columns top-aligned. Gap: 64px.
      ──────────────────────────────────────────────────────────────────────── */}
      {c.mission.title && (
        <section className="py-20 border-b border-gray-100">
          <div className={WRAP}>
            <div className="grid grid-cols-12 gap-16 items-start">

              {/* Left — 4 cols: headline + italic pull quote */}
              <div className="col-span-12 lg:col-span-4">
                <h2
                  className="text-3xl font-normal tracking-tight text-gray-900 leading-snug mb-0"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {c.mission.title}
                </h2>
              </div>

              {/* Right — 8 cols: pull quote + body paragraphs */}
              <div className="col-span-12 lg:col-span-8">
                {c.mission.quote && (
                  <p
                    className="text-xl text-gray-700 leading-[1.65] font-light mb-6"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {c.mission.quote}
                  </p>
                )}
                {c.mission.body && (
                  <p className="text-base text-gray-600 leading-relaxed mb-4 max-w-[580px]">
                    {c.mission.body}
                  </p>
                )}
                {c.mission.body2 && (
                  <p className="text-base text-gray-600 leading-relaxed max-w-[580px]">
                    {c.mission.body2}
                  </p>
                )}
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ── BUSINESS FIRST ────────────────────────────────────────────────────
          Layout: centered header block (max 760px), then full-width 3-col grid.
          Visual break from the narrative flow above.
      ──────────────────────────────────────────────────────────────────────── */}
      {c.business_first.title && (
        <section className="py-20 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>

            {/* Centered header */}
            <div className="max-w-[760px] mx-auto text-center mb-12">
              {c.business_first.overline && (
                <p className="rage-overline mb-4">{c.business_first.overline}</p>
              )}
              <h2
                className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-4 leading-snug"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                {c.business_first.title}
              </h2>
              {c.business_first.body && (
                <p className="text-base text-gray-600 leading-relaxed">
                  {c.business_first.body}
                </p>
              )}
            </div>

            {/* 3 equal pillars */}
            {c.business_first.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200">
                {c.business_first.items.map(d => (
                  <div key={d.num} className="bg-white px-8 py-8">
                    <span className="text-[#DC143C] font-mono text-sm">{d.num}</span>
                    <h3
                      className="text-lg font-medium text-gray-900 mt-3 mb-3 leading-snug"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      {d.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{d.text}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ── NETWORK ───────────────────────────────────────────────────────────
          Layout: left-aligned block — overline, headline, body, bullets, then stats.
          If an image is present, render as 2-col with content on right.
          Stats: 3 equal columns, tight gap.
      ──────────────────────────────────────────────────────────────────────── */}
      {c.community.title && (
        <section className="py-20 border-b border-gray-100">
          <div className={WRAP}>
            {c.community.image_url ? (
              /* Two-column when image exists */
              <div className="grid grid-cols-12 gap-16 items-start">
                <div className="col-span-12 lg:col-span-5">
                  <img
                    src={c.community.image_url}
                    alt=""
                    className="w-full aspect-[4/3] object-cover"
                  />
                </div>
                <div className="col-span-12 lg:col-span-7">
                  <NetworkContent c={c} />
                </div>
              </div>
            ) : (
              /* Single-column left-aligned when no image */
              <div className="max-w-[720px]">
                <NetworkContent c={c} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FOCUS AREAS ───────────────────────────────────────────────────── */}
      {c.focus_areas.title && (
        <section className="py-20 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>
            {c.focus_areas.overline && (
              <p className="rage-overline mb-4">{c.focus_areas.overline}</p>
            )}
            <h2
              className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-10 max-w-xl leading-snug"
              style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
            >
              {c.focus_areas.title}
            </h2>
            {c.focus_areas.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {c.focus_areas.items.map(a => (
                  <div key={a.title} className="bg-white border border-gray-200 px-8 py-8">
                    <h3
                      className="text-lg font-medium text-gray-900 mb-4 leading-snug"
                      style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                    >
                      {a.title}
                    </h3>
                    <ul className="space-y-3">
                      {a.points?.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-[#DC143C] rounded-full mt-[7px] shrink-0" />
                          <span className="text-sm text-gray-600 leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── TEAM ──────────────────────────────────────────────────────────── */}
      {c.team?.length > 0 && c.team[0].name && (
        <section className="py-20 border-b border-gray-100">
          <div className={WRAP}>
            <p className="rage-overline mb-4">The Team</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {c.team.map((m, i) =>
                m.name ? (
                  <div key={i} className="bg-white border border-gray-200 px-8 py-8">
                    {m.photo_url && (
                      <img
                        src={m.photo_url}
                        alt={m.name}
                        className="w-16 h-16 object-cover rounded-full mb-4"
                      />
                    )}
                    <h3 className="text-base font-semibold text-gray-900 mb-1">{m.name}</h3>
                    {m.title && (
                      <p className="text-xs text-[#DC143C] uppercase tracking-wider mb-3">
                        {m.title}
                      </p>
                    )}
                    {m.bio && <p className="text-sm text-gray-500">{m.bio}</p>}
                  </div>
                ) : null
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      {c.cta.title && (
        <section className="py-20">
          <div className={`${WRAP} text-center`}>
            <h2
              className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4 leading-snug"
            >
              {c.cta.title}
            </h2>
            {c.cta.body && (
              <p className="text-base text-gray-600 mb-8 max-w-md mx-auto">
                {c.cta.body}
              </p>
            )}
            <div className="flex flex-wrap justify-center gap-4">
              <EnquiryDialog
                interest="general"
                title="Talk to Us"
                trigger={
                  <Button
                    className="bg-[#DC143C] hover:bg-[#B01030] text-white rounded-none rage-btn-glow h-12 px-8 text-sm tracking-wider uppercase font-semibold"
                    data-testid="about-enquiry-btn"
                  >
                    Request Access <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                }
              />
              <Link to="/network">
                <Button
                  variant="outline"
                  className="border-gray-300 text-gray-900 hover:bg-gray-100 rounded-none h-12 px-8 text-sm tracking-wider uppercase font-semibold"
                  data-testid="about-network-btn"
                >
                  View the Network
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}

/* ── NetworkContent ────────────────────────────────────────────────────────────
   Extracted so the same markup works inside both the single-col and two-col
   Network layouts without duplication.
──────────────────────────────────────────────────────────────────────────────── */
function NetworkContent({ c }) {
  return (
    <>
      {c.community.overline && (
        <p className="rage-overline mb-4">{c.community.overline}</p>
      )}
      <h2
        className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-4 leading-snug"
        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
      >
        {c.community.title}
      </h2>
      {c.community.body && (
        <p className="text-base text-gray-600 leading-relaxed mb-4">
          {c.community.body}
        </p>
      )}

      {/* Bullet highlights */}
      {c.community.highlights?.length > 0 && (
        <ul className="space-y-2 mb-8">
          {c.community.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1 h-1 bg-[#DC143C] rounded-full mt-[7px] shrink-0" />
              <span className="text-sm text-gray-600 leading-relaxed">{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Stats — 3 columns, tight gap */}
      {c.community.stats.length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          {c.community.stats.map(s => (
            <div key={s.label} className="border-t-2 border-gray-200 pt-4">
              <p className="text-2xl font-light text-gray-900 font-mono leading-none mb-1">
                {s.value}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
