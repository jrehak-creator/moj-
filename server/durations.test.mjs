import test from 'node:test';
import assert from 'node:assert/strict';
import { createDurationService } from './durations.mjs';

const id = 'aqz-KE-bpKQ';
const url = `https://www.youtube.com/watch?v=${id}`;
const otherId = 'nr5Pj6GQL2o';
function html(value, options = {}) { return new Response(value, { headers: { 'Content-Type': 'text/html' }, ...options }); }
function details(seconds, videoId = id) { return JSON.stringify({ videoDetails: { videoId, title: 'A quoted " title { with braces }', thumbnail: { thumbnails: [] }, lengthSeconds: String(seconds) } }); }

test('runtime metadata reads only matching videoDetails, including nested and quoted JSON', async () => {
  const calls = [];
  const service = createDurationService({ youtubeApiKey: '', fetchImpl: async (endpoint, options) => {
    calls.push({ endpoint, options });
    return html(`<script>var unrelated=${details(999, otherId)};var ytInitialPlayerResponse=${details(596)};</script>`);
  } });
  assert.equal(await service.resolve(`https://youtu.be/${id}?feature=share`), 596);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint, url);
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].options.headers.Accept, 'text/html,application/xhtml+xml');
});

test('unrelated recommendations, invalid lengths and live zero-length videos remain unknown', async () => {
  for (const body of [details(999, otherId), details(0), details(-5), details(86401), '<script>{"videoDetails":{"videoId":"aqz-KE-bpKQ","lengthSeconds":"999"</script>', '<html>Consent is required</html>']) {
    const service = createDurationService({ youtubeApiKey: '', fetchImpl: async () => html(body) });
    assert.equal(await service.resolve(url), null);
  }
});

test('JSON-LD and duration meta tags require a matching video identity', async () => {
  const cases = [
    [`<script type="application/ld+json">${JSON.stringify({ '@graph': [{ '@type': 'VideoObject', embedUrl: `https://www.youtube.com/embed/${id}`, duration: 'PT9M56S' }] })}</script>`, 596],
    [`<script type='application/ld+json'>${JSON.stringify([{ '@type': ['Thing', 'VideoObject'], url, duration: 'PT1H2M3S' }])}</script>`, 3723],
    [`<link href="${url}" rel="canonical"><meta content="PT9M56S" itemprop="duration">`, 596],
    [`<meta property="og:url" content="${url}&amp;feature=share"><meta itemprop="duration" content="P1D">`, 86400],
    [`<meta itemprop="duration" content="PT9M56S">`, null],
    [`<link rel="canonical" href="https://www.youtube.com/watch?v=${otherId}"><meta itemprop="duration" content="PT9M56S">`, null],
    [`<script type="application/ld+json">${JSON.stringify({ '@type': 'VideoObject', url: `https://www.youtube.com/watch?v=${otherId}`, duration: 'PT9M56S' })}</script>`, null],
    [`<script type="application/ld+json">${JSON.stringify({ '@type': 'VideoObject', url, duration: 'P' })}</script>`, null],
  ];
  for (const [body, expected] of cases) {
    assert.equal(await createDurationService({ youtubeApiKey: '', fetchImpl: async () => html(body) }).resolve(url), expected);
  }
});

test('optional official API requests only the selected ID and does not fetch watch HTML after success', async () => {
  const calls = [];
  const service = createDurationService({ youtubeApiKey: 'test-only-private-key', fetchImpl: async (endpoint, options) => {
    calls.push({ endpoint: new URL(endpoint), options });
    return Response.json({ items: [{ id: otherId, contentDetails: { duration: 'PT1S' } }, { id, contentDetails: { duration: 'PT9M56S' } }] });
  } });
  assert.equal(await service.resolve(url), 596);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].endpoint.origin, 'https://www.googleapis.com');
  assert.equal(calls[0].endpoint.pathname, '/youtube/v3/videos');
  assert.equal(calls[0].endpoint.searchParams.get('id'), id);
  assert.equal(calls[0].endpoint.searchParams.get('part'), 'contentDetails,status');
  assert.equal(calls[0].endpoint.searchParams.get('key'), 'test-only-private-key');
  assert.equal(calls[0].options.redirect, 'error');
});

