import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeVideoLink, normalizeVideoUrl, parseVideoLink, streamingServices } from './providers.mjs';

const videoId = 'nr5Pj6GQL2o';
const entityId = '7c8e0f11-1111-4222-8333-123456789abc';
const rejectsLink = input => assert.throws(() => parseVideoLink(input), error => error.status === 400);

test('service registry exposes five named providers and exact allowed domains', () => {
  assert.deepEqual(streamingServices.map(service => service.id), ['youtube', 'netflix', 'disney', 'prime', 'max']);
  assert.equal(new Set(streamingServices.map(service => service.name)).size, 5);
  for (const service of streamingServices) {
    assert.ok(service.domains.length > 0);
    assert.ok(service.domains.every(domain => !domain.includes('*') && !domain.includes('/')));
  }
});

test('YouTube aliases identify one video and remove playlists, timestamps, and tracking', () => {
  const expected = { source: 'youtube', providerName: 'YouTube', url: `https://www.youtube.com/watch?v=${videoId}`, contentId: videoId, kind: 'video' };
  for (const url of [
    `https://youtu.be/${videoId}?si=tracking`,
    `http://youtube.com/watch?v=${videoId}&list=PLlist&t=38#fragment`,
    `https://m.youtube.com/shorts/${videoId}?feature=share`,
    `https://www.youtube.com/live/${videoId}/`,
    `https://www.youtube.com/embed/${videoId}?autoplay=1`,
  ]) assert.deepEqual(parseVideoLink(url), expected);
  assert.deepEqual(normalizeVideoUrl(expected.url), { source: 'youtube', url: expected.url });
});

test('Netflix retains an exact watch link and distinguishes a general title', () => {
  assert.deepEqual(parseVideoLink('https://netflix.com/cz-en/watch/81361080?trackId=284725014'), {
    source: 'netflix', providerName: 'Netflix', url: 'https://www.netflix.com/watch/81361080', contentId: '81361080', kind: 'video',
  });
  const title = parseVideoLink('https://www.netflix.com/en-CZ/title/80049832/');
  assert.equal(title.url, 'https://www.netflix.com/title/80049832');
  assert.equal(title.kind, 'title');
  assert.equal(title.contentId, '80049832');
  for (const path of ['/t/abc123', '/browse', '/browse/80049832', '/watch/81361080/other', '/login']) rejectsLink(`https://netflix.com${path}`);
});

test('Disney+ supports legacy series/movie links and modern entity/video identifiers', () => {
  assert.deepEqual(parseVideoLink('https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r?distributionPartner=share'), {
    source: 'disney', providerName: 'Disney+', url: 'https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r', contentId: '1xy9TAOQ0M3r', kind: 'series',
  });
  assert.equal(parseVideoLink('https://disneyplus.com/en-cz/movies/toy-story/1YeZnzUjV5wD/').kind, 'movie');
  assert.equal(parseVideoLink(`https://disneyplus.com/movies/toy-story/${entityId}`).contentId, entityId);
  for (const route of [`/browse/entity-${entityId}`, `/en-cz/browse/${entityId}`]) {
    const link = parseVideoLink(`https://disneyplus.com${route}?ref=share`);
    assert.equal(link.contentId, entityId);
    assert.equal(link.kind, 'title');
    assert.equal(link.url, `https://www.disneyplus.com${route}`);
  }
  assert.equal(parseVideoLink(`https://disneyplus.com/video/${entityId}`).kind, 'video');
  for (const path of ['/browse', '/browse/search', '/browse/entity-made-up', '/series/bluey', '/movies/anything/anything', `/video/${entityId}/more`]) rejectsLink(`https://disneyplus.com${path}`);
});

