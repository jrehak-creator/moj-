import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, normalizeVideoUrl } from './app.mjs';

async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'nest-test-'));
  const distDir = join(dataDir, 'test-shell');
  await mkdir(distDir);
  await writeFile(join(distDir, 'index.html'), '<!doctype html><main>Test shell</main>');
  const app = await createApp({ dataDir, distDir, durationService: { resolve: async () => null }, thumbnailService: { resolve: async () => ({ thumbnail: '', artwork: 'forest' }) }, ...options });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  let siteCookie = '';
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });
  async function request(path, { method = 'GET', body, parent = false, site = true, headers = {} } = {}) {
    const cookies = [site && siteCookie, parent && cookie].filter(Boolean).join('; ');
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookies ? { Cookie: cookies } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  }
  async function unlockSite(pin = '28756319') {
    const result = await request('/api/access/login', { method: 'POST', body: { pin } });
    assert.equal(result.status, 200);
    siteCookie = result.headers.get('set-cookie').split(';')[0];
    return result;
  }
  async function setup() {
    const result = await request('/api/auth/setup', { method: 'POST', body: { pin: '123456' } });
    assert.equal(result.status, 201);
    cookie = result.headers.get('set-cookie').split(';')[0];
    return result;
  }
  async function upload({ approved = false, content = null, filename = 'Family moment.mp4', type = 'video/mp4' } = {}) {
    const bytes = content ?? Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(100)]);
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), filename);
    const response = await fetch(`${base}/api/uploads`, { method: 'POST', headers: { Cookie: [siteCookie, cookie].filter(Boolean).join('; ') }, body: form });
    const result = { status: response.status, body: await response.json() };
    if (result.status === 201 && approved) {
      const update = await request(`/api/videos/${result.body.video.id}`, { method: 'PATCH', parent: true, body: { approved: true } });
      assert.equal(update.status, 200);
      result.body = update.body;
    }
    return result;
  }
  return { request, setup, upload, unlockSite, base, dataDir, get cookie() { return cookie; }, get siteCookie() { return siteCookie; } };
}

test('first PIN setup replaces illustrative samples and stores a hashed PIN', async t => {
  const f = await fixture(t);
  const demo = await f.request('/api/library');
  assert.equal(demo.body.demo, true);
  assert.equal(demo.body.videos.length, 8);
  assert.equal(demo.body.pinConfigured, false);
  assert.ok(demo.body.videos.every(video => video.description.includes('Illustrative')));
  assert.equal((await f.request('/api/auth/setup', { method: 'POST', body: { pin: '1234' } })).status, 400);
  const setup = await f.setup();
  assert.match(setup.headers.get('set-cookie'), /HttpOnly/);
  assert.match(setup.headers.get('set-cookie'), /SameSite=Strict/);
  const library = await f.request('/api/library', { parent: true });
  assert.deepEqual(library.body, { videos: [], demo: false, pinConfigured: true, parent: true });
  assert.equal((await f.request('/api/auth/setup', { method: 'POST', body: { pin: '987654' } })).status, 409);
  const saved = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  assert.ok(saved.pin.hash);
  assert.ok(saved.pin.salt);
  assert.notEqual(saved.pin.hash, '123456');
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { pin: '987654' } })).status, 401);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { pin: '123456' } })).status, 200);
});

test('parent sessions protect changes and are invalidated by logout', async t => {
  const f = await fixture(t);
  await f.setup();
  for (const [path, method] of [['/api/videos', 'POST'], ['/api/videos/not-real', 'PATCH'], ['/api/videos/not-real', 'DELETE'], ['/api/metadata', 'POST'], ['/api/uploads', 'POST'], ['/api/discovery/config', 'GET'], ['/api/discovery/search', 'POST'], ['/api/links/analyze', 'POST'], ['/api/library/thumbnails', 'POST']]) {
    assert.equal((await f.request(path, { method, ...(method === 'GET' ? {} : { body: {} }) })).status, 401);
  }
  assert.equal((await f.request('/api/metadata', { method: 'POST', parent: true, body: { url: 'https://www.netflix.com/title/80049832' } })).status, 200);
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', parent: true })).status, 200);
  assert.equal((await f.request('/api/library', { parent: true })).body.parent, false);
});

test('streaming selections publish by default and explicit drafts remain private after restart', async t => {
  const f = await fixture(t);
  await f.setup();
  const added = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'Moon reference', url: 'https://youtu.be/nr5Pj6GQL2o', collection: 'Curious minds', tags: ['Space'] } });
  assert.equal(added.status, 201);
  assert.equal(added.body.video.source, 'youtube');
  assert.equal(added.body.video.approved, true);
  assert.equal((await f.request('/api/library')).body.videos.length, 1);
  assert.equal((await f.request('/api/library', { parent: true })).body.videos.length, 1);
  assert.equal((await f.request(`/api/videos/${added.body.video.id}`, { method: 'PATCH', parent: true, body: { approved: false } })).status, 200);
  assert.equal((await f.request('/api/library')).body.videos.length, 0);
  const updated = await f.request(`/api/videos/${added.body.video.id}`, { method: 'PATCH', parent: true, body: { favorite: true, title: 'For later' } });
  assert.equal(updated.body.video.favorite, true);
  const reopened = await createApp({ dataDir: f.dataDir });
  const restarted = reopened.listen(0, '127.0.0.1');
  await new Promise(resolve => restarted.once('listening', resolve));
  t.after(async () => { restarted.closeAllConnections(); await new Promise(resolve => restarted.close(resolve)); });
  const reloaded = await fetch(`http://127.0.0.1:${restarted.address().port}/api/library`).then(response => response.json());
  assert.equal(reloaded.pinConfigured, true);
  assert.equal(reloaded.videos.length, 0);
  const saved = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  assert.equal(saved.videos[0].title, 'For later');
  assert.equal((await f.request(`/api/videos/${added.body.video.id}`, { method: 'DELETE', parent: true })).status, 200);
  assert.equal((await f.request('/api/library', { parent: true })).body.videos.length, 0);
});

