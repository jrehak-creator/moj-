import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalNetflix, handoffUrl } from './handoff.ts';

test('direct handoff preserves the exact Netflix watch video and removes tracking', () => {
  assert.equal(handoffUrl('https://www.netflix.com/watch/81361080?trackId=284725014'), 'https://www.netflix.com/watch/81361080');
  assert.equal(canonicalNetflix('https://netflix.com/cz-en/title/80049832'), 'https://www.netflix.com/title/80049832');
});

test('shortcut handoff encodes the exact shortcut name and selected video as independent parameters', () => {
  const name = 'Nest & Family + Kids / 🎬';
  const result = handoffUrl('https://www.netflix.com/watch/81361080?trackId=284725014', 'shortcut', name);
  const parsed = new URL(result);
  assert.equal(parsed.protocol, 'shortcuts:');
  assert.equal(parsed.hostname, 'run-shortcut');
  assert.equal(parsed.searchParams.get('name'), name);
  assert.equal(parsed.searchParams.get('input'), 'text');
  assert.equal(parsed.searchParams.get('text'), 'https://www.netflix.com/watch/81361080');
  assert.deepEqual([...parsed.searchParams.keys()], ['name', 'input', 'text']);
  assert.match(result, /name=Nest%20%26/);
  assert.ok(!result.includes('trackId'));
});

test('neither launch method accepts arbitrary destinations or malformed shortcut names', () => {
  for (const url of ['javascript:alert(1)', 'shortcuts://run-shortcut?name=other', 'https://www.netflix.com.evil.test/watch/81361080', 'https://user:password@netflix.com/watch/81361080', 'https://netflix.com/browse', 'https://netflix.com/watch/81361080/extra']) {
    for (const method of ['direct', 'shortcut']) assert.throws(() => handoffUrl(url, method));
  }
  for (const name of ['', '  ', 'x'.repeat(81), 'Nest\nPlayback']) assert.throws(() => handoffUrl('https://netflix.com/watch/81361080', 'shortcut', name));
  assert.throws(() => handoffUrl('https://netflix.com/watch/81361080', 'unknown'));
});
