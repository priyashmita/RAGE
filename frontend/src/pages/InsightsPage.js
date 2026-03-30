import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = `${process.env.REACT_APP_BACKEND_URL || 'https://rage-production.up.railway.app'}/api`;

export default function InsightsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/public/reports`)
      .then(r => setReports(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white pt-16">
      {/* Header */}
      <section className="py-20 border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-6">
          <p className="rage-overline mb-4">Insights</p>
          <h1 className="text-5xl md:text-6xl font-light tracking-tighter text-gray-900 max-w-3xl leading-tight">
            What we're seeing across the network.
          </h1>
          <p className="mt-8 text-lg text-gray-500 max-w-2xl leading-relaxed">
            Published under Chatham House Rule. Information here reflects aggregate themes from RAGE platform activity. No individual, company, or session is identified or attributed.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 text-xs text-gray-400 border border-gray-200 px-4 py-2">
            <span className="w-2 h-2 rounded-full bg-[#DC143C] shrink-0" />
            Chatham House Rule applies to all content on this page
          </div>
        </div>
      </section>

      {/* Reports */}
      <section className="py-16">
        <div className="max-w-[1400px] mx-auto px-6">
          {loading ? (
            <div className="flex items-center gap-3 text-gray-400 py-20">
              <div className="w-4 h-4 border-2 border-gray-200 border-t-[#DC143C] rounded-full animate-spin" />
              Loading reports…
            </div>
          ) : reports.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-gray-400 text-sm">No reports published yet. Check back soon.</p>
            </div>
          ) : (
            <div className="space-y-px">
              {reports.map((r, i) => (
                <article key={r.id} className="border border-gray-100 bg-white hover:bg-gray-50/50 transition-colors">
                  <button
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="w-full text-left px-8 py-8"
                  >
                    <div className="flex items-start justify-between gap-8">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          {r.period && (
                            <span className="text-[11px] uppercase tracking-[0.15em] text-[#DC143C] font-semibold">{r.period}</span>
                          )}
                          {(r.themes || []).slice(0, 3).map(t => (
                            <span key={t} className="text-[11px] text-gray-400 border border-gray-200 px-2 py-0.5">{t}</span>
                          ))}
                        </div>
                        <h2 className="text-xl md:text-2xl font-light text-gray-900 tracking-tight leading-snug">{r.title}</h2>
                        <p className="mt-3 text-sm text-gray-500 leading-relaxed line-clamp-2">{r.summary}</p>
                      </div>
                      <div className="shrink-0 mt-1">
                        <span className={`text-xs text-gray-400 transition-transform inline-block ${expanded === r.id ? 'rotate-45' : ''}`} style={{ fontSize: '20px', lineHeight: 1 }}>+</span>
                      </div>
                    </div>
                  </button>

                  {expanded === r.id && (
                    <div className="px-8 pb-10 border-t border-gray-100">
                      <div className="max-w-3xl pt-8">
                        <div className="mb-6 p-4 bg-gray-50 border-l-4 border-[#DC143C]">
                          <p className="text-xs text-gray-500 italic leading-relaxed">
                            Under Chatham House Rule — information may be used freely; the identity and affiliation of participants may not be revealed.
                          </p>
                        </div>

                        <h3 className="text-[11px] uppercase tracking-[0.15em] text-gray-400 mb-3 font-semibold">Summary</h3>
                        <p className="text-base text-gray-700 leading-relaxed mb-8">{r.summary}</p>

                        {(r.themes || []).length > 0 && (
                          <div className="mb-8">
                            <h3 className="text-[11px] uppercase tracking-[0.15em] text-gray-400 mb-3 font-semibold">Themes</h3>
                            <div className="flex flex-wrap gap-2">
                              {r.themes.map(t => (
                                <span key={t} className="text-sm text-gray-600 border border-gray-200 px-3 py-1">{t}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {(r.data_points || []).length > 0 && (
                          <div>
                            <h3 className="text-[11px] uppercase tracking-[0.15em] text-gray-400 mb-4 font-semibold">Observations</h3>
                            <ul className="space-y-3">
                              {r.data_points.map((dp, j) => (
                                <li key={j} className="flex gap-4 text-sm text-gray-600 leading-relaxed">
                                  <span className="text-[#DC143C] shrink-0 font-medium mt-0.5">—</span>
                                  <span>{dp}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <p className="mt-8 text-[11px] text-gray-300">
                          Published {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
