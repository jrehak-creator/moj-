import test from 'node:test';
import assert from 'node:assert/strict';
import { createThumbnailService } from './thumbnails.mjs';
import { coverArtworkFor } from '../shared/covers.mjs';

const netflix = 'https://www.netflix.com/watch/81361080';
const disney = 'https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r';
const prime = 'https://www.primevideo.com/detail/0ABCDEF1234567';
const max = 'https://www.max.com/cz/cs/movies/example/12345678-1234-1234-1234-123456789abc';
const image = 'https://images.publiccdn.com/video.jpg';
const html = text => new Response(text, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

test('YouTube thumbnails need no metadata request or API key and preserve a theme fallback', async () => {
  let calls = 0;
  const service = createThumbnailService({ fetchImpl: async () => { calls += 1; throw new Error('Unexpected fetch'); } });
  assert.deepEqual(await service.resolve('https://youtu.be/nr5Pj6GQL2o?feature=share', { description: 'A space adventure' }), {
    thumbnail: 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg', artwork: 'space',
  });
  assert.equal(calls, 0);
});

test('paid providers use public official content pages and import OpenGraph or Twitter images', async () => {
  for (const url of [netflix, disney, prime, max]) {
    const calls = [];
    const service = createThumbnailService({ fetchImpl: async (endpoint, options) => {
      calls.push({ endpoint, options });
      return html(`<meta content="${image}?a=1&amp;b=2" property="og:image"><meta name='twitter:image' content='https://images.publiccdn.com/twitter.jpg'>`);
    } });
    const cover = await service.resolve(url, { title: 'Gentle animals' });
    assert.equal(cover.thumbnail, `${image}?a=1&b=2`);
    assert.equal(cover.artwork, 'forest');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.redirect, 'manual');
    assert.equal(calls[0].options.headers.Cookie, undefined);
    assert.ok(calls[0].options.signal instanceof AbortSignal);
    assert.equal(calls[0].endpoint, url === netflix ? 'https://www.netflix.com/title/81361080' : url);
  }
  const service = createThumbnailService({ fetchImpl: async () => html(`<META CONTENT='https:&#47;&#47;images.publiccdn.com/t.jpg?a=1&#38;b=2' NAME=twitter:image>`) });
  assert.equal((await service.resolve(disney)).thumbnail, 'https://images.publiccdn.com/t.jpg?a=1&b=2');
});

test('invalid service URLs cannot trigger arbitrary requests and unsafe image URLs are ignored', async () => {
  let calls = 0;
  const service = createThumbnailService({ fetchImpl: async () => { calls += 1; return html(''); } });
  for (const url of ['http://169.254.169.254/latest/meta-data/', 'https://netflix.com.evil.com/title/80049832', 'https://www.netflix.com/login', 'file:///secret']) {
    await assert.rejects(service.resolve(url), error => error.status === 400);
  }
  assert.equal(calls, 0);
  for (const url of ['javascript:alert(1)', 'data:image/png,abc', 'http://images.publiccdn.com/video.jpg', 'https://127.0.0.1/a.jpg', 'https://2130706433/a.jpg', 'https://[::1]/a.jpg', 'https://metadata.google.internal/a.jpg', 'https://user:pass@images.publiccdn.com/a.jpg', 'https://images.publiccdn.com:444/a.jpg', 'https://images.publiccdn.com:443/a.jpg', 'https://images.publiccdn.com/logo.png']) {
    const resolver = createThumbnailService({ fetchImpl: async () => html(`<meta property="og:image" content="${url}">`) });
    assert.equal((await resolver.resolve(netflix)).thumbnail, '', url);
  }
});

test('only same-provider same-content redirects can be followed, with a two-redirect limit', async () => {
  for (const target of ['http://169.254.169.254/latest/meta-data/', 'http://www.netflix.com/title/81361080', 'https://www.netflix.com/login', 'https://www.youtube.com/watch?v=nr5Pj6GQL2o', 'https://www.netflix.com/title/80049832']) {
    let calls = 0;
    const service = createThumbnailService({ fetchImpl: async () => { calls += 1; return new Response(null, { status: 302, headers: { Location: target } }); } });
    assert.equal((await service.resolve(netflix)).thumbnail, '');
    assert.equal(calls, 1, target);
  }
  let calls = 0;
  const service = createThumbnailService({ fetchImpl: async endpoint => {
    calls += 1;
    if (calls === 2) assert.equal(endpoint, 'https://www.netflix.com/cz-en/title/81361080');
    return calls === 1 ? new Response(null, { status: 302, headers: { Location: '/cz-en/title/81361080' } }) : html(`<meta property=og:image content="${image}">`);
  } });
  assert.equal((await service.resolve(netflix)).thumbnail, image);
  assert.equal(calls, 2);
  let loopCalls = 0;
  const loop = createThumbnailService({ fetchImpl: async () => { loopCalls += 1; return new Response(null, { status: 302, headers: { Location: '/title/81361080' } }); } });
  assert.equal((await loop.resolve(netflix)).thumbnail, '');
  assert.equal(loopCalls, 3);
});