test('URL and image validation blocks unsupported protocols, hosts, and mismatched services', async t => {
  const f = await fixture(t);
  await f.setup();
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.test/watch?v=nr5Pj6GQL2o', 'https://127.0.0.1/video', 'https://user:password@youtube.com/watch?v=nr5Pj6GQL2o', 'https://www.youtube.com/channel/example', 'https://www.youtube.com/watch?v=short', 'https://netflix.com/login', 'https://disneyplus.com/login']) {
    assert.throws(() => normalizeVideoUrl(url));
    assert.equal((await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'Video', url } })).status, 400);
  }
  for (const fields of [{ thumbnail: 'data:image/svg+xml,<svg/>' }, { thumbnail: 'javascript:alert(1)' }, { source: 'netflix' }, { artwork: '../secret' }, { duration: -1 }, { approved: 'yes' }, { source: 'upload', mediaUrl: '/media/foo.mp4' }]) {
    assert.equal((await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'Video', url: 'https://www.youtube.com/watch?v=nr5Pj6GQL2o', ...fields } })).status, 400);
  }
  assert.deepEqual(normalizeVideoUrl('https://m.youtube.com/shorts/nr5Pj6GQL2o?feature=share'), { source: 'youtube', url: 'https://www.youtube.com/watch?v=nr5Pj6GQL2o' });
  assert.deepEqual(normalizeVideoUrl('https://www.netflix.com/cz-en/title/80049832?source=share'), { source: 'netflix', url: 'https://www.netflix.com/title/80049832' });
});

test('Netflix selections retain the exact content path and are visible in the child library', async t => {
  const f = await fixture(t);
  await f.setup();
  const playback = 'https://www.netflix.com/watch/80049832';
  assert.deepEqual(normalizeVideoUrl(`${playback}?trackId=123`), { source: 'netflix', url: playback });
  assert.deepEqual(normalizeVideoUrl('https://netflix.com/cz-en/watch/80049832'), { source: 'netflix', url: playback });
  assert.throws(() => normalizeVideoUrl('https://www.netflix.com/watch/80049832/other'));
  assert.throws(() => normalizeVideoUrl('https://www.netflix.com/browse/80049832'));
  const added = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'For an iPad handoff', url: playback } });
  assert.equal(added.status, 201);
  assert.equal(added.body.video.url, playback);
  assert.equal(added.body.video.approved, true);
  assert.equal((await f.request('/api/library')).body.videos.length, 1);
});

test('metadata only fetches the fixed YouTube endpoint and gracefully handles unavailable details', async t => {
  const calls = [];
  const f = await fixture(t, { fetchImpl: async (url, options) => {
    calls.push({ url: String(url), options });
    return { ok: true, json: async () => ({ title: 'Moon tour', author_name: 'A creator', thumbnail_url: 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg' }) };
  } });
  await f.setup();
  const metadata = await f.request('/api/metadata', { method: 'POST', parent: true, body: { url: 'https://youtu.be/nr5Pj6GQL2o' } });
  assert.equal(metadata.status, 200);
  assert.equal(metadata.body.title, 'Moon tour');
  assert.equal(metadata.body.duration, null);
  assert.match(calls[0].url, /^https:\/\/www\.youtube\.com\/oembed\?/);
  assert.equal(calls[0].options.redirect, 'error');
  assert.ok(calls[0].options.signal);
  const netflix = await f.request('/api/metadata', { method: 'POST', parent: true, body: { url: 'https://netflix.com/title/80049832' } });
  assert.equal(netflix.body.title, '');
  assert.ok(netflix.body.warning);
  assert.equal(calls.length, 1);
  assert.equal((await f.request('/api/metadata', { method: 'POST', parent: true, body: { url: 'http://169.254.169.254/latest/meta-data/' } })).status, 400);
  assert.equal(calls.length, 1);

  const offline = await fixture(t, { fetchImpl: async () => { throw new Error('Offline'); } });
  await offline.setup();
  const fallback = await offline.request('/api/metadata', { method: 'POST', parent: true, body: { url: 'https://youtu.be/nr5Pj6GQL2o' } });
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.title, '');
  assert.match(fallback.body.warning, /ručne/);
});

test('draft uploaded media stays private and approved files support byte ranges', async t => {
  const f = await fixture(t);
  await f.setup();
  const uploaded = await f.upload();
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.body));
  const video = uploaded.body.video;
  assert.equal(video.source, 'upload');
  assert.equal(video.approved, false);
  assert.equal(video.title, 'Family moment');
  assert.equal((await f.request('/api/library')).body.videos.length, 0);
  assert.equal((await fetch(`${f.base}${video.mediaUrl}`)).status, 404);
  const parentMedia = await fetch(`${f.base}${video.mediaUrl}`, { headers: { Cookie: f.cookie } });
  assert.equal(parentMedia.status, 200);
  assert.match(parentMedia.headers.get('content-type'), /video\/mp4/);
  assert.equal(parentMedia.headers.get('x-content-type-options'), 'nosniff');
  const approved = await f.request(`/api/videos/${video.id}`, { method: 'PATCH', parent: true, body: { approved: true, duration: 120 } });
  assert.equal(approved.status, 200);
  assert.equal((await f.request('/api/library')).body.videos[0].id, video.id);
  const ranged = await fetch(`${f.base}${video.mediaUrl}`, { headers: { Range: 'bytes=0-11' } });
  assert.equal(ranged.status, 206);
  assert.match(ranged.headers.get('content-range'), /^bytes 0-11\//);
  assert.equal((await ranged.arrayBuffer()).byteLength, 12);
  assert.equal((await f.request(`/api/videos/${video.id}`, { method: 'PATCH', parent: true, body: { mediaUrl: '/media/another.mp4' } })).status, 400);
  await f.request(`/api/videos/${video.id}`, { method: 'PATCH', parent: true, body: { approved: false } });
  assert.equal((await fetch(`${f.base}${video.mediaUrl}`)).status, 404);
  await f.request(`/api/videos/${video.id}`, { method: 'DELETE', parent: true });
  assert.equal((await fetch(`${f.base}${video.mediaUrl}`, { headers: { Cookie: f.cookie } })).status, 404);
});

test('upload rejects spoofed content and unexpected multipart fields', async t => {
  const f = await fixture(t);
  await f.setup();
  const spoofed = await f.upload({ content: Buffer.from('<script>alert(1)</script>') });
  assert.equal(spoofed.status, 400);
  const wrongType = await f.upload({ type: 'text/html' });
  assert.equal(wrongType.status, 400);
  const form = new FormData();
  form.append('anotherField', new Blob(['foo'], { type: 'video/mp4' }), 'test.mp4');
  const result = await fetch(`${f.base}/api/uploads`, { method: 'POST', headers: { Cookie: f.cookie }, body: form });
  assert.equal(result.status, 400);
  assert.equal((await f.request('/api/library', { parent: true })).body.videos.length, 0);
});

test('cross-origin mutations are rejected and PIN guesses are rate limited', async t => {
  const f = await fixture(t);
  assert.equal((await f.request('/api/auth/setup', { method: 'POST', body: { pin: '123456' }, headers: { Origin: 'https://foreign.example' } })).status, 403);
  await f.setup();
  assert.equal((await f.request('/api/auth/logout', { method: 'POST', parent: true, headers: { Origin: 'null' } })).status, 403);
  assert.equal((await f.request('/api/metadata', { method: 'POST', parent: true, body: { url: 'https://netflix.com/title/80049832' }, headers: { Origin: f.base } })).status, 200);
  for (let i = 0; i < 8; i += 1) assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { pin: '999999' } })).status, 401);
  const blocked = await f.request('/api/auth/login', { method: 'POST', body: { pin: '123456' } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
});

