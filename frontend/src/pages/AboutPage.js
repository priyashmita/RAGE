import { Link } from 'react-router-dom';
import { EnquiryDialog } from '@/components/EnquiryDialog';
import { Button } from '@/components/ui/button';
import { useSiteContent } from '@/hooks/useSiteContent';
import { ArrowRight } from 'lucide-react';
import PageHero from '@/components/PageHero';

const D = {
  hero:           { overline: '', title: '', subtitle: '', body: '', image_url: '' },
  mission:        { title: '', quote: '', body: '', body2: '' },
  business_first: { overline: '', title: '', body: '', items: [] },
  community:      { overline: '', title: '', body: '', stats: [], image_url: '', highlights: [] },
  focus_areas:    { overline: '', title: '', items: [] },
  team:           [],
  cta:            { title: '', body: '' },
};

const WRAP = 'max-w-[1200px] mx-auto px-6 lg:px-8';

export default function AboutPage() {
  const c = useSiteContent('about', D);

  return (
    <div data-testid="about-page">

      <PageHero hero={c.hero} />

      {/* ── WHY RAGE EXISTS — py-14 (56px) ────────────────────────────────────
          12-col grid: left 4 cols (headline), right 8 cols (body)
          Top-aligned. Gap 64px. No vertical offset between columns.
      ──────────────────────────────────────────────────────────────────────── */}
      {c.mission.title && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            <div className="grid grid-cols-12 gap-16 items-start">

              {/* Left — 4/12: headline only, acts as section anchor */}
              <div className="col-span-12 lg:col-span-4">
                <h2
                  className="text-3xl font-normal tracking-tight text-gray-900 leading-snug"
                  style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                >
                  {c.mission.title}
                </h2>
              </div>

              {/* Right — 8/12: pull quote then body, each a discrete block */}
              <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                {c.mission.quote && (
                  <p
                    className="text-xl text-gray-700 leading-[1.65] font-light"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {c.mission.quote}
                  </p>
                )}
                {c.mission.body && (
                  <p className="text-base text-gray-600 leading-relaxed">
                    {c.mission.body}
                  </p>
                )}
                {c.mission.body2 && (
                  <p className="text-base text-gray-600 leading-relaxed">
                    {c.mission.body2}
                  </p>
                )}
              </div>

            </div>
          </div>
        </section>
      )}

      {/* ── BUSINESS FIRST — py-14 (56px) ─────────────────────────────────────
          Centred header (max 760px) mb-8 → full-width 3-col pillar grid.
      ──────────────────────────────────────────────────────────────────────── */}
      {c.business_first.title && (
        <section className="py-14 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>

            <div className="max-w-[760px] mx-auto text-center mb-8">
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

            {c.business_first.items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200">
                {c.business_first.items.map(d => (
                  <div key={d.num} className="bg-white px-8 py-8 flex flex-col gap-3">
                    <span className="text-[#DC143C] font-mono text-sm">{d.num}</span>
                    <h3
                      className="text-lg font-medium text-gray-900 leading-snug"
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

      {/* ── NETWORK — py-14 (56px) ─────────────────────────────────────────────
          Left-aligned single block. Overline → headline → body → bullets
          → stats, each element discrete with consistent spacing.
          Stats: border-top treatment, tight 24px gap.
      ──────────────────────────────────────────────────────────────────────── */}
      {c.community.title && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            {c.community.image_url ? (
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
              <div className="grid grid-cols-12 gap-16 items-start">
                <div className="col-span-12 lg:col-span-4">
                  {c.community.overline && (
                    <p className="rage-overline mb-4">{c.community.overline}</p>
                  )}
                  <h2
                    className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 leading-snug"
                    style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
                  >
                    {c.community.title}
                  </h2>
                </div>
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
                  {c.community.body && (
                    <p className="text-base text-gray-600 leading-relaxed">{c.community.body}</p>
                  )}
                  {c.community.highlights?.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {c.community.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-[#DC143C] rounded-full mt-[7px] shrink-0" />
                          <span className="text-sm text-gray-600 leading-relaxed">{h}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {c.community.stats.length > 0 && (
                    <div className="grid grid-cols-3 gap-6 pt-2">
                      {c.community.stats.map(s => (
                        <div key={s.label} className="border-t border-gray-200 pt-3">
                          <p className="text-2xl font-light text-gray-900 font-mono leading-none mb-1">{s.value}</p>
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── FOCUS AREAS — py-14 (56px) ─────────────────────────────────────── */}
      {c.focus_areas.title && (
        <section className="py-14 bg-gray-50 border-b border-gray-100">
          <div className={WRAP}>
            {c.focus_areas.overline && (
              <p className="rage-overline mb-4">{c.focus_areas.overline}</p>
            )}
            <h2
              className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 mb-6 max-w-xl leading-snug"
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

      {/* ── TEAM — py-14 (56px) ────────────────────────────────────────────── */}
      {c.team?.length > 0 && c.team[0].name && (
        <section className="py-14 border-b border-gray-100">
          <div className={WRAP}>
            <p className="rage-overline mb-4">The Team</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {c.team.map((m, i) =>
                m.name ? (
                  <div key={i} className="bg-white border border-gray-200 px-8 py-8 flex flex-col gap-1">
                    {m.photo_url && (
                      <img src={m.photo_url} alt={m.name} className="w-16 h-16 object-cover rounded-full mb-3" />
                    )}
                    <h3 className="text-base font-semibold text-gray-900">{m.name}</h3>
                    {m.title && (
                      <p className="text-xs text-[#DC143C] uppercase tracking-wider">{m.title}</p>
                    )}
                    {m.bio && <p className="text-sm text-gray-500 mt-2">{m.bio}</p>}
                  </div>
                ) : null
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA — py-14 (56px) ─────────────────────────────────────────────── */}
      {c.cta.title && (
        <section className="py-14">
          <div className={`${WRAP} text-center`}>
            <h2 className="text-3xl md:text-4xl font-light tracking-tighter text-gray-900 mb-4 leading-snug">
              {c.cta.title}
            </h2>
            {c.cta.body && (
              <p className="text-base text-gray-600 mb-6 max-w-md mx-auto">
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

/* ── NetworkContent ───────────────────────────────────────────────────────────
   Used in both image and no-image layout paths.
   Each element is a discrete block. Bullets → stats: 24px max.
   Stats: border-top treatment, no box background, tight gap.
──────────────────────────────────────────────────────────────────────────────── */
function NetworkContent({ c }) {
  return (
    <div className="flex flex-col gap-4">
      {c.community.overline && (
        <p className="rage-overline">{c.community.overline}</p>
      )}
      <h2
        className="text-3xl md:text-4xl font-normal tracking-tight text-gray-900 leading-snug"
        style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
      >
        {c.community.title}
      </h2>
      {c.community.body && (
        <p className="text-base text-gray-600 leading-relaxed">
          {c.community.body}
        </p>
      )}

      {/* Bullet highlights — discrete list items */}
      {c.community.highlights?.length > 0 && (
        <ul className="flex flex-col gap-2">
          {c.community.highlights.map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1 h-1 bg-[#DC143C] rounded-full mt-[7px] shrink-0" />
              <span className="text-sm text-gray-600 leading-relaxed">{h}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Stats — 24px gap, border-top only, no background box */}
      {c.community.stats.length > 0 && (
        <div className="grid grid-cols-3 gap-6 pt-2">
          {c.community.stats.map(s => (
            <div key={s.label} className="border-t border-gray-200 pt-3">
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
    </div>
  );
}
