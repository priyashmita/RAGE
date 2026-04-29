const WRAP = 'max-w-[1200px] mx-auto px-6 lg:px-8';

/**
 * Shared hero component for all content pages (Closed Table, Private Table,
 * Sunday Table, About, Network, Contact, etc.).
 *
 * Props:
 *   hero: { overline, title, subtitle, body, image_url }
 *
 * Render order: overline → title → subtitle → body
 * Layout:
 *   image_url present → full-bleed photo with dark gradient overlay
 *   image_url absent  → white background, py-12, border-bottom
 */
export default function PageHero({ hero = {} }) {
  if (!hero.title) return null;

  if (hero.image_url) {
    return (
      <section className="relative h-[60vh] min-h-[400px] flex items-end">
        <div className="absolute inset-0">
          <img src={hero.image_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/10" />
        </div>
        <div className={`relative z-10 ${WRAP} pb-16 w-full`}>
          {hero.overline && <p className="rage-overline mb-4 !text-white/70">{hero.overline}</p>}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-white max-w-3xl leading-[1.05]">{hero.title}</h1>
          {hero.subtitle && <p className="mt-4 text-lg text-white/70 max-w-2xl leading-relaxed">{hero.subtitle}</p>}
          {hero.body    && <p className="mt-4 text-base text-white/70 max-w-xl leading-relaxed">{hero.body}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 border-b border-gray-100">
      <div className={WRAP}>
        {hero.overline && <p className="rage-overline mb-4">{hero.overline}</p>}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-light tracking-tighter text-gray-900 max-w-3xl leading-[1.05]">{hero.title}</h1>
        {hero.subtitle && <p className="mt-4 text-lg text-gray-600 max-w-2xl leading-relaxed">{hero.subtitle}</p>}
        {hero.body    && <p className="mt-4 text-base text-gray-600 max-w-xl leading-relaxed">{hero.body}</p>}
      </div>
    </section>
  );
}
