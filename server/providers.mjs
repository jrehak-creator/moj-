/** Provider adapters recognize public content links; they do not grant playback access. */
export const streamingServices = [
  { id: 'youtube', name: 'YouTube', domains: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'] },
  { id: 'netflix', name: 'Netflix', domains: ['netflix.com', 'www.netflix.com'] },
  { id: 'disney', name: 'Disney+', domains: ['disneyplus.com', 'www.disneyplus.com'] },
  { id: 'prime', name: 'Prime Video', domains: ['primevideo.com', 'www.primevideo.com', 'amazon.de', 'www.amazon.de', 'amazon.co.uk', 'www.amazon.co.uk', 'amazon.fr', 'www.amazon.fr', 'amazon.it', 'www.amazon.it', 'amazon.es', 'www.amazon.es'] },
  { id: 'max', name: 'HBO Max', domains: ['max.com', 'www.max.com', 'play.max.com', 'hbomax.com', 'www.hbomax.com', 'play.hbomax.com'] },
];

const locale = '(?:[a-z]{2}(?:-[a-z]{2})?/)?';
const maxLocale = '(?:[a-z]{2}(?:/[a-z]{2}|-[a-z]{2})?/)?';
const primeLocale = '(?:(?:-/[a-z]{2}|[a-z]{2}(?:-[a-z]{2})?)/)?';
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const slug = '[a-z0-9][a-z0-9_-]{0,179}';
const netflixPath = new RegExp(`^/${locale}(title|watch)/(\\d{4,16})/?$`, 'i');
const disneyTitlePath = new RegExp(`^/${locale}(series|movies)/${slug}/([a-z0-9]{12,40}|${uuid})/?$`, 'i');
const disneyVideoPath = new RegExp(`^/${locale}video/(${uuid})/?$`, 'i');
const disneyBrowsePath = new RegExp(`^/${locale}browse/(?:entity-)?(${uuid})/?$`, 'i');
const maxTitlePath = new RegExp(`^/${maxLocale}(movies|shows)/${slug}/(${uuid})/?$`, 'i');
const maxVideoPath = new RegExp(`^/${maxLocale}(?:video/watch|playback)/(${uuid})/?$`, 'i');
const primeId = '(?:[A-Z0-9]{10}|[A-Za-z0-9]{12,40})';
const primePath = new RegExp(`^/${primeLocale}detail/(?:${slug}/)?(${primeId})/?$`, 'i');
const amazonPath = /^\/gp\/video\/detail\/([A-Z0-9]{10})\/?$/;

function invalid(message = 'Enter a supported video link.') {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

function parsedUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(input)) invalid();
  const value = input.trim();
  let parsed;
  try { parsed = new URL(value); } catch { invalid('Enter a valid video link.'); }
  const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
  if (!authority || !['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.port || authority.includes(':')) {
    invalid('Use an HTTP or HTTPS content link without credentials or a custom port.');
  }
  return parsed;
}

function result(service, url, contentId, kind) {
  return { source: service.id, providerName: service.name, url, contentId, kind };
}

/** Canonicalize one supported title/video URL without opening the supplied URL. */
export function parseVideoLink(input) {
  const parsed = parsedUrl(input);
  const service = streamingServices.find(item => item.domains.includes(parsed.hostname.toLowerCase()));
  if (!service) invalid('Supported services are YouTube, Netflix, Disney+, Prime Video, and HBO Max.');

  if (service.id === 'youtube') {
    let contentId;
    if (parsed.hostname === 'youtu.be') contentId = parsed.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    else if (/^\/watch\/?$/.test(parsed.pathname) && parsed.searchParams.getAll('v').length === 1) contentId = parsed.searchParams.get('v');
    else contentId = parsed.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
    if (!contentId || !/^[A-Za-z0-9_-]{11}$/.test(contentId)) invalid('Use a link to one YouTube video, rather than a channel or playlist.');
    return result(service, `https://www.youtube.com/watch?v=${contentId}`, contentId, 'video');
  }

  if (service.id === 'netflix') {
    const match = parsed.pathname.match(netflixPath);
    if (!match) invalid('Use a Netflix title or watch link, such as netflix.com/watch/80049832. Netflix shortened links need the full title URL.');
    const route = match[1].toLowerCase();
    return result(service, `https://www.netflix.com/${route}/${match[2]}`, match[2], route === 'watch' ? 'video' : 'title');
  }

  if (service.id === 'disney') {
    const title = parsed.pathname.match(disneyTitlePath);
    const video = parsed.pathname.match(disneyVideoPath);
    const browse = parsed.pathname.match(disneyBrowsePath);
    if (!title && !video && !browse) invalid('Use a Disney+ movie, series, video, or individual browse/entity title link.');
    const contentId = title?.[2] || video?.[1] || browse[1];
    const kind = title ? (title[1].toLowerCase() === 'movies' ? 'movie' : 'series') : video ? 'video' : 'title';
    return result(service, `https://www.disneyplus.com${parsed.pathname.replace(/\/$/, '')}`, contentId, kind);
  }

  if (service.id === 'prime') {
    const match = ['primevideo.com', 'www.primevideo.com'].includes(parsed.hostname) ? parsed.pathname.match(primePath) : parsed.pathname.match(amazonPath);
    if (!match || !/^(?:[A-Z0-9]{10}|[A-Za-z0-9]{12,40})$/.test(match[1])) invalid('Use a Prime Video detail link or an Amazon /gp/video/detail/ link. Retail product, home, and search links are not supported.');
    return result(service, `https://www.primevideo.com/detail/${match[1]}`, match[1], 'title');
  }

  const title = parsed.pathname.match(maxTitlePath);
  const video = parsed.pathname.match(maxVideoPath);
  if (!title && !video) invalid('Use an HBO Max movie, show, or individual playback link.');
  const contentId = title?.[2] || video[1];
  const kind = title ? (title[1].toLowerCase() === 'movies' ? 'movie' : 'series') : 'video';
  // Preserve the original Max brand/player host and locale: redirects differ by country.
  return result(service, `https://${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}`, contentId, kind);
}

/** Keep the library's existing two-field normalization contract. */
export function normalizeVideoUrl(input) {
  const { source, url } = parseVideoLink(input);
  return { source, url };
}

function textField(value, maxLength) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength) : '';
}

function thumbnailUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.')) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

/** Import public YouTube metadata only; paid-service links require parent-supplied details. */
export async function analyzeVideoLink(input, { fetchImpl = globalThis.fetch } = {}) {
  const link = parseVideoLink(input);
  const metadata = {
    status: link.source === 'youtube' ? 'unavailable' : 'manual',
    title: '', description: '', creator: '', thumbnail: '', durationSeconds: null,
    originUrl: null, fetchedAt: null,
  };
  const warnings = [
    'Recognizing this link does not verify Czech availability, your subscription, a price, or playback permission.',
    'A content identifier does not contain the runtime. Nest cannot infer episode length, skip an intro, or detect playback ending from this link.',
  ];

  if (link.source === 'youtube') {
    try {
      const endpoint = new URL('https://www.youtube.com/oembed');
      endpoint.searchParams.set('url', link.url);
      endpoint.searchParams.set('format', 'json');
      const response = await fetchImpl(endpoint.href, { redirect: 'error', signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Metadata unavailable');
      const data = await response.json();
      const title = textField(data?.title, 200);
      if (!title) throw new Error('Metadata missing title');
      Object.assign(metadata, {
        status: 'fetched', title, creator: textField(data.author_name, 160), thumbnail: thumbnailUrl(data.thumbnail_url),
        originUrl: link.url, fetchedAt: new Date().toISOString(),
      });
    } catch {
      warnings.push('Public YouTube metadata could not be retrieved. Enter the title and other details manually.');
    }
    warnings.push('YouTube has an official embedded player API. Nest has not implemented that player; ads and navigation limitations still apply.');
  } else {
    warnings.push(`${link.providerName} metadata requires a licensed catalog integration or manual entry. Enter the title, thumbnail, and runtime yourself.`);
    warnings.push('This link is a parent reference. Nest has no provider player integration or control over this service’s app.');
  }

  return {
    ...link,
    metadata,
    integration: { providerPlayerApi: link.source === 'youtube', inAppPlaybackImplemented: false, durationAvailable: metadata.durationSeconds !== null },
    warnings,
  };
}
