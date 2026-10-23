import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiscoveryService, DiscoveryError } from './discovery.mjs';

const youtube = 'https://www.youtube.com/watch?v=nr5Pj6GQL2o';
const netflix = 'https://www.netflix.com/title/80049832';
const noDurations = { resolve: async () => null };
const noThumbnails = { resolve: async () => ({ thumbnail: '', artwork: 'forest' }) };
const query = { query: 'Gentle animal stories', services: ['youtube', 'netflix'], country: 'CZ' };
function candidate(url, title = 'A video suggestion', extra = {}) {
  return { title, url, description: 'An AI suggested description to review.', reason: 'Might fit the parent request.', ...extra };
}
function completion(candidates = [candidate(youtube)], sources = [youtube], annotations = []) {
  return {
    status: 'completed',
    output: [
      { type: 'web_search_call', status: 'completed', action: { type: 'search', sources: sources.map(url => ({ type: 'url', url })) } },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify({ summary: 'This subscription includes all titles for free.', results: candidates }), annotations }] },
    ],
  };
}
function serviceFor(data, fetchOptions = {}) {
  return createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async () => ({ ok: true, json: async () => data, ...fetchOptions }) });
}

test('AI config exposes only status, model and supported services; an absent key makes no network call', async () => {
  let calls = 0;
  const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: '  ', model: 'sk-secret-value', fetchImpl: async () => { calls += 1; } });
  assert.deepEqual(service.config(), {
    configured: false, model: 'gpt-5-mini', defaultCountry: 'CZ',
    services: [{ id: 'youtube', name: 'YouTube' }, { id: 'netflix', name: 'Netflix' }, { id: 'disney', name: 'Disney+' }, { id: 'prime', name: 'Prime Video' }, { id: 'max', name: 'HBO Max' }],
  });
  await assert.rejects(service.search(query), error => error instanceof DiscoveryError && error.status === 503 && /NEST_AI_API_KEY/.test(error.message));
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(service.config()).includes('secret'), false);
});

test('AI requests are bounded and send selected official domains with Czech country hint', async () => {
  let recorded;
  const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: '  test-key-not-live  ', model: 'gpt-5-mini', fetchImpl: async (url, options) => {
    recorded = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => completion() };
  } });
  const result = await service.search({ ...query, query: ` ${query.query} `, country: 'cz' });
  assert.equal(recorded.url, 'https://api.openai.com/v1/responses');
  assert.equal(recorded.options.method, 'POST');
  assert.equal(recorded.options.redirect, 'error');
  assert.equal(recorded.options.headers.Authorization, 'Bearer test-key-not-live');
  assert.ok(recorded.options.signal instanceof AbortSignal);
  assert.equal(recorded.body.store, false);
  assert.equal(recorded.body.model, 'gpt-5-mini');
  assert.equal(recorded.body.input, query.query);
  assert.equal(recorded.body.max_tool_calls, 4);
  assert.equal(recorded.body.max_output_tokens, 6000);
  assert.equal(recorded.body.tool_choice, 'required');
  assert.deepEqual(recorded.body.tools[0].filters.allowed_domains, ['youtube.com', 'youtu.be', 'netflix.com']);
  assert.deepEqual(recorded.body.tools[0].user_location, { type: 'approximate', country: 'CZ' });
  assert.deepEqual(recorded.body.include, ['web_search_call.action.sources']);
  assert.equal(recorded.body.text.format.type, 'json_schema');
  assert.equal(recorded.body.text.format.strict, true);
  assert.deepEqual(recorded.body.text.format.schema.properties.results.items.required, ['title', 'url', 'description', 'reason']);
  assert.equal(result.country, 'CZ');
  assert.equal(result.query, query.query);
  assert.equal(result.results.length, 1);
  assert.equal(JSON.stringify(result).includes('test-key-not-live'), false);
});

test('invalid queries, service choices and country formats fail before contacting an AI provider', async () => {
  let calls = 0;
  const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async () => { calls += 1; } });
  const invalid = [
    null, {}, [], { ...query, query: 'ab' }, { ...query, query: 'x'.repeat(1001) }, { ...query, query: 'video\u0000title' },
    { ...query, services: [] }, { ...query, services: ['youtube', 'youtube'] }, { ...query, services: ['other'] },
    { ...query, services: ['youtube', { id: 'netflix' }] }, { ...query, services: 'youtube' },
    { ...query, country: 'Czechia' }, { ...query, country: null }, { ...query, country: 'CZ\nPL' },
  ];
  for (const input of invalid) {
    await assert.rejects(service.search(input), error => error instanceof DiscoveryError && error.status === 400);
  }
  assert.equal(calls, 0);
});