test('Prime Video canonicalizes service and Amazon video links without accepting retail products', () => {
  for (const url of [
    'https://primevideo.com/detail/B08N5WRWNW?ref_=share',
    'https://www.primevideo.com/detail/title-name/B08N5WRWNW/',
    'https://www.primevideo.com/-/cs/detail/B08N5WRWNW?ref_=share',
    'https://primevideo.com/-/en/detail/title-name/B08N5WRWNW/',
    'https://www.amazon.de/gp/video/detail/B08N5WRWNW?ref=share',
    'https://amazon.co.uk/gp/video/detail/B08N5WRWNW/',
    'https://amazon.fr/gp/video/detail/B08N5WRWNW',
    'https://www.amazon.it/gp/video/detail/B08N5WRWNW',
    'https://www.amazon.es/gp/video/detail/B08N5WRWNW',
  ]) assert.deepEqual(parseVideoLink(url), { source: 'prime', providerName: 'Prime Video', url: 'https://www.primevideo.com/detail/B08N5WRWNW', contentId: 'B08N5WRWNW', kind: 'title' });
  assert.equal(parseVideoLink('https://www.primevideo.com/en/detail/0ABCdef123456789').contentId, '0ABCdef123456789');
  assert.equal(parseVideoLink('https://www.primevideo.com/-/cs/detail/0ABCdef123456789').contentId, '0ABCdef123456789');
  for (const url of ['https://amazon.de/dp/B08N5WRWNW', 'https://primevideo.com/storefront', 'https://primevideo.com/detail/search', 'https://primevideo.com/detail/b08n5wrwnw', 'https://primevideo.com/detail/B08N5WRWNW/other', 'https://primevideo.com/-/cs/search', 'https://primevideo.com/-/en/browse', 'https://primevideo.com/-/cs/detail/search', 'https://primevideo.com/-/czech/detail/B08N5WRWNW', 'https://primevideo.com/cz/cs/detail/B08N5WRWNW']) rejectsLink(url);
});

test('HBO Max accepts known brand/player hosts and individual movie/show/playback routes', () => {
  for (const [host, path, kind] of [
    ['www.hbomax.com', `/cz/cs/movies/film/${entityId}`, 'movie'],
    ['play.hbomax.com', `/cz/cs/shows/show-name/${entityId}`, 'series'],
    ['www.hbomax.com', `/cs-cz/movies/film/${entityId}`, 'movie'],
    ['max.com', `/shows/show-name/${entityId}`, 'series'],
    ['play.max.com', `/video/watch/${entityId}`, 'video'],
    ['play.max.com', `/cz/cs/video/watch/${entityId}`, 'video'],
    ['play.hbomax.com', `/playback/${entityId}`, 'video'],
    ['play.hbomax.com', `/cz/cs/playback/${entityId}`, 'video'],
  ]) {
    const link = parseVideoLink(`https://${host}${path}?tracking=1`);
    assert.equal(link.source, 'max');
    assert.equal(link.providerName, 'HBO Max');
    assert.equal(link.contentId, entityId);
    assert.equal(link.kind, kind);
    assert.equal(link.url, `https://${host}${path}`);
  }
  for (const path of ['/browse', '/search', '/shows/name', `/shows/name/${entityId}/episodes`, '/playback/not-a-video', '/cz/cs/browse', '/cz/cs/search', `/cz/cs/shows/name/${entityId}/episodes`, `/cz/czech/movies/film/${entityId}`, `/cz/cs/en/movies/film/${entityId}`]) rejectsLink(`https://max.com${path}`);
});

test('invalid and hostile inputs are rejected with HTTP 400 before any metadata request', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw new Error('Must not fetch'); };
  for (const input of [
    undefined, {}, '', 'x'.repeat(2049),
    'javascript:alert(1)', 'data:text/html,example', 'file:///tmp/private',
    'https://localhost/watch?v=nr5Pj6GQL2o', 'https://127.0.0.1/watch?v=nr5Pj6GQL2o',
    'https://youtube.com.evil.test/watch?v=nr5Pj6GQL2o', 'https://evil.test/youtube.com/watch?v=nr5Pj6GQL2o',
    'https://user:password@youtube.com/watch?v=nr5Pj6GQL2o',
    'https://youtube.com:443/watch?v=nr5Pj6GQL2o', 'https://youtube.com:8080/watch?v=nr5Pj6GQL2o',
    'https://youtube.com\\@evil.test/watch?v=nr5Pj6GQL2o',
    'https://www.youtube.com/watch?v=short', 'https://youtube.com/watch?v=nr5Pj6GQL2o&v=AAAAAAAAAAA',
    'https://youtu.be/nr5Pj6GQL2o/other', 'https://youtube.com/playlist?list=PL123',
    'https://www.youtube.com/channel/nr5Pj6GQL2o', 'https://www.youtube.com/watch?v=nr5Pj6GQL2o\n',
    'https://netflix.com.evil.test/title/80049832', 'https://video.disneyplus.com/browse',
    'https://amazon.de.evil.test/gp/video/detail/B08N5WRWNW', 'https://foo.max.com/playback/' + entityId,
  ]) await assert.rejects(analyzeVideoLink(input, { fetchImpl }), error => error.status === 400);
  assert.equal(calls, 0);
});