test('HTML reading stops at 512 KiB and cancels the remaining stream', async () => {
  let canceled = false;
  let chunks = 0;
  const service = createThumbnailService({ fetchImpl: async () => new Response(new ReadableStream({
    pull(controller) {
      chunks += 1;
      controller.enqueue(new TextEncoder().encode(chunks === 1 ? `<meta property="og:image" content="${image}">${'a'.repeat(300000)}` : 'b'.repeat(300000)));
    },
    cancel() { canceled = true; },
  }), { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal((await service.resolve(netflix)).thumbnail, image);
  assert.equal(canceled, true);
  assert.ok(chunks <= 3);
  const afterLimit = createThumbnailService({ fetchImpl: async () => html(`${'a'.repeat(512 * 1024)}<meta property="og:image" content="${image}">`) });
  assert.equal((await afterLimit.resolve(netflix)).thumbnail, '');
});

test('restricted, non-HTML, missing, and failed pages use artwork rather than broken remote images', async () => {
  for (const fetchImpl of [
    async () => new Response('Denied', { status: 403 }),
    async () => new Response(`<meta property="og:image" content="${image}">`, { headers: { 'Content-Type': 'application/json' } }),
    async () => html(`<script>const fake='<meta property="og:image" content="${image}">'</script>`),
    async () => { throw new Error('Offline'); },
  ]) {
    const service = createThumbnailService({ fetchImpl });
    assert.deepEqual(await service.resolve(netflix, { description: 'Ocean dolphins' }), { thumbnail: '', artwork: 'ocean' });
  }
});

test('completed and unavailable images are cached, while fallback artwork remains request-specific', async () => {
  for (const available of [true, false]) {
    let calls = 0;
    const service = createThumbnailService({ fetchImpl: async () => { calls += 1; return html(available ? `<meta property="og:image" content="${image}">` : 'No public image'); } });
    const first = await service.resolve(netflix, { title: 'Space rockets' });
    const second = await service.resolve(netflix, { title: 'Ocean dolphins' });
    assert.equal(first.thumbnail, available ? image : '');
    assert.equal(second.thumbnail, first.thumbnail);
    assert.equal(first.artwork, 'space');
    assert.equal(second.artwork, 'ocean');
    assert.equal(calls, 1);
  }
});

test('caller cancellation is honored before fast paths and after late fetch/body results without caching', async () => {
  const already = new AbortController();
  already.abort();
  let calls = 0;
  const service = createThumbnailService({ fetchImpl: async () => { calls += 1; return html(`<meta property="og:image" content="${image}">`); } });
  await assert.rejects(service.resolve('https://youtu.be/nr5Pj6GQL2o', { signal: already.signal }), { name: 'AbortError' });
  await assert.rejects(service.resolve(netflix, { signal: already.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
  for (const phase of ['fetch', 'body']) {
    const controller = new AbortController();
    let attempts = 0;
    const resolver = createThumbnailService({ fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1 && phase === 'fetch') { controller.abort(); await Promise.resolve(); }
      if (attempts === 1 && phase === 'body') return { ok: true, text: async () => { controller.abort(); return `<meta property="og:image" content="${image}">`; } };
      return html(`<meta property="og:image" content="${image}">`);
    } });
    await assert.rejects(resolver.resolve(netflix, { signal: controller.signal }), { name: 'AbortError' });
    assert.equal((await resolver.resolve(netflix)).thumbnail, image);
    assert.equal(attempts, 2);
  }
});

test('a timeout ends an uncooperative fetch and cache entries expire and remain bounded', async () => {
  const originalTimeout = AbortSignal.timeout;
  const controller = new AbortController();
  AbortSignal.timeout = () => controller.signal;
  try {
    const stalled = createThumbnailService({ fetchImpl: () => new Promise(() => {}) });
    const pending = stalled.resolve(netflix, { description: 'A musical story' });
    controller.abort(new DOMException('Timed out', 'TimeoutError'));
    assert.deepEqual(await pending, { thumbnail: '', artwork: 'music' });
  } finally { AbortSignal.timeout = originalTimeout; }

  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  try {
    let calls = 0;
    const service = createThumbnailService({ fetchImpl: async () => { calls += 1; return html(`<meta property="og:image" content="${image}">`); } });
    await service.resolve(netflix);
    await service.resolve(netflix);
    assert.equal(calls, 1);
    now += 60 * 60 * 1000 + 1;
    await service.resolve(netflix);
    assert.equal(calls, 2);
    for (let index = 0; index < 256; index += 1) await service.resolve(`https://www.netflix.com/title/${80000000 + index}`);
    await service.resolve(netflix);
    assert.equal(calls, 259);
  } finally { Date.now = originalNow; }
});

test('English and Czech descriptions select an illustrated cover with a safe default', () => {
  for (const [description, expected] of [
    ['Příběh o delfínech a mořských rybách', 'ocean'], ['Výlet do vesmíru raketou', 'space'],
    ['Hudba a písničky', 'music'], ['Včely a motýli', 'butterfly'], ['Medvědí rodina', 'bears'],
    ['Our planet Earth', 'earth'], ['Lesní zvířata', 'forest'], ['Toy Story', 'stories'],
    ['More adventures', 'stories'], ['Moře', 'ocean'],
  ]) assert.equal(coverArtworkFor({ description }), expected, description);
  assert.equal(coverArtworkFor(), 'stories');
  assert.equal(coverArtworkFor({ tags: ['marine'] }), 'ocean');
});
