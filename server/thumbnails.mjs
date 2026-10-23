import { isIP } from 'node:net';
import { parseVideoLink } from './providers.mjs';
import { coverArtworkFor } from '../shared/covers.mjs';

const maxHtmlBytes = 512 * 1024;
const maxCacheEntries = 256;
const successAge = 60 * 60 * 1000;
const failureAge = 5 * 60 * 1000;

function abortReason(signal) {
  return signal?.reason ?? new DOMException('The request was aborted.', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortReason(signal);
}

// The injected fetch can be a test adapter; do not rely on it honoring cancellation.
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(abortReason(signal));
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
    // Consume a late rejection even if the adapter synchronously aborted its signal.
    if (signal.aborted) aborted();
  });
}

function cancelBody(response) {
  try { Promise.resolve(response.body?.cancel?.()).catch(() => {}); } catch { /* Best-effort cleanup. */ }
}

function decodeEntities(value) {
  return value.replace(/&(?:#(x[\da-f]+|\d+)|([a-z]+));/gi, (match, number, name) => {
    if (number) {
      const code = number[0].toLowerCase() === 'x' ? Number.parseInt(number.slice(1), 16) : Number.parseInt(number, 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' })[name.toLowerCase()] ?? match;
  });
}

function safeImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  const text = decodeEntities(value).trim();
  if (/[\u0000-\u001f\u007f\\]/.test(text)) return '';
  try {
    const url = new URL(text);
    const authority = text.match(/^https:\/\/([^/?#]+)/i)?.[1];
    const host = url.hostname.toLowerCase();
    const ip = host.replace(/^\[|\]$/g, '');
    if (!authority || authority.includes(':') || url.protocol !== 'https:' || url.username || url.password || url.port || isIP(ip) || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host)) return '';
    if (/(?:^|[/_.-])(?:favicon|wordmark|logo)(?:[/_.-]|$)/i.test(url.pathname)) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

function imageFromHtml(html) {
  const stripped = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)\s*>/gi, '');
  const found = new Map();
  for (const tag of stripped.matchAll(/<meta\b[^>]{0,8192}>/gi)) {
    const attrs = {};
    for (const attr of tag[0].matchAll(/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
      attrs[attr[1].toLowerCase()] = attr[2] ?? attr[3] ?? attr[4];
    }
    const name = (attrs.property || attrs.name || '').toLowerCase();
    if (!['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'].includes(name)) continue;
    const image = safeImageUrl(attrs.content);
    if (image && !found.has(name)) found.set(name, image);
  }
  return found.get('og:image:secure_url') || found.get('og:image') || found.get('twitter:image') || found.get('twitter:image:src') || '';
}

async function boundedHtml(response, signal) {
  const contentType = response.headers?.get?.('content-type');
  if (contentType && !/^(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)) return '';
  if (!response.body?.getReader) {
    if (typeof response.text !== 'function') return '';
    return (await abortable(response.text(), signal)).slice(0, maxHtmlBytes);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let html = '';
  try {
    while (bytes < maxHtmlBytes) {
      const { value, done } = await abortable(reader.read(), signal);
      if (done) break;
      const chunk = value.subarray(0, maxHtmlBytes - bytes);
      bytes += chunk.byteLength;
      html += decoder.decode(chunk, { stream: true });
      if (bytes >= maxHtmlBytes) break;
    }
    return html + decoder.decode();
  } finally {
    // Cancel the remainder after a bounded prefix or caller cancellation.
    // A misbehaving adapter must not delay an already-canceled parent request.
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** Resolve public preview images only. No media, account cookies, or API key is used. */
export function createThumbnailService({ fetchImpl = globalThis.fetch } = {}) {
  const cache = new Map();

  async function resolve(url, { title = '', description = '', signal } = {}) {
    throwIfAborted(signal);
    const link = parseVideoLink(url);
    const artwork = coverArtworkFor({ title, description });
    if (link.source === 'youtube') return { thumbnail: `https://i.ytimg.com/vi/${link.contentId}/hqdefault.jpg`, artwork };
    const saved = cache.get(link.url);
    if (saved && saved.until > Date.now()) return { thumbnail: saved.thumbnail, artwork };
    if (saved) cache.delete(link.url);
    const timedSignal = AbortSignal.timeout(4000);
    const combinedSignal = signal ? AbortSignal.any([signal, timedSignal]) : timedSignal;
    let thumbnail = '';
    try {
      // Netflix's public title page is more useful than its signed-in /watch route.
      let currentUrl = link.source === 'netflix' ? `https://www.netflix.com/title/${link.contentId}` : link.url;
      for (let redirects = 0; redirects <= 2; redirects += 1) {
        const response = await abortable(fetchImpl(currentUrl, {
          method: 'GET', redirect: 'manual', signal: combinedSignal,
          headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'NestFamilyLibrary/0.1 (public video preview metadata)' },
        }), combinedSignal);
        throwIfAborted(combinedSignal);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers?.get?.('location');
          cancelBody(response);
          if (!location || redirects === 2) break;
          const destination = new URL(location, currentUrl);
          if (destination.protocol !== 'https:') break;
          const redirected = parseVideoLink(destination.href);
          if (redirected.source !== link.source || redirected.contentId !== link.contentId) break;
          // Keep a validated regional path; canonicalization can remove the locale.
          destination.hash = '';
          currentUrl = destination.href;
          continue;
        }
        if (!response.ok) { cancelBody(response); break; }
        thumbnail = imageFromHtml(await boundedHtml(response, combinedSignal));
        throwIfAborted(combinedSignal);
        break;
      }
    } catch {
      // Missing/restricted service pages still have an original Nest artwork cover.
      throwIfAborted(signal);
    }
    throwIfAborted(signal);
    if (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
    cache.set(link.url, { thumbnail, until: Date.now() + (thumbnail ? successAge : failureAge) });
    return { thumbnail, artwork };
  }

  return { resolve };
}
