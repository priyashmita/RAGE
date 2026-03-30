import { useState, useEffect } from 'react';
import api from '@/lib/api';

const cache = {};

function merge(defaults, overrides) {
  if (!overrides) return defaults;
  if (Array.isArray(defaults)) return overrides.length > 0 ? overrides : defaults;
  if (typeof defaults === 'object' && defaults !== null) {
    const result = { ...defaults };
    for (const key of Object.keys(overrides)) {
      if (overrides[key] !== null && overrides[key] !== undefined) {
        result[key] = typeof defaults[key] === 'object' && defaults[key] !== null
          ? merge(defaults[key], overrides[key])
          : overrides[key];
      }
    }
    return result;
  }
  return (overrides !== null && overrides !== undefined && overrides !== '') ? overrides : defaults;
}

export function useSiteContent(page, defaults = {}) {
  const [content, setContent] = useState(cache[page] ? merge(defaults, cache[page]) : defaults);

  useEffect(() => {
    if (cache[page]) { setContent(merge(defaults, cache[page])); return; }
    let cancelled = false;
    api.get(`/public/content/${page}`)
      .then(res => {
        if (!cancelled && res.data?.sections) {
          cache[page] = res.data.sections;
          setContent(merge(defaults, res.data.sections));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  return content;
}

export function invalidateContentCache(page) {
  if (page) delete cache[page];
  else Object.keys(cache).forEach(k => delete cache[k]);
}
