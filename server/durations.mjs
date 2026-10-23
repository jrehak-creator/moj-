import { parseVideoLink } from './providers.mjs';

const maxHtmlBytes = 1024 * 1024;
const maxApiBytes = 256 * 1024;
const maxCacheEntries = 256;
const successAge = 60 * 60 * 1000;
const failureAge = 5 * 60 * 1000;

function abortReason(signal) {
  return signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => { signal.removeEventListener('abort', aborted); reject(abortReason(signal)); };
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
    if (signal.aborted) aborted();
  });
}

function cancelBody(response) {
  try { void Promise.resolve(response.body?.cancel?.()).catch(() => {}); } catch { /* Best-effort cleanup. */ }
}

async function boundedText(response, signal, limit) {
  if (!response.body?.getReader) {
    if (typeof response.text !== 'function') return '';
    const text = await abortable(response.text(), signal);
    return typeof text === 'string' ? text.slice(0, limit) : '';
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (bytes < limit) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      const chunk = value.subarray(0, limit - bytes);
      bytes += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    try { void reader.cancel().catch(() => {}); } catch { /* Best-effort cleanup. */ }
    try { reader.releaseLock(); } catch { /* A canceled pending read may already release it. */ }
  }
}

function secondsValue(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value))) return null;
  const seconds = Math.round(Number(value));
  return Number.isFinite(seconds) && seconds >= 1 && seconds <= 86400 ? seconds : null;
}

function isoSeconds(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match || !match.slice(1).some(part => part !== undefined)) return null;
  return secondsValue(Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0));
}

function jsonObjectAt(text, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth += 1;
    else if (char === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}

function sameVideo(url, id) {
  try { const link = parseVideoLink(url); return link.source === 'youtube' && link.contentId === id; } catch { return false; }
}

function htmlDuration(html, id) {
  // Related videos also contain lengths. Accept details only for the selected ID.
  for (const match of html.matchAll(/"videoDetails"\s*:\s*\{/g)) {
    const details = jsonObjectAt(html, match.index + match[0].length - 1);
    if (details?.videoId === id) {
      const seconds = secondsValue(details.lengthSeconds);
      if (seconds !== null) return seconds;
    }
  }
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let data;
    try { data = JSON.parse(script[1]); } catch { continue; }
    const queue = Array.isArray(data) ? [...data] : [data];
    while (queue.length) {
      const item = queue.shift();
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (types.includes('VideoObject') && [item.url, item.embedUrl, item.contentUrl, item['@id']].some(url => sameVideo(url, id))) {
        const seconds = isoSeconds(item.duration);
        if (seconds !== null) return seconds;
      }
    }
  }
  const meta = [];
  let canonical = false;
  for (const match of html.matchAll(/<(?:meta|link)\b[^>]{0,8192}>/gi)) {
    const attrs = {};
    for (const attr of match[0].matchAll(/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4];
    if ((attrs.rel?.toLowerCase() === 'canonical' && sameVideo(attrs.href, id)) || (attrs.property?.toLowerCase() === 'og:url' && sameVideo(attrs.content?.replace(/&amp;/g, '&'), id))) canonical = true;
    if (attrs.itemprop?.toLowerCase() === 'duration') meta.push(attrs.content);
  }
  if (canonical) {
    for (const value of meta) { const seconds = isoSeconds(value); if (seconds !== null) return seconds; }
  }
  return null;
}

/** Read public runtime metadata, never media bytes or signed-in account data. */
export function createDurationService({ fetchImpl = globalThis.fetch, youtubeApiKey = process.env.YOUTUBE_API_KEY || '' } = {}) {
  const apiKey = typeof youtubeApiKey === 'string' ? youtubeApiKey.trim() : '';
  const cache = new Map();

  async function resolve(url, { signal } = {}) {
    signal?.throwIfAborted();
    const link = parseVideoLink(url);
    if (link.source !== 'youtube') return null;
    const cached = cache.get(link.url);
    if (cached && cached.until > Date.now()) return cached.seconds;
    if (cached) cache.delete(link.url);
    const timeout = AbortSignal.timeout(4000);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let seconds = null;
    try {
      if (apiKey) {
        try {
          const endpoint = new URL('https://www.googleapis.com/youtube/v3/videos');
          endpoint.searchParams.set('part', 'contentDetails,status');
          endpoint.searchParams.set('id', link.contentId);
          endpoint.searchParams.set('key', apiKey);
          const response = await abortable(fetchImpl(endpoint.href, { redirect: 'error', signal: requestSignal, headers: { Accept: 'application/json' } }), requestSignal);
          requestSignal.throwIfAborted();
          if (response.ok) {
            const data = JSON.parse(await boundedText(response, requestSignal, maxApiBytes));
            const item = Array.isArray(data?.items) ? data.items.find(item => item?.id === link.contentId) : null;
            seconds = isoSeconds(item?.contentDetails?.duration);
          } else cancelBody(response);
        } catch { requestSignal.throwIfAborted(); }
      }
      if (seconds === null) {
        const response = await abortable(fetchImpl(link.url, { redirect: 'error', signal: requestSignal, headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'NestFamilyLibrary/0.1 (public video duration metadata)' } }), requestSignal);
        requestSignal.throwIfAborted();
        const type = response.headers?.get?.('content-type');
        if (response.ok && (!type || /^(?:text\/html|application\/xhtml\+xml)\b/i.test(type))) seconds = htmlDuration(await boundedText(response, requestSignal, maxHtmlBytes), link.contentId);
        else cancelBody(response);
      }
      requestSignal.throwIfAborted();
    } catch {
      // Restricted or unavailable public metadata has an unknown duration.
      signal?.throwIfAborted();
    }
    signal?.throwIfAborted();
    if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
    cache.set(link.url, { seconds, until: Date.now() + (seconds === null ? failureAge : successAge) });
    return seconds;
  }

  return { resolve };
}