test('simultaneous additions persist without losing updates', async t => {
  const f = await fixture(t);
  await f.setup();
  const results = await Promise.all(Array.from({ length: 6 }, (_, i) => f.request('/api/videos', { method: 'POST', parent: true, body: { title: `Reference ${i}`, url: 'https://youtu.be/nr5Pj6GQL2o' } })));
  assert.ok(results.every(result => result.status === 201));
  const saved = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  assert.equal(saved.videos.length, 6);
  assert.equal(new Set(saved.videos.map(video => video.id)).size, 6);
});

test('site access stays optional for local use and becomes required when a PIN is configured', async t => {
  const local = await fixture(t, { siteAccessPin: undefined, requireSiteAccess: false });
  assert.deepEqual((await local.request('/api/access')).body, { required: false, authenticated: true });
  assert.equal((await local.request('/api/library')).status, 200);
  const gated = await fixture(t, { publicChildView: false, siteAccessPin: '28756319', requireSiteAccess: false });
  assert.deepEqual((await gated.request('/api/access')).body, { required: true, authenticated: false });
  assert.equal((await gated.request('/api/library')).status, 401);
});

test('required site access fails closed at startup when the deployment PIN is missing or invalid', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'nest-invalid-site-pin-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  for (const siteAccessPin of [undefined, '', '1234567', '1234567890123', 'abcdefgh', 12345678]) {
    await assert.rejects(createApp({ dataDir, siteAccessPin, requireSiteAccess: true }), /SITE_ACCESS_PIN to contain 8–12 digits/);
  }
  await assert.rejects(readFile(join(dataDir, 'library.json')), { code: 'ENOENT' });
});

test('a locked public site exposes only access status, health, and the application shell', async t => {
  const f = await fixture(t, { publicChildView: false, siteAccessPin: '28756319', requireSiteAccess: true });
  assert.deepEqual((await f.request('/api/health')).body, { ok: true });
  assert.deepEqual((await f.request('/api/access')).body, { required: true, authenticated: false });
  for (const [path, method] of [
    ['/api/library', 'GET'], ['/media/00000000-0000-0000-0000-000000000000.mp4', 'GET'],
    ['/api/auth/setup', 'POST'], ['/api/auth/login', 'POST'], ['/api/auth/logout', 'POST'],
    ['/api/metadata', 'POST'], ['/api/uploads', 'POST'], ['/api/discovery/config', 'GET'], ['/api/discovery/search', 'POST'], ['/api/links/analyze', 'POST'], ['/api/library/thumbnails', 'POST'], ['/api/videos', 'POST'],
    ['/api/videos/not-real', 'PATCH'], ['/api/videos/not-real', 'DELETE'], ['/api/unknown', 'GET'],
  ]) {
    const result = await f.request(path, { method, ...(method !== 'GET' ? { body: { pin: '123456' } } : {}) });
    assert.equal(result.status, 401, `${method} ${path}`);
    assert.deepEqual(Object.keys(result.body), ['error']);
    assert.equal(result.headers.get('cache-control'), 'no-store');
  }
  for (const path of ['/', '/library', '/discover']) {
    const shell = await fetch(`${f.base}${path}`, { headers: { Accept: 'text/html' } });
    assert.equal(shell.status, 200);
    assert.equal(shell.headers.get('cache-control'), 'no-store');
    assert.match(await shell.text(), /Test shell/);
  }
  assert.equal((await f.request('/api/access/login', { method: 'POST', body: { pin: '1234' } })).status, 400);
  assert.equal((await f.request('/api/access/login', { method: 'POST', body: { pin: '99999999' } })).status, 401);
  const unlocked = await f.unlockSite();
  assert.deepEqual(unlocked.body, { required: true, authenticated: true });
  assert.match(unlocked.headers.get('set-cookie'), /^nest_access=/);
  assert.match(unlocked.headers.get('set-cookie'), /HttpOnly/);
  assert.match(unlocked.headers.get('set-cookie'), /SameSite=Strict/);
  assert.deepEqual((await f.request('/api/access')).body, { required: true, authenticated: true });
  const library = await f.request('/api/library');
  assert.equal(library.status, 200);
  assert.equal(library.body.parent, false);
  assert.equal(library.body.pinConfigured, false);
  assert.equal((await f.request('/api/videos', { method: 'POST', body: {} })).status, 401);
  const saved = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  assert.equal(JSON.stringify(saved).includes('28756319'), false);
});

