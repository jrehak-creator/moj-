import express from 'express';
import multer from 'multer';
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, open } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { normalizeVideoUrl, analyzeVideoLink } from './providers.mjs';
import { createDiscoveryService, DiscoveryError } from './discovery.mjs';

export { normalizeVideoUrl } from './providers.mjs';

const scrypt = promisify(scryptCallback);
const here = dirname(fileURLToPath(import.meta.url));
const collections = ['Nature & animals', 'Curious minds', 'Stories & imagination', 'Music & movement'];
const artworks = ['ocean', 'forest', 'space', 'bears', 'butterfly', 'music', 'stories', 'earth'];
const cookieName = 'nest_parent';
const accessCookieName = 'nest_access';
const sessionAge = 12 * 60 * 60 * 1000;
const maxUploadBytes = 200 * 1024 * 1024;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function fail(message) { throw new HttpError(400, message); }
function textField(value, name, max, { required = false, fallback = '' } = {}) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') fail(`${name} must be text.`);
  const result = value.trim();
  if (result.length > max || (required && !result)) fail(`${name} must contain ${required ? '1–' : 'at most '}${max} characters.`);
  return result;
}

function thumbnailUrl(value) {
  const result = textField(value, 'Thumbnail', 2048);
  if (!result) return '';
  let parsed;
  try { parsed = new URL(result); } catch { fail('Thumbnail must be an HTTPS image URL.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail('Thumbnail must be an HTTPS image URL.');
  return parsed.href;
}

function videoFields(body, previous = null) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Video details must be an object.');
  const merged = { ...previous, ...body };
  let identity;
  if (previous?.source === 'upload') {
    if ((body.source !== undefined && body.source !== 'upload') || (body.url !== undefined && body.url !== previous.url) || (body.mediaUrl !== undefined && body.mediaUrl !== previous.mediaUrl)) fail('An uploaded video’s media location cannot be changed.');
    identity = { source: 'upload', url: previous.url, mediaUrl: previous.mediaUrl };
  } else {
    identity = normalizeVideoUrl(merged.url);
    if (body.source !== undefined && body.source !== identity.source) fail('The selected service does not match the link.');
    if (body.mediaUrl !== undefined) fail('Upload a video file to add local media.');
    if (merged.approved === true) fail('External links are parent references. Only uploaded videos can appear in the child library.');
  }
  const title = textField(merged.title, 'Title', 200, { required: true });
  if (!title) fail('A title is required.');
  const duration = merged.duration ?? null;
  if (duration !== null && (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60 * 60)) fail('Duration must be a positive number of seconds, up to 24 hours.');
  const collection = merged.collection ?? collections[0];
  if (!collections.includes(collection)) fail('Choose one of the available collections.');
  const artwork = merged.artwork ?? 'ocean';
  if (!artworks.includes(artwork)) fail('Choose one of the available artworks.');
  const tags = merged.tags ?? [];
  if (!Array.isArray(tags) || tags.length > 16 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 40)) fail('Use up to 16 tags of 1–40 characters.');
  for (const name of ['approved', 'favorite']) if (merged[name] !== undefined && typeof merged[name] !== 'boolean') fail(`${name} must be true or false.`);
  return {
    ...identity, title,
    description: textField(merged.description, 'Description', 4000),
    creator: textField(merged.creator, 'Creator', 160),
    duration,
    age: textField(merged.age, 'Age guidance', 40),
    collection,
    tags: [...new Set(tags.map(tag => tag.trim()))],
    thumbnail: thumbnailUrl(merged.thumbnail),
    artwork,
    approved: identity.source === 'upload' && (merged.approved ?? false),
    favorite: merged.favorite ?? false,
  };
}