test('only retrieved individual content links become suggestions and country availability stays unknown', async () => {
  const tracked = `${youtube}&feature=share`;
  const result = await serviceFor(completion([
    candidate(tracked, ' A sourced title\u0000 '),
    candidate('https://www.youtube.com/watch?v=aaaaaaaaaaa', 'Invented URL'),
    candidate(netflix, 'Not retrieved'),
    candidate('https://youtube.com.evil.test/watch?v=nr5Pj6GQL2o', 'Deceptive host'),
    candidate('https://www.youtube.com/@channel', 'Channel rather than title'),
    candidate(youtube, 'Duplicate title'),
  ], [youtube, 'https://www.youtube.com/@channel', 'https://www.youtube.com/watch?v=bbbbbbbbbbb'])).search(query);
  assert.equal(result.results.length, 1);
  const item = result.results[0];
  assert.equal(item.title, 'A sourced title');
  assert.equal(item.id, 'youtube:nr5Pj6GQL2o');
  assert.equal(item.url, youtube);
  assert.equal(item.source, 'youtube');
  assert.equal(item.providerName, 'YouTube');
  assert.equal(item.availability, 'not-verified');
  assert.equal(item.price, null);
  assert.equal(item.durationSeconds, null);
  assert.equal(item.thumbnail, '');
  assert.deepEqual(item.evidence, [{ title: 'YouTube public content page', url: youtube }]);
  assert.ok(result.warnings.some(warning => warning.includes('omitted')));
  assert.ok(result.warnings.some(warning => warning.includes('not a complete search')));
  assert.doesNotMatch(result.summary, /includes all titles for free/);
  assert.ok(Number.isFinite(Date.parse(result.searchedAt)));
});

test('URL citations can ground a result, but model-generated evidence fields cannot', async () => {
  const annotations = [{ type: 'url_citation', title: 'Official Netflix page', url: `${netflix}?source=search` }];
  const response = completion([candidate(netflix), candidate(youtube, 'Fake citation', { evidence: [{ url: youtube }] })], [], annotations);
  const result = await serviceFor(response).search(query);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].source, 'netflix');
  assert.deepEqual(result.results[0].evidence, [{ title: 'Official Netflix page', url: netflix }]);
  const ignored = await serviceFor(response).search({ ...query, services: ['youtube'] });
  assert.deepEqual(ignored.results, []);
  assert.match(ignored.summary, /does not mean the title is unavailable/);
});

test('failed or incomplete search sources and guessed open-page URLs cannot ground suggestions', async () => {
  for (const status of ['failed', 'incomplete', 'searching', undefined]) {
    const response = completion([candidate(youtube)], [youtube]);
    response.output[0].status = status;
    const result = await serviceFor(response).search(query);
    assert.deepEqual(result.results, [], `A ${status} tool call must not ground a result`);
  }
  for (const status of ['completed', 'failed']) {
    for (const actionType of ['open_page', 'find_in_page']) {
      const response = completion([candidate(youtube)], []);
      response.output[0] = { type: 'web_search_call', status, action: { type: actionType, url: youtube } };
      const result = await serviceFor(response).search(query);
      assert.deepEqual(result.results, [], 'A requested page URL alone does not show successful retrieval');
    }
  }
});

test('results are bounded and do not use invented runtime or price fields', async () => {
  const links = Array.from({ length: 12 }, (_, index) => `https://www.netflix.com/title/${80049832 + index}`);
  const result = await serviceFor(completion(links.map(url => candidate(url, 'Example', { price: 'Free', durationSeconds: 100 })), links)).search(query);
  assert.equal(result.results.length, 8);
  assert.ok(result.results.every(item => item.price === null && item.durationSeconds === null && item.availability === 'not-verified'));
});

test('provider rejection, malformed responses and transport errors never expose upstream details', async () => {
  for (const [status, expected] of [[401, 503], [403, 503], [429, 503], [500, 502]]) {
    const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async () => ({ ok: false, status, json: async () => { throw new Error('Do not read secret upstream body'); } }) });
    await assert.rejects(service.search(query), error => error instanceof DiscoveryError && error.status === expected && !/secret|test-key/.test(error.message));
  }
  for (const payload of [{ status: 'incomplete' }, { error: { message: 'secret upstream text' } }, { output_text: 'not json' }, { output_text: '{"results":[]}' }]) {
    await assert.rejects(serviceFor(payload).search(query), error => error instanceof DiscoveryError && error.status === 502 && !error.message.includes('secret'));
  }
  for (const [name, expected] of [['TimeoutError', 504], ['AbortError', 504], ['Error', 502]]) {
    const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async () => {
      const error = new Error('secret upstream text test-key-not-live');
      error.name = name;
      throw error;
    } });
    await assert.rejects(service.search(query), error => error instanceof DiscoveryError && error.status === expected && !/secret|test-key/.test(error.message));
  }
});

test('an already stopped search never contacts the AI provider', async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async () => { calls += 1; } });
  await assert.rejects(service.search(query, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});