test('site sessions guard approved media, survive parent logout, and full logout invalidates both sessions', async t => {
  const f = await fixture(t, { publicChildView: false, siteAccessPin: '28756319', requireSiteAccess: true });
  await f.unlockSite();
  await f.setup();
  const uploaded = await f.upload({ approved: true });
  assert.equal(uploaded.status, 201);
  const mediaUrl = uploaded.body.video.mediaUrl;
  assert.equal((await fetch(`${f.base}${mediaUrl}`)).status, 401);
  assert.equal((await fetch(`${f.base}${mediaUrl}`, { headers: { Cookie: f.cookie } })).status, 401);
  assert.equal((await fetch(`${f.base}${mediaUrl}`, { headers: { Cookie: f.siteCookie } })).status, 200);
  assert.equal((await f.request('/api/library', { parent: true, site: false })).status, 401);

  const parentLogout = await f.request('/api/auth/logout', { method: 'POST', parent: true });
  assert.equal(parentLogout.status, 200);
  assert.match(parentLogout.headers.get('set-cookie'), /^nest_parent=/);
  assert.doesNotMatch(parentLogout.headers.get('set-cookie'), /nest_access=/);
  assert.equal((await f.request('/api/access')).body.authenticated, true);
  assert.equal((await f.request('/api/library', { parent: true })).body.parent, false);

  const parentLogin = await f.request('/api/auth/login', { method: 'POST', body: { pin: '123456' } });
  assert.equal(parentLogin.status, 200);
  const parentCookie = parentLogin.headers.get('set-cookie').split(';')[0];
  const priorCookies = `${f.siteCookie}; ${parentCookie}`;
  assert.equal((await f.request('/api/library', { headers: { Cookie: priorCookies } })).body.parent, true);
  const siteLogout = await f.request('/api/access/logout', { method: 'POST', headers: { Cookie: priorCookies } });
  assert.deepEqual(siteLogout.body, { required: true, authenticated: false });
  const clearedCookies = siteLogout.headers.getSetCookie();
  assert.equal(clearedCookies.length, 2);
  assert.ok(clearedCookies.some(value => value.startsWith('nest_access=;')));
  assert.ok(clearedCookies.some(value => value.startsWith('nest_parent=;')));
  assert.equal((await f.request('/api/library', { headers: { Cookie: priorCookies } })).status, 401);
  assert.equal((await f.request('/api/access', { headers: { Cookie: priorCookies } })).body.authenticated, false);
  await f.unlockSite();
  assert.equal((await f.request('/api/library', { headers: { Cookie: `${f.siteCookie}; ${parentCookie}` } })).body.parent, false);
});

