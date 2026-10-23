/** Build an official embed for one YouTube video, without playlists or tracking. */
export function youtubeEmbedUrl(input: string, appOrigin: string): string {
  if (typeof input !== 'string' || input.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(input)) throw new Error('Use a link to one YouTube video.');
  const link = new URL(input);
  if (!['https:', 'http:'].includes(link.protocol) || link.username || link.password || link.port || !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(link.hostname)) throw new Error('Use a supported YouTube video link.');
  let id: string | null | undefined;
  if (link.hostname === 'youtu.be') id = link.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  else if (/^\/watch\/?$/.test(link.pathname) && link.searchParams.getAll('v').length === 1) id = link.searchParams.get('v');
  else id = link.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})\/?$/)?.[1];
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Use a link to one YouTube video.');
  const origin = new URL(appOrigin);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('The player needs a valid Nest web address.');
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  embed.searchParams.set('origin', origin.origin);
  embed.searchParams.set('enablejsapi', '1');
  embed.searchParams.set('playsinline', '1');
  embed.searchParams.set('rel', '0');
  embed.searchParams.set('autoplay', '0');
  return embed.href;
}