test('stopping a search aborts its provider request without turning cancellation into a timeout', async () => {
  const controller = new AbortController();
  let providerSignal;
  const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async (_url, { signal }) => {
    providerSignal = signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const pending = service.search(query, { signal: controller.signal });
  const rejected = assert.rejects(pending, error => error.name === 'AbortError' && !(error instanceof DiscoveryError));
  assert.equal(providerSignal.aborted, false);
  controller.abort();
  assert.equal(providerSignal.aborted, true);
  await rejected;
});

test('late provider responses and bodies are discarded after cancellation even if transport ignores abort', async () => {
  for (const phase of ['request', 'body']) {
    const controller = new AbortController();
    const started = Promise.withResolvers();
    const late = Promise.withResolvers();
    let bodyRead = false;
    let outputRead = false;
    const payload = { get output_text() { outputRead = true; return JSON.stringify({ summary: '', results: [] }); } };
    const response = { ok: true, json: async () => {
      bodyRead = true;
      if (phase === 'body') { started.resolve(); return late.promise; }
      return payload;
    } };
    const service = createDiscoveryService({ durationService: noDurations, thumbnailService: noThumbnails, apiKey: 'test-key-not-live', fetchImpl: async () => {
      if (phase === 'request') { started.resolve(); return late.promise; }
      return response;
    } });
    const pending = service.search(query, { signal: controller.signal });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await started.promise;
    controller.abort();
    late.resolve(phase === 'request' ? response : payload);
    await rejected;
    assert.equal(outputRead, false, `Cancelled ${phase} must not parse a result`);
    assert.equal(bodyRead, phase === 'body', 'A cancelled request must not begin reading its body');
  }
});

test('only grounded suggestions receive web thumbnails and thematic fallback artwork', async () => {
  const calls = [];
  const service = createDiscoveryService({ durationService: noDurations,
    apiKey: 'test-key-not-live',
    fetchImpl: async () => ({ ok: true, json: async () => completion([candidate(youtube, 'Space discoveries'), candidate(netflix, 'A story'), candidate('https://www.netflix.com/title/99999999', 'Invented')], [youtube, netflix]) }),
    thumbnailService: { resolve: async (url, options) => {
      calls.push({ url, options });
      return { thumbnail: url === youtube ? 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg' : '', artwork: url === youtube ? 'space' : 'stories' };
    } },
  });
  const result = await service.search(query);
  assert.equal(result.results.length, 2);
  assert.deepEqual(calls.map(call => call.url), [youtube, netflix]);
  assert.equal(calls[0].options.title, 'Space discoveries');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(result.results[0].thumbnail, 'https://i.ytimg.com/vi/nr5Pj6GQL2o/hqdefault.jpg');
  assert.equal(result.results[0].artwork, 'space');
  assert.equal(result.results[1].thumbnail, '');
  assert.equal(result.results[1].artwork, 'stories');
});

test('thumbnail enrichment limits concurrent work and stops remaining images when search is cancelled', async () => {
  const links = Array.from({ length: 5 }, (_, index) => `https://www.netflix.com/title/${80049832 + index}`);
  const controller = new AbortController();
  const started = Promise.withResolvers();
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const signals = [];
  const service = createDiscoveryService({ durationService: noDurations,
    apiKey: 'test-key-not-live',
    fetchImpl: async () => ({ ok: true, json: async () => completion(links.map(url => candidate(url)), links) }),
    thumbnailService: { resolve: async (_url, { signal }) => {
      signals.push(signal);
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (calls === 3) started.resolve();
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => { active -= 1; reject(signal.reason); }, { once: true }));
    } },
  });
  const pending = service.search(query, { signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  controller.abort();
  await rejected;
  assert.equal(calls, 3);
  assert.equal(maxActive, 3);
  assert.equal(active, 0);
  assert.ok(signals.every(signal => signal.aborted));
});

test('verified durations enrich suggestions without using model-generated lengths', async () => {
  const service = createDiscoveryService({
    apiKey: 'test-key-not-live', thumbnailService: noThumbnails,
    durationService: { resolve: async url => url === youtube ? 245 : null },
    fetchImpl: async () => ({ ok: true, json: async () => completion([candidate(youtube, 'Space tour', { durationSeconds: 999 }), candidate(netflix, 'A story', { durationSeconds: 123 })], [youtube, netflix]) }),
  });
  const result = await service.search(query);
  assert.equal(result.results[0].durationSeconds, 245);
  assert.equal(result.results[1].durationSeconds, null);
});

test('optional previews do not discard a completed answer when its earlier AI timeout expires', async t => {
  const timer = new AbortController();
  t.mock.method(AbortSignal, 'timeout', () => timer.signal);
  const service = createDiscoveryService({
    apiKey: 'test-key-not-live', durationService: noDurations,
    thumbnailService: { resolve: async (_url, { signal }) => {
      timer.abort(new DOMException('AI timer expired after completion', 'TimeoutError'));
      assert.equal(signal.aborted, false);
      return { thumbnail: '', artwork: 'space' };
    } },
    fetchImpl: async () => ({ ok: true, json: async () => completion() }),
  });
  const result = await service.search(query);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].artwork, 'space');
});