function samples() {
  const definitions = [
    ['ocean', 'Our wonderful oceans', 'netflix', 'https://www.netflix.com/title/80049832', 'Nature & animals', ['Oceans', 'Animals']],
    ['forest', 'A little forest adventure', 'disney', 'https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r', 'Stories & imagination', ['Adventure', 'Family']],
    ['space', 'An adventure beyond Earth', 'youtube', 'https://www.youtube.com/watch?v=nr5Pj6GQL2o', 'Curious minds', ['Space', 'Discovery']],
    ['bears', 'Big stories, small friends', 'youtube', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'Stories & imagination', ['Stories', 'Animation']],
    ['butterfly', 'The tiniest wonders', 'netflix', 'https://www.netflix.com/title/80049832', 'Nature & animals', ['Nature', 'Discovery']],
    ['music', 'A little music, a lot of joy', 'disney', 'https://www.disneyplus.com/series/bluey/1xy9TAOQ0M3r', 'Music & movement', ['Music', 'Movement']],
    ['stories', 'A world of imagination', 'youtube', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'Stories & imagination', ['Imagination', 'Stories']],
    ['earth', 'Our extraordinary planet', 'netflix', 'https://www.netflix.com/title/80049832', 'Curious minds', ['Earth', 'Discovery']],
  ];
  return definitions.map(([artwork, title, source, url, collection, tags], index) => ({
    id: `demo-${artwork}`, artwork, title, source, url, collection, tags,
    description: 'Illustrative sample card to explore the library. This is not a playable video or verified title metadata. Set up your family library to replace all samples with your own videos.',
    creator: 'Sample collection', duration: null, age: '', thumbnail: '', approved: true, favorite: index === 0 || index === 2,
    createdAt: new Date(Date.UTC(2026, 0, 8 - index)).toISOString(),
  }));
}

function pinValue(body) {
  if (typeof body?.pin !== 'string' || !/^\d{6,12}$/.test(body.pin)) fail('Choose a PIN with 6–12 digits.');
  return body.pin;
}

async function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  const key = await scrypt(pin, salt, 64);
  return { salt, hash: key.toString('hex') };
}

