import test from 'node:test';
import assert from 'node:assert/strict';
import { youtubeEmbedUrl } from './player.ts';

test('YouTube embeds retain the exact selected video and drop playlist and tracking parameters', () => {
  for (const input of ['https://youtu.be/nr5Pj6GQL2o?feature=share', 'https://www.youtube.com/watch?v=nr5Pj6GQL2o&list=PLother&index=4', 'https://m.youtube.com/shorts/nr5Pj6GQL2o', 'https://www.youtube.com/live/nr5Pj6GQL2o']) {
    const embed = new URL(youtubeEmbedUrl(input, 'https://nest.example.test/discover'));
    assert.equal(embed.origin, 'https://www.youtube-nocookie.com');
    assert.equal(embed.pathname, '/embed/nr5Pj6GQL2o');
    assert.equal(embed.searchParams.get('origin'), 'https://nest.example.test');
    assert.equal(embed.searchParams.get('autoplay'), '0');
    assert.equal(embed.searchParams.get('playsinline'), '1');
    assert.equal(embed.searchParams.get('rel'), '0');
    assert.equal(embed.searchParams.has('list'), false);
    assert.equal(embed.searchParams.has('index'), false);
    assert.equal(embed.searchParams.has('feature'), false);
  }
});

test('the in-app player rejects unsupported pages, deceptive hosts, and arbitrary embed destinations', () => {
  for (const input of ['javascript:alert(1)', 'https://netflix.com/watch/81361080', 'https://youtube.com.evil.test/watch?v=nr5Pj6GQL2o', 'https://user:pass@youtube.com/watch?v=nr5Pj6GQL2o', 'https://youtube.com:8443/watch?v=nr5Pj6GQL2o', 'https://www.youtube.com/playlist?list=other', 'https://www.youtube.com/watch?v=nr5Pj6GQL2o&v=aqz-KE-bpKQ', 'https://www.youtube.com/watch?v=short']) assert.throws(() => youtubeEmbedUrl(input, 'https://nest.example.test'));
  assert.throws(() => youtubeEmbedUrl('https://youtu.be/nr5Pj6GQL2o', 'javascript:alert(1)'));
});