test('access PIN guessing is rate limited separately from parent PIN authentication', async t => {
  const f = await fixture(t, { publicChildView: false, siteAccessPin: '28756319', requireSiteAccess: true });
  await f.unlockSite();
  for (let index = 0; index < 8; index += 1) {
    assert.equal((await f.request('/api/access/login', { method: 'POST', body: { pin: '99999999' } })).status, 401);
  }
  const blocked = await f.request('/api/access/login', { method: 'POST', body: { pin: '28756319' } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  // Existing site access and the separate parent-PIN limiter remain usable.
  await f.setup();
  assert.equal((await f.request('/api/library', { parent: true })).body.parent, true);
});

test('HTTPS proxy origin and secure cookies work with one explicitly trusted proxy hop', async t => {
  const f = await fixture(t, { publicChildView: false, siteAccessPin: '28756319', requireSiteAccess: true, trustProxy: 1, publicOrigin: 'https://nest.example.test/', secureCookies: false });
  const proxyHeaders = { Origin: 'https://nest.example.test', 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': '198.51.100.10' };
  const login = await f.request('/api/access/login', { method: 'POST', body: { pin: '28756319' }, headers: proxyHeaders });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /; Secure;/);
  const siteCookie = login.headers.get('set-cookie').split(';')[0];
  const parentSetup = await f.request('/api/auth/setup', { method: 'POST', body: { pin: '123456' }, headers: { ...proxyHeaders, Cookie: siteCookie } });
  assert.equal(parentSetup.status, 201);
  assert.match(parentSetup.headers.get('set-cookie'), /; Secure;/);
  const rejected = await f.request('/api/access/login', { method: 'POST', body: { pin: '28756319' }, headers: { ...proxyHeaders, Origin: 'https://foreign.example' } });
  assert.equal(rejected.status, 403);
  for (let index = 0; index < 8; index += 1) {
    assert.equal((await f.request('/api/access/login', { method: 'POST', body: { pin: '99999999' }, headers: proxyHeaders })).status, 401);
  }
  assert.equal((await f.request('/api/access/login', { method: 'POST', body: { pin: '28756319' }, headers: proxyHeaders })).status, 429);
  assert.equal((await f.request('/api/access/login', { method: 'POST', body: { pin: '28756319' }, headers: { ...proxyHeaders, 'X-Forwarded-For': '198.51.100.11' } })).status, 200);
});

test('forwarded protocol is ignored without explicit proxy trust and cookie security can be enforced', async t => {
  const untrusted = await fixture(t, { siteAccessPin: '28756319', trustProxy: false, secureCookies: false });
  const localLogin = await untrusted.request('/api/access/login', { method: 'POST', body: { pin: '28756319' }, headers: { 'X-Forwarded-Proto': 'https' } });
  assert.equal(localLogin.status, 200);
  assert.doesNotMatch(localLogin.headers.get('set-cookie'), /; Secure;/);
  const forced = await fixture(t, { siteAccessPin: '28756319', trustProxy: false, secureCookies: true });
  const login = await forced.unlockSite();
  assert.match(login.headers.get('set-cookie'), /; Secure;/);
});


test('discovery configuration and missing credentials remain parent-only without exposing secrets', async t => {
  let calls = 0;
  const f = await fixture(t, { discoveryApiKey: '', fetchImpl: async () => { calls += 1; throw new Error('Unexpected fetch'); } });
  assert.equal((await f.request('/api/discovery/config')).status, 401);
  await f.setup();
  const config = await f.request('/api/discovery/config', { parent: true });
  assert.equal(config.status, 200);
  assert.equal(config.body.configured, false);
  assert.equal(config.body.defaultCountry, 'CZ');
  assert.deepEqual(config.body.services.map(service => service.id), ['youtube', 'netflix', 'disney', 'prime', 'max']);
  const search = await f.request('/api/discovery/search', { method: 'POST', parent: true, body: { query: 'Gentle animal stories', country: 'CZ', services: ['netflix'] } });
  assert.equal(search.status, 503);
  assert.match(search.body.error, /NEST_AI_API_KEY/);
  assert.equal(calls, 0);
  const configured = await fixture(t, { discoveryApiKey: 'test-only-key-never-send-to-client' });
  await configured.setup();
  const available = await configured.request('/api/discovery/config', { parent: true });
  assert.equal(available.body.configured, true);
  assert.equal(JSON.stringify(available.body).includes('test-only-key'), false);
});

test('streaming link analyses save consistent selections visible in the child library', async t => {
  const f = await fixture(t, { discoveryApiKey: '' });
  await f.setup();
  for (const [source, url] of [
    ['netflix', 'https://www.netflix.com/watch/81361080?trackId=284725014'],
    ['disney', 'https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r'],
    ['prime', 'https://www.primevideo.com/detail/0ABCDEF1234567'],
    ['max', 'https://www.max.com/movies/example/12345678-1234-1234-1234-123456789abc'],
  ]) {
    const analysis = await f.request('/api/links/analyze', { method: 'POST', parent: true, body: { url } });
    assert.equal(analysis.status, 200, url);
    assert.equal(analysis.body.source, source);
    assert.equal(analysis.body.metadata.durationSeconds, null);
    assert.equal(analysis.body.integration.inAppPlaybackImplemented, false);
    const saved = await f.request('/api/videos', { method: 'POST', parent: true, body: { url: analysis.body.url, title: `Reference from ${source}`, source } });
    assert.equal(saved.status, 201, JSON.stringify(saved.body));
    assert.equal(saved.body.video.approved, true);
  }
  assert.equal((await f.request('/api/library', { parent: true })).body.videos.length, 4);
  assert.equal((await f.request('/api/library')).body.videos.length, 4);
});

test('AI search requests have a separate parent-only limit', async t => {
  const f = await fixture(t, { discoveryApiKey: '' });
  await f.setup();
  const options = { method: 'POST', parent: true, body: { query: 'Find a short story', country: 'CZ', services: ['youtube'] } };
  for (let i = 0; i < 15; i += 1) assert.equal((await f.request('/api/discovery/search', options)).status, 503);
  const blocked = await f.request('/api/discovery/search', options);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);
  assert.equal((await f.request('/api/links/analyze', { method: 'POST', parent: true, body: { url: 'https://www.netflix.com/title/80049832' } })).status, 200);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { pin: '123456' } })).status, 200);
});


test('an AI suggestion explicitly saved as a draft stays private after logout', async t => {
  let calls = 0;
  const url = 'https://www.netflix.com/title/80049832';
  const f = await fixture(t, { discoveryApiKey: 'test-only-key', fetchImpl: async endpoint => {
    calls += 1;
    assert.equal(String(endpoint), 'https://api.openai.com/v1/responses');
    return { ok: true, json: async () => ({ status: 'completed', output: [
      { type: 'web_search_call', status: 'completed', action: { type: 'search', sources: [{ type: 'url', url }] } },
      { type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'Test suggestion', results: [{ title: 'A nature suggestion', url, description: 'Test description', reason: 'A possible match for the request' }] }) }] },
    ] }) };
  } });
  await f.setup();
  const result = await f.request('/api/discovery/search', { method: 'POST', parent: true, body: { query: 'Nature suggestions for our family', services: ['netflix'], country: 'CZ' } });
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.equal(result.body.country, 'CZ');
  assert.equal(result.body.results.length, 1);
  const suggestion = result.body.results[0];
  assert.equal(suggestion.availability, 'not-verified');
  assert.equal(suggestion.price, null);
  assert.equal(suggestion.durationSeconds, null);
  const saved = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: suggestion.title, url: suggestion.url, source: suggestion.source, description: suggestion.description, approved: false } });
  assert.equal(saved.status, 201);
  assert.equal((await f.request('/api/library', { parent: true })).body.videos.length, 1);
  await f.request('/api/auth/logout', { method: 'POST', parent: true });
  assert.equal((await f.request('/api/library', { parent: true })).body.videos.length, 0);
  assert.equal((await f.request('/api/discovery/config', { parent: true })).status, 401);
});