test('paid-provider analysis uses manual metadata without contacting or scraping its URL', async () => {
  for (const url of [
    'https://netflix.com/watch/81361080',
    'https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r',
    'https://www.primevideo.com/detail/B08N5WRWNW',
    `https://max.com/shows/show/${entityId}`,
  ]) {
    const analysis = await analyzeVideoLink(url, { fetchImpl: () => { assert.fail('Paid services must not be scraped'); } });
    assert.deepEqual(analysis.metadata, { status: 'manual', title: '', description: '', creator: '', thumbnail: '', durationSeconds: null, originUrl: null, fetchedAt: null });
    assert.deepEqual(analysis.integration, { providerPlayerApi: false, inAppPlaybackImplemented: false, durationAvailable: false });
    assert.ok(analysis.warnings.some(warning => warning.includes('Czech availability')));
    assert.ok(analysis.warnings.some(warning => warning.includes('identifier does not contain the runtime')));
  }
});

test('YouTube metadata fetch uses one fixed HTTPS oEmbed endpoint and imports bounded fields', async () => {
  const calls = [];
  const analysis = await analyzeVideoLink(`https://youtu.be/${videoId}?next=http://127.0.0.1/private`, {
    fetchImpl: async (url, options) => {
      calls.push({ url: new URL(url), options });
      return { ok: true, json: async () => ({ title: '  A safe\nvideo  ', author_name: 'Creator', thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, duration: 120 }) };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.origin + calls[0].url.pathname, 'https://www.youtube.com/oembed');
  assert.equal(calls[0].url.searchParams.get('url'), `https://www.youtube.com/watch?v=${videoId}`);
  assert.equal(calls[0].url.searchParams.get('format'), 'json');
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(analysis.metadata.status, 'fetched');
  assert.equal(analysis.metadata.title, 'A safe video');
  assert.equal(analysis.metadata.creator, 'Creator');
  assert.equal(analysis.metadata.originUrl, analysis.url);
  assert.ok(!Number.isNaN(Date.parse(analysis.metadata.fetchedAt)));
  assert.equal(analysis.metadata.durationSeconds, null);
  assert.deepEqual(analysis.integration, { providerPlayerApi: true, inAppPlaybackImplemented: false, durationAvailable: false });
});

test('bad YouTube responses fall back without inventing metadata or rejecting the link', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('Fetch failed'); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error('Invalid JSON'); } }),
    async () => ({ ok: true, json: async () => ({ title: 123, author_name: 'Creator' }) }),
    async () => ({ ok: true, json: async () => null }),
  ]) {
    const result = await analyzeVideoLink(`https://youtu.be/${videoId}`, { fetchImpl });
    assert.equal(result.contentId, videoId);
    assert.deepEqual(result.metadata, { status: 'unavailable', title: '', description: '', creator: '', thumbnail: '', durationSeconds: null, originUrl: null, fetchedAt: null });
    assert.ok(result.warnings.some(warning => warning.includes('manually')));
  }
});

test('YouTube metadata never copies unsafe thumbnails and bounds provider text', async () => {
  for (const thumbnail of ['javascript:alert(1)', 'data:image/svg+xml,bad', 'http://image.example/a.jpg', 'https://user:pass@image.example/a.jpg', 'not a URL']) {
    const { metadata } = await analyzeVideoLink(`https://youtu.be/${videoId}`, {
      fetchImpl: async () => ({ ok: true, json: async () => ({ title: 'x'.repeat(1000), author_name: 'y'.repeat(1000), thumbnail_url: thumbnail }) }),
    });
    assert.equal(metadata.status, 'fetched');
    assert.equal(metadata.title.length, 200);
    assert.equal(metadata.creator.length, 160);
    assert.equal(metadata.thumbnail, '');
  }
});