test('API rejection or malformed metadata falls back safely to the selected public watch page', async () => {
  for (const apiResponse of [new Response('Private upstream error', { status: 403 }), Response.json({ items: [] }), Response.json({ items: [{ id: otherId, contentDetails: { duration: 'PT1S' } }] }), new Response('not json')]) {
    const calls = [];
    const service = createDurationService({ youtubeApiKey: 'test-only-key', fetchImpl: async endpoint => {
      calls.push(new URL(endpoint).hostname);
      return calls.length === 1 ? apiResponse : html(details(596));
    } });
    assert.equal(await service.resolve(url), 596);
    assert.deepEqual(calls, ['www.googleapis.com', 'www.youtube.com']);
  }
});

test('unsupported URLs fail before fetch and paid services have unknown duration without network calls', async () => {
  let calls = 0;
  const service = createDurationService({ youtubeApiKey: '', fetchImpl: async () => { calls += 1; throw new Error('Unexpected fetch'); } });
  for (const input of ['https://127.0.0.1/video', 'https://www.youtube.com.evil.test/watch?v=aqz-KE-bpKQ', 'https://youtube.com:8443/watch?v=aqz-KE-bpKQ', 'javascript:alert(1)']) await assert.rejects(service.resolve(input), error => error.status === 400);
  assert.equal(await service.resolve('https://www.netflix.com/watch/81361080'), null);
  assert.equal(await service.resolve('https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r'), null);
  assert.equal(calls, 0);
});

test('successful and unavailable public runtimes are cached without sharing canceled requests', async () => {
  for (const value of [details(596), '<html>No duration</html>']) {
    let calls = 0;
    const service = createDurationService({ youtubeApiKey: '', fetchImpl: async () => { calls += 1; return html(value); } });
    const first = await service.resolve(url);
    assert.equal(await service.resolve(`https://youtu.be/${id}`), first);
    assert.equal(calls, 1);
  }
});

test('public HTML is bounded and redirects, wrong types, and transport failures stay unknown', async () => {
  const responses = [
    () => html('x'.repeat(1024 * 1024) + details(596)),
    () => new Response('redirect', { status: 302, headers: { Location: 'https://127.0.0.1/private' } }),
    () => new Response(details(596), { headers: { 'Content-Type': 'video/mp4' } }),
    () => { throw new Error('An upstream detail that must not escape'); },
  ];
  for (const response of responses) {
    let calls = 0;
    const service = createDurationService({ youtubeApiKey: '', fetchImpl: async () => { calls += 1; return response(); } });
    assert.equal(await service.resolve(url), null);
    assert.equal(calls, 1);
  }
});

test('pre-canceled and pending fetch/body requests abort promptly and never cache cancellation', async () => {
  const pre = new AbortController(); pre.abort();
  let calls = 0;
  const service = createDurationService({ youtubeApiKey: '', fetchImpl: async () => { calls += 1; return html(details(596)); } });
  await assert.rejects(service.resolve(url, { signal: pre.signal }), error => error.name === 'AbortError');
  assert.equal(calls, 0);
  for (const pendingBody of [false, true]) {
    let unblock;
    let signal;
    let count = 0;
    const pending = new Promise(resolve => { unblock = resolve; });
    const next = createDurationService({ youtubeApiKey: '', fetchImpl: async (_endpoint, options) => {
      count += 1; signal = options.signal;
      if (count > 1) return html(details(596));
      return pendingBody ? { ok: true, text: () => pending } : pending;
    } });
    const controller = new AbortController();
    const request = next.resolve(url, { signal: controller.signal });
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(request, error => error.name === 'AbortError');
    assert.equal(signal.aborted, true);
    unblock(pendingBody ? details(999) : html(details(999)));
    assert.equal(await next.resolve(url), 596);
    assert.equal(count, 2);
  }
});