async function restartedFixture(t, options) {
  const app = await createApp(options);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return async (path, { body, cookie = '' } = {}) => {
    const response = await fetch(`${base}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
}

test('invalid parent PIN overrides fail before creating or changing library data', async t => {
  const dataDir = await mkdtemp(join(tmpdir(), 'nest-invalid-recovery-'));
  t.after(() => rm(dataDir, { recursive: true, force: true }));
  for (const parentPinOverride of ['', '12345', '1234567890123', 'abcdef', '123456\n', 123456, null]) {
    await assert.rejects(createApp({ dataDir, parentPinOverride }), /PARENT_PIN_OVERRIDE must contain 6–12 digits/);
  }
  await assert.rejects(readFile(join(dataDir, 'library.json')), { code: 'ENOENT' });
  const f = await fixture(t);
  await f.setup();
  const before = await readFile(join(f.dataDir, 'library.json'), 'utf8');
  await assert.rejects(createApp({ dataDir: f.dataDir, parentPinOverride: 'invalid' }), /PARENT_PIN_OVERRIDE/);
  assert.equal(await readFile(join(f.dataDir, 'library.json'), 'utf8'), before);
});

test('a configured parent PIN claims a fresh library and stores only its hash', async t => {
  const f = await fixture(t, { parentPinOverride: '004872' });
  const library = await f.request('/api/library');
  assert.equal(library.body.pinConfigured, true);
  assert.equal(library.body.demo, false);
  assert.deepEqual(library.body.videos, []);
  assert.equal((await f.request('/api/auth/setup', { method: 'POST', body: { pin: '123456' } })).status, 409);
  assert.equal((await f.request('/api/auth/login', { method: 'POST', body: { pin: '004872' } })).status, 200);
  const saved = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  assert.ok(saved.pin.hash && saved.pin.salt);
  assert.equal(JSON.stringify(saved).includes('004872'), false);
});

test('rotating both PINs rejects old credentials and preserves family videos and media', async t => {
  const f = await fixture(t, { publicChildView: false, siteAccessPin: '28756319', requireSiteAccess: true });
  await f.unlockSite();
  await f.setup();
  const reference = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'A saved family reference', url: 'https://www.netflix.com/watch/81361080' } });
  assert.equal(reference.status, 201);
  const uploaded = await f.upload({ approved: true });
  assert.equal(uploaded.status, 201);
  const before = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  const mediaPath = join(f.dataDir, 'uploads', uploaded.body.video.mediaUrl.slice('/media/'.length));
  const media = await readFile(mediaPath);
  const request = await restartedFixture(t, { publicChildView: false, dataDir: f.dataDir, siteAccessPin: '91482760', requireSiteAccess: true, parentPinOverride: '758304' });
  assert.equal((await request('/api/library', { cookie: `${f.siteCookie}; ${f.cookie}` })).status, 401);
  assert.equal((await request('/api/access/login', { body: { pin: '28756319' } })).status, 401);
  const access = await request('/api/access/login', { body: { pin: '91482760' } });
  assert.equal(access.status, 200);
  const siteCookie = access.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/library', { cookie: `${siteCookie}; ${f.cookie}` })).body.parent, false);
  assert.equal((await request('/api/auth/login', { cookie: siteCookie, body: { pin: '123456' } })).status, 401);
  const login = await request('/api/auth/login', { cookie: siteCookie, body: { pin: '758304' } });
  assert.equal(login.status, 200);
  const cookie = `${siteCookie}; ${login.headers.get('set-cookie').split(';')[0]}`;
  assert.deepEqual((await request('/api/library', { cookie })).body.videos, before.videos);
  const after = JSON.parse(await readFile(join(f.dataDir, 'library.json'), 'utf8'));
  assert.deepEqual(after.videos, before.videos);
  assert.notDeepEqual(after.pin, before.pin);
  assert.equal(after.demo, false);
  assert.deepEqual(await readFile(mediaPath), media);
  assert.equal(JSON.stringify(after).includes('758304'), false);
  assert.equal(JSON.stringify(after).includes('91482760'), false);
});

test('the same parent override does not rewrite data and removing it keeps the recovered PIN', async t => {
  const f = await fixture(t, { parentPinOverride: '758304' });
  const storeFile = join(f.dataDir, 'library.json');
  const before = await readFile(storeFile, 'utf8');
  await createApp({ dataDir: f.dataDir, parentPinOverride: '758304' });
  assert.equal(await readFile(storeFile, 'utf8'), before);
  const request = await restartedFixture(t, { dataDir: f.dataDir, parentPinOverride: undefined });
  assert.equal((await request('/api/auth/login', { body: { pin: '758304' } })).status, 200);
  assert.equal((await request('/api/auth/login', { body: { pin: '123456' } })).status, 401);
  assert.equal(await readFile(storeFile, 'utf8'), before);
});

test('disconnecting a parent search aborts the provider and leaves later searches usable', { timeout: 10000 }, async t => {
  const started = Promise.withResolvers();
  const aborted = Promise.withResolvers();
  let calls = 0;
  const f = await fixture(t, { discoveryApiKey: 'test-key-not-live', fetchImpl: async (_url, { signal }) => {
    calls += 1;
    if (calls === 1) {
      started.resolve(signal);
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        aborted.resolve();
        reject(signal.reason);
      }, { once: true }));
    }
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ summary: '', results: [] }) }) };
  } });
  await f.setup();
  const controller = new AbortController();
  const body = { query: 'Find a gentle animal story', services: ['youtube'], country: 'CZ' };
  const pending = fetch(`${f.base}/api/discovery/search`, {
    method: 'POST', signal: controller.signal,
    headers: { Cookie: f.cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  const providerSignal = await started.promise;
  // Receiving the complete POST body must not cancel an ordinary pending search.
  assert.equal(providerSignal.aborted, false);
  controller.abort();
  await rejected;
  let timer;
  try {
    await Promise.race([aborted.promise, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Provider request was not cancelled')), 3000); })]);
  } finally { clearTimeout(timer); }
  assert.equal(providerSignal.aborted, true);
  const next = await f.request('/api/discovery/search', { method: 'POST', parent: true, body });
  assert.equal(next.status, 200);
  assert.deepEqual(next.body.results, []);
  assert.equal(calls, 2);
});

test('parent link analysis and saves prefer web images while preserving an explicit cover', async t => {
  const calls = [];
  const f = await fixture(t, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ title: 'Space discoveries', author_name: 'Creator', thumbnail_url: 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg' }) }),
    thumbnailService: { resolve: async (url, details) => { calls.push({ url, details }); return { thumbnail: 'https://images.example.test/poster.jpg', artwork: 'space' }; } },
  });
  await f.setup();
  const imported = await f.request('/api/links/analyze', { method: 'POST', parent: true, body: { url: 'https://youtu.be/nr5Pj6GQL2o' } });
  assert.equal(imported.status, 200);
  assert.equal(imported.body.metadata.thumbnail, 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg');
  assert.equal(calls.length, 0, 'Keep an already imported provider thumbnail');
  const analyzed = await f.request('/api/links/analyze', { method: 'POST', parent: true, body: { url: 'https://www.netflix.com/watch/81361080?trackId=123' } });
  assert.equal(analyzed.body.metadata.thumbnail, 'https://images.example.test/poster.jpg');
  assert.equal(analyzed.body.metadata.artwork, 'space');
  assert.equal(calls[0].url, 'https://www.netflix.com/watch/81361080');
  const saved = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'A space story', url: analyzed.body.url } });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.video.thumbnail, 'https://images.example.test/poster.jpg');
  assert.equal(saved.body.video.artwork, 'space');
  assert.equal(calls.at(-1).details.title, 'A space story');
  const chosen = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'My cover', url: analyzed.body.url, artwork: 'bears' } });
  assert.equal(chosen.body.video.artwork, 'bears');
  const before = calls.length;
  const ownImage = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'My own image', url: analyzed.body.url, thumbnail: 'https://images.example.test/parent.jpg', artwork: 'music' } });
  assert.equal(ownImage.body.video.thumbnail, 'https://images.example.test/parent.jpg');
  assert.equal(ownImage.body.video.artwork, 'music');
  assert.equal(calls.length, before);
  assert.equal((await f.request('/api/library')).body.videos.length, 3);
});

test('parent thumbnail backfill limits concurrency and preserves edits, uploads, and deleted records', { timeout: 10000 }, async t => {
  let backfill = false;
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const firstBatch = Promise.withResolvers();
  const finalItem = Promise.withResolvers();
  const releases = [];
  const f = await fixture(t, { thumbnailService: { resolve: async () => {
    if (!backfill) return { thumbnail: '', artwork: 'forest' };
    calls += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    if (calls === 3) firstBatch.resolve();
    if (calls === 4) finalItem.resolve();
    return new Promise(resolve => releases.push(() => { active -= 1; resolve({ thumbnail: 'https://images.example.test/backfill.jpg', artwork: 'space' }); }));
  } } });
  await f.setup();
  const videos = [];
  for (let index = 0; index < 4; index += 1) {
    const saved = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: `Story ${index}`, url: `https://www.netflix.com/title/${80049832 + index}` } });
    assert.equal(saved.status, 201);
    videos.push(saved.body.video);
  }
  const uploaded = await f.upload({ approved: true });
  assert.equal(uploaded.status, 201);
  backfill = true;
  const pending = f.request('/api/library/thumbnails', { method: 'POST', parent: true, body: {} });
  await firstBatch.promise;
  assert.equal(active, 3);
  await f.request(`/api/videos/${videos[0].id}`, { method: 'PATCH', parent: true, body: { thumbnail: 'https://images.example.test/new-parent-image.jpg' } });
  await f.request(`/api/videos/${videos[1].id}`, { method: 'DELETE', parent: true });
  await f.request(`/api/videos/${videos[2].id}`, { method: 'PATCH', parent: true, body: { title: 'A different story now' } });
  await f.request(`/api/videos/${videos[3].id}`, { method: 'PATCH', parent: true, body: { favorite: true } });
  releases.splice(0).forEach(release => release());
  await finalItem.promise;
  releases.splice(0).forEach(release => release());
  const result = await pending;
  assert.equal(result.status, 200);
  assert.equal(result.body.updated, 1);
  assert.equal(maxActive, 3);
  assert.equal(calls, 4, 'Uploads never request external thumbnails');
  const library = (await f.request('/api/library', { parent: true })).body;
  assert.equal(library.videos.find(video => video.id === videos[0].id).thumbnail, 'https://images.example.test/new-parent-image.jpg');
  assert.equal(library.videos.some(video => video.id === videos[1].id), false);
  assert.equal(library.videos.find(video => video.id === videos[2].id).thumbnail, '');
  const filled = library.videos.find(video => video.id === videos[3].id);
  assert.equal(filled.thumbnail, 'https://images.example.test/backfill.jpg');
  assert.equal(filled.artwork, 'space');
  assert.equal(filled.favorite, true);
  assert.equal(library.videos.find(video => video.id === uploaded.body.video.id).thumbnail, '');
});