async function readMediaKind(filename) {
  const handle = await open(filename, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp') return 'mp4';
    if (bytesRead >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'webm';
    fail('That file is not a recognized MP4 or WebM video.');
  } finally { await handle.close(); }
}

/** Create one server instance. Pass a temporary dataDir and fetchImpl to isolate tests. */
export async function createApp({
  dataDir = resolve(process.cwd(), '.data'),
  fetchImpl = globalThis.fetch,
  distDir = resolve(here, '../dist'),
  siteAccessPin = process.env.SITE_ACCESS_PIN,
  requireSiteAccess = process.env.REQUIRE_SITE_ACCESS === 'true',
  parentPinOverride = process.env.PARENT_PIN_OVERRIDE,
  publicOrigin = process.env.PUBLIC_ORIGIN || process.env.RENDER_EXTERNAL_URL,
  trustProxy = process.env.TRUST_PROXY === '1' ? 1 : false,
  secureCookies = process.env.SESSION_COOKIE_SECURE === 'true',
  discoveryApiKey = process.env.NEST_AI_API_KEY || '',
  discoveryModel = process.env.NEST_AI_MODEL || 'gpt-5-mini',
} = {}) {
  const discovery = createDiscoveryService({ apiKey: discoveryApiKey, model: discoveryModel, fetchImpl });
  const accessRequired = requireSiteAccess || siteAccessPin !== undefined;
  if (accessRequired && (typeof siteAccessPin !== 'string' || !/^\d{8,12}$/.test(siteAccessPin))) {
    throw new Error('Site access requires SITE_ACCESS_PIN to contain 8–12 digits. Configure it securely before starting the server.');
  }
  if (parentPinOverride !== undefined && (typeof parentPinOverride !== 'string' || !/^\d{6,12}$/.test(parentPinOverride))) {
    throw new Error('PARENT_PIN_OVERRIDE must contain 6–12 digits. Configure it securely or remove the setting before starting the server.');
  }
  if (trustProxy !== false && trustProxy !== 1) throw new Error('Proxy trust must be disabled or limited to exactly one proxy hop.');
  if (publicOrigin) {
    let parsed;
    try { parsed = new URL(publicOrigin); } catch { throw new Error('PUBLIC_ORIGIN must be a valid HTTP or HTTPS origin.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('PUBLIC_ORIGIN must be an HTTP or HTTPS origin without a path or credentials.');
    publicOrigin = parsed.origin;
  }
  // The deployment PIN is hashed only in memory and never saved alongside library data.
  const accessCredentials = accessRequired ? await hashPin(siteAccessPin) : null;
  dataDir = resolve(dataDir);
  const uploadsDir = join(dataDir, 'uploads');
  await mkdir(uploadsDir, { recursive: true, mode: 0o700 });
  const storeFile = join(dataDir, 'library.json');
  let state;
  try {
    state = JSON.parse(await readFile(storeFile, 'utf8'));
    if (state.version !== 1 || !Array.isArray(state.videos) || typeof state.demo !== 'boolean') throw new Error('Invalid library format');
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('The saved library could not be read. Preserve .data/library.json and restore a valid backup before starting.', { cause: error });
    state = { version: 1, pin: null, demo: true, videos: samples() };
    await writeFile(storeFile, JSON.stringify(state, null, 2), { mode: 0o600, flag: 'wx' });
  }

  // Serialize updates and publish state only after the atomic disk replacement succeeds.
  let writeQueue = Promise.resolve();
  function update(mutator) {
    const operation = writeQueue.then(async () => {
      const next = structuredClone(state);
      const result = await mutator(next);
      const temporary = `${storeFile}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
        await rename(temporary, storeFile);
      } catch (error) {
        await unlink(temporary).catch(() => {});
        throw error;
      }
      state = next;
      return result;
    });
    writeQueue = operation.catch(() => {});
    return operation;
  }

  // Recovery is controlled by the server owner, never by a public reset endpoint.
  // Keep real library data intact, and avoid rewriting the hash on every restart.
  if (parentPinOverride !== undefined) {
    let matches = false;
    if (state.pin) {
      const candidate = await hashPin(parentPinOverride, state.pin.salt);
      matches = timingSafeEqual(Buffer.from(candidate.hash, 'hex'), Buffer.from(state.pin.hash, 'hex'));
    }
    if (!matches) {
      const credentials = await hashPin(parentPinOverride);
      await update(next => {
        next.pin = credentials;
        if (next.demo) { next.demo = false; next.videos = []; }
      });
    }
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  const sessions = new Map();
  const accessSessions = new Map();
  const loginAttempts = new Map();
  const accessAttempts = new Map();
  const discoveryAttempts = new Map();
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('X-Frame-Options', 'DENY');
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; media-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
    if (req.path.startsWith('/api/') || req.path.startsWith('/media/') || req.accepts('html')) res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin')) {
      let origin;
      try { origin = new URL(req.get('origin')); } catch { return res.status(403).json({ error: 'This request must come from your family library.' }); }
      const expected = publicOrigin || `${req.protocol}://${req.get('host')}`;
      if (origin.origin !== expected) return res.status(403).json({ error: 'This request must come from your family library.' });
    }
    function cookieToken(name) {
      const rawCookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
      return rawCookie?.slice(name.length + 1);
    }
    req.sessionToken = cookieToken(cookieName);
    const expires = sessions.get(req.sessionToken);
    req.isParent = Boolean(expires && expires > Date.now());
    if (expires && !req.isParent) sessions.delete(req.sessionToken);
    req.accessToken = cookieToken(accessCookieName);
    const accessExpires = accessSessions.get(req.accessToken);
    req.hasSiteAccess = !accessRequired || Boolean(accessExpires && accessExpires > Date.now());
    if (accessExpires && accessExpires <= Date.now()) accessSessions.delete(req.accessToken);
    next();
  });

  function parentOnly(req, res, next) {
    if (!req.isParent) return res.status(401).json({ error: 'Unlock parent mode to make changes.' });
    next();
  }
  function cookieOptions(req) {
    return { httpOnly: true, sameSite: 'strict', secure: secureCookies || req.secure, path: '/' };
  }
  function setSession(req, res, sessionMap = sessions, name = cookieName) {
    const now = Date.now();
    for (const [token, expires] of sessionMap) if (expires <= now) sessionMap.delete(token);
    if (sessionMap.size >= 100) sessionMap.delete(sessionMap.keys().next().value);
    const token = randomBytes(32).toString('hex');
    sessionMap.set(token, now + sessionAge);
    res.cookie(name, token, { ...cookieOptions(req), maxAge: sessionAge });
  }
  function makeAttemptLimit(attemptMap, message, limit = 8) {
    return (req, res, next) => {
      const now = Date.now();
      for (const [ip, entry] of attemptMap) if (entry.until < now) attemptMap.delete(ip);
      const key = req.ip;
      const attempts = attemptMap.get(key) ?? { count: 0, until: now + 15 * 60 * 1000 };
      if (attempts.count >= limit) {
        res.set('Retry-After', String(Math.ceil((attempts.until - now) / 1000)));
        return res.status(429).json({ error: message });
      }
      attempts.count += 1;
      attemptMap.set(key, attempts);
      next();
    };
  }
  const attemptLimit = makeAttemptLimit(loginAttempts, 'Too many PIN attempts. Try again in 15 minutes.');
  const accessAttemptLimit = makeAttemptLimit(accessAttempts, 'Too many access PIN attempts. Try again in 15 minutes.');
  const discoveryAttemptLimit = makeAttemptLimit(discoveryAttempts, 'Search limit reached. Try again in 15 minutes.', 15);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/access', (req, res) => res.json({ required: accessRequired, authenticated: req.hasSiteAccess }));
  app.post('/api/access/login', accessAttemptLimit, express.json({ limit: '1kb' }), async (req, res) => {
    if (!accessRequired) return res.json({ required: false, authenticated: true });
    if (typeof req.body?.pin !== 'string' || !/^\d{8,12}$/.test(req.body.pin)) fail('Enter an access PIN with 8–12 digits.');
    const candidate = await hashPin(req.body.pin, accessCredentials.salt);
    if (!timingSafeEqual(Buffer.from(candidate.hash, 'hex'), Buffer.from(accessCredentials.hash, 'hex'))) throw new HttpError(401, 'That access PIN does not match.');
    accessAttempts.delete(req.ip);
    setSession(req, res, accessSessions, accessCookieName);
    res.json({ required: true, authenticated: true });
  });
  app.post('/api/access/logout', (req, res) => {
    accessSessions.delete(req.accessToken);
    sessions.delete(req.sessionToken);
    res.clearCookie(accessCookieName, cookieOptions(req));
    res.clearCookie(cookieName, cookieOptions(req));
    res.json({ required: accessRequired, authenticated: !accessRequired });
  });
  app.use(['/api', '/media'], (req, res, next) => {
    if (!req.hasSiteAccess) return res.status(401).json({ error: 'Enter your site access PIN to open this library.' });
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/library', (req, res) => res.json({
    videos: req.isParent || state.demo ? state.videos : state.videos.filter(video => video.source === 'upload' && video.approved),
    demo: state.demo, pinConfigured: Boolean(state.pin), parent: req.isParent,
  }));

  app.post('/api/auth/setup', attemptLimit, async (req, res) => {
    if (state.pin) throw new HttpError(409, 'A parent PIN is already configured. Unlock parent mode instead.');
    const credentials = await hashPin(pinValue(req.body));
    await update(next => {
      if (next.pin) throw new HttpError(409, 'A parent PIN is already configured.');
      next.pin = credentials;
      next.demo = false;
      next.videos = [];
    });
    loginAttempts.delete(req.ip);
    setSession(req, res);
    res.status(201).json({ parent: true });
  });
  app.post('/api/auth/login', attemptLimit, async (req, res) => {
    const pin = pinValue(req.body);
    if (!state.pin) throw new HttpError(409, 'Set up a parent PIN first.');
    const candidate = await hashPin(pin, state.pin.salt);
    if (!timingSafeEqual(Buffer.from(candidate.hash, 'hex'), Buffer.from(state.pin.hash, 'hex'))) throw new HttpError(401, 'That PIN does not match.');
    loginAttempts.delete(req.ip);
    setSession(req, res);
    res.json({ parent: true });
  });
  app.post('/api/auth/logout', (req, res) => {
    sessions.delete(req.sessionToken);
    res.clearCookie(cookieName, cookieOptions(req));
    res.json({ parent: false });
  });

  app.get('/api/discovery/config', parentOnly, (_req, res) => res.json(discovery.config()));
  app.post('/api/discovery/search', parentOnly, discoveryAttemptLimit, async (req, res) => {
    res.json(await discovery.search(req.body ?? {}));
  });
  app.post('/api/links/analyze', parentOnly, async (req, res) => {
    res.json(await analyzeVideoLink(req.body?.url, { fetchImpl }));
  });
  // Keep the original editor endpoint compatible with the shared provider adapters.
  app.post('/api/metadata', parentOnly, async (req, res) => {
    const result = await analyzeVideoLink(req.body?.url, { fetchImpl });
    const details = result.metadata;
    res.json({ source: result.source, url: result.url, title: details.title,
      description: details.description, creator: details.creator, thumbnail: details.thumbnail,
      duration: details.durationSeconds, warning: result.warnings.join(' ') });
  });

  app.post('/api/videos', parentOnly, async (req, res) => {
    const fields = videoFields(req.body);
    const video = { ...fields, id: randomUUID(), createdAt: new Date().toISOString() };
    await update(next => next.videos.unshift(video));
    res.status(201).json({ video });
  });
  app.patch('/api/videos/:id', parentOnly, async (req, res) => {
    let video;
    await update(next => {
      const index = next.videos.findIndex(item => item.id === req.params.id);
      if (index === -1) throw new HttpError(404, 'This video is no longer in your library.');
      const previous = next.videos[index];
      video = { ...videoFields(req.body, previous), id: previous.id, createdAt: previous.createdAt };
      next.videos[index] = video;
    });
    res.json({ video });
  });
  app.delete('/api/videos/:id', parentOnly, async (req, res) => {
    let removed;
    await update(next => {
      const index = next.videos.findIndex(item => item.id === req.params.id);
      if (index === -1) throw new HttpError(404, 'This video is no longer in your library.');
      [removed] = next.videos.splice(index, 1);
    });
    if (removed.source === 'upload' && /^\/media\/[a-f0-9-]+\.(mp4|webm)$/.test(removed.mediaUrl)) await unlink(join(uploadsDir, removed.mediaUrl.slice('/media/'.length))).catch(() => {});
    res.json({ ok: true });
  });

  const receiveUpload = multer({
    storage: multer.diskStorage({ destination: uploadsDir, filename: (_req, _file, callback) => callback(null, `${randomUUID()}.incoming`) }),
    limits: { fileSize: maxUploadBytes, files: 1, fields: 0, parts: 1 },
    fileFilter: (_req, file, callback) => {
      if (!['video/mp4', 'video/webm', 'application/octet-stream'].includes(file.mimetype)) return callback(new HttpError(400, 'Choose an MP4 or WebM video file.'));
      callback(null, true);
    },
  }).single('file');
  app.post('/api/uploads', parentOnly, receiveUpload, async (req, res) => {
    if (!req.file) fail('Choose an MP4 or WebM video file.');
    let finalPath;
    try {
      const kind = await readMediaKind(req.file.path);
      const filename = `${randomUUID()}.${kind}`;
      finalPath = join(uploadsDir, filename);
      await rename(req.file.path, finalPath);
      const mediaUrl = `/media/${filename}`;
      const title = req.file.originalname.replace(/\.(mp4|webm)$/i, '').slice(0, 200).trim() || 'Untitled video';
      const video = {
        id: randomUUID(), source: 'upload', url: mediaUrl, mediaUrl, title,
        description: '', creator: '', duration: null, age: '', collection: collections[0], tags: [],
        thumbnail: '', artwork: 'ocean', approved: false, favorite: false, createdAt: new Date().toISOString(),
      };
      await update(next => next.videos.unshift(video));
      res.status(201).json({ video });
    } catch (error) {
      await unlink(req.file.path).catch(() => {});
      if (finalPath) await unlink(finalPath).catch(() => {});
      throw error;
    }
  });
  app.get('/media/:filename', (req, res, next) => {
    const filename = req.params.filename;
    if (!/^[a-f0-9-]+\.(mp4|webm)$/.test(filename)) return res.status(404).json({ error: 'Video not found.' });
    const video = state.videos.find(item => item.source === 'upload' && item.mediaUrl === `/media/${filename}`);
    if (!video || (!req.isParent && !video.approved)) return res.status(404).json({ error: 'Video not found.' });
    res.type(filename.endsWith('.mp4') ? 'video/mp4' : 'video/webm');
    res.sendFile(filename, { root: uploadsDir, dotfiles: 'deny', cacheControl: false }, error => { if (error) next(error); });
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(express.static(distDir, { index: false, dotfiles: 'deny' }));
  app.get('/{*path}', (req, res, next) => {
    if (!req.accepts('html') || req.path.startsWith('/media/')) return res.status(404).json({ error: 'Not found.' });
    res.sendFile(join(distDir, 'index.html'), error => { if (error) next(error); });
  });
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE' ? 'Videos must be 200 MB or smaller.' : 'Upload one MP4 or WebM file using the file field.';
      return res.status(400).json({ error: message });
    }
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request must contain valid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
    if (error instanceof DiscoveryError) return res.status(error.status).json({ error: error.message });
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error('Library operation failed:', error.message);
    res.status(status).json({ error: status === 500 ? 'The library could not save this change. Please try again.' : error.message });
  });
  return app;
}
