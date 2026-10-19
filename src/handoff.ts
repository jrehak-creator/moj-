export type LaunchMethod = 'direct' | 'shortcut';
export const defaultShortcutName = 'Nest Playback';

export function canonicalNetflix(input: string) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || !['netflix.com', 'www.netflix.com'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Use a Netflix title or watch link.');
  const match = url.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(title|watch)\/(\d{4,16})\/?$/i);
  if (!match) throw new Error('Use netflix.com/watch/… for an exact video, or netflix.com/title/… to let a parent choose the episode.');
  return `https://www.netflix.com/${match[1].toLowerCase()}/${match[2]}`;
}

export function validShortcutName(name: string) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 80 && !/[\u0000-\u001f\u007f]/.test(name);
}

/** Invoke the shortcut explicitly; do not rely on Netflix's app-opened event. */
export function handoffUrl(input: string, method: LaunchMethod = 'direct', shortcutName = defaultShortcutName) {
  const videoUrl = canonicalNetflix(input);
  if (method === 'direct') return videoUrl;
  if (method !== 'shortcut') throw new Error('Choose a supported launch method.');
  if (!validShortcutName(shortcutName)) throw new Error('Enter the installed Shortcut’s exact name, using 1–80 characters.');
  return `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName.trim())}&input=text&text=${encodeURIComponent(videoUrl)}`;
}