test('the browser policy permits only the privacy-enhanced YouTube frame host', async t => {
  const f = await fixture(t);
  const response = await f.request('/api/health');
  const policy = response.headers.get('content-security-policy');
  assert.match(policy, /(?:^|; )frame-src https:\/\/www\.youtube-nocookie\.com;/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.doesNotMatch(policy, /frame-src[^;]*(?:\*|https:\/\/www\.youtube\.com)/);
});

test('public child view uses only the parent PIN after a protected initial setup', async t => {
  const f = await fixture(t, { publicChildView: true, siteAccessPin: '28756319', requireSiteAccess: true });
  const initial = await f.request('/api/library', { site: false });
  assert.equal(initial.status, 200);
  assert.equal(initial.body.parent, false);
  assert.equal(initial.body.pinConfigured, false);
  assert.equal((await f.request('/api/auth/setup', { method: 'POST', site: false, body: { pin: '123456' } })).status, 401);
  await f.unlockSite();
  await f.setup();
  const selected = await f.request('/api/videos', { method: 'POST', parent: true, site: false, body: { title: 'A selected video', url: 'https://youtu.be/nr5Pj6GQL2o' } });
  assert.equal(selected.status, 201);
  assert.equal(selected.body.video.approved, true);
  const draft = await f.request('/api/videos', { method: 'POST', parent: true, site: false, body: { title: 'A private draft', url: 'https://www.netflix.com/title/80049832', approved: false } });
  assert.equal(draft.status, 201);
  const child = await f.request('/api/library', { site: false });
  assert.deepEqual(child.body.videos.map(video => video.id), [selected.body.video.id]);
  assert.equal((await f.request('/api/discovery/config', { parent: true, site: false })).status, 200);
  assert.equal((await f.request('/api/videos', { method: 'POST', site: false, body: { title: 'Unauthorized', url: selected.body.video.url } })).status, 401);
  await f.request('/api/auth/logout', { method: 'POST', parent: true, site: false });
  const login = await f.request('/api/auth/login', { method: 'POST', site: false, body: { pin: '123456' } });
  assert.equal(login.status, 200, 'Parent login does not require a website PIN');
  const parentCookie = login.headers.get('set-cookie').split(';')[0];
  const parent = await f.request('/api/library', { site: false, headers: { Cookie: parentCookie } });
  assert.equal(parent.body.parent, true);
  assert.equal(parent.body.videos.length, 2);
});

test('public uploaded media still enforces approval and authenticated parent access', async t => {
  const f = await fixture(t, { publicChildView: true, siteAccessPin: '28756319', requireSiteAccess: true });
  await f.unlockSite();
  await f.setup();
  const uploaded = await f.upload();
  const path = uploaded.body.video.mediaUrl;
  assert.equal((await fetch(`${f.base}${path}`)).status, 404);
  assert.equal((await fetch(`${f.base}${path}`, { headers: { Cookie: f.cookie } })).status, 200);
  await f.request(`/api/videos/${uploaded.body.video.id}`, { method: 'PATCH', parent: true, site: false, body: { approved: true } });
  assert.equal((await fetch(`${f.base}${path}`)).status, 200);
  assert.equal((await fetch(`${f.base}${path}`, { method: 'HEAD' })).status, 200);
  await f.request(`/api/videos/${uploaded.body.video.id}`, { method: 'PATCH', parent: true, site: false, body: { approved: false } });
  assert.equal((await fetch(`${f.base}${path}`)).status, 404);
});

test('legacy forced-private streaming links migrate once without changing uploaded drafts', async t => {
  const f = await fixture(t);
  await f.setup();
  const saved = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'Legacy selection', url: 'https://www.netflix.com/title/80049832', approved: false } });
  const uploaded = await f.upload();
  const storeFile = join(f.dataDir, 'library.json');
  const legacy = JSON.parse(await readFile(storeFile, 'utf8'));
  delete legacy.streamingApprovalMigrated;
  await writeFile(storeFile, JSON.stringify(legacy));
  const request = await restartedFixture(t, { dataDir: f.dataDir, publicChildView: true });
  const child = await request('/api/library');
  assert.deepEqual(child.body.videos.map(video => video.id), [saved.body.video.id]);
  const migrated = JSON.parse(await readFile(storeFile, 'utf8'));
  assert.equal(migrated.streamingApprovalMigrated, true);
  assert.equal(migrated.videos.find(video => video.id === uploaded.body.video.id).approved, false);
  migrated.videos.find(video => video.id === saved.body.video.id).approved = false;
  await writeFile(storeFile, JSON.stringify(migrated));
  await createApp({ dataDir: f.dataDir });
  const reopened = JSON.parse(await readFile(storeFile, 'utf8'));
  assert.equal(reopened.videos.find(video => video.id === saved.body.video.id).approved, false, 'Migration must not republish later explicit drafts');
});

test('verified runtime metadata fills analysis, saves, and existing missing durations without replacing parent values', async t => {
  let duration = 245;
  const f = await fixture(t, {
    fetchImpl: async () => ({ ok: true, json: async () => ({ title: 'Space tour', author_name: 'Creator', thumbnail_url: 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg' }) }),
    durationService: { resolve: async url => url.includes('youtube.com') ? duration : null },
  });
  await f.setup();
  const url = 'https://www.youtube.com/watch?v=nr5Pj6GQL2o';
  const analysis = await f.request('/api/links/analyze', { method: 'POST', parent: true, body: { url } });
  assert.equal(analysis.body.metadata.durationSeconds, 245);
  const metadata = await f.request('/api/metadata', { method: 'POST', parent: true, body: { url } });
  assert.equal(metadata.body.duration, 245);
  const saved = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'Space tour', url } });
  assert.equal(saved.body.video.duration, 245);
  const manual = await f.request('/api/videos', { method: 'POST', parent: true, body: { title: 'My selected duration', url, duration: 120 } });
  assert.equal(manual.body.video.duration, 120);
  await f.request(`/api/videos/${saved.body.video.id}`, { method: 'PATCH', parent: true, body: { duration: null, thumbnail: 'https://images.example.test/existing.jpg' } });
  duration = 300;
  const filled = await f.request('/api/library/thumbnails', { method: 'POST', parent: true, body: {} });
  assert.equal(filled.body.updated, 1);
  const library = (await f.request('/api/library', { parent: true })).body;
  assert.equal(library.videos.find(video => video.id === saved.body.video.id).duration, 300);
  assert.equal(library.videos.find(video => video.id === saved.body.video.id).thumbnail, 'https://images.example.test/existing.jpg');
  assert.equal(library.videos.find(video => video.id === manual.body.video.id).duration, 120);
});
