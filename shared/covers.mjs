/** Select original Nest artwork when a service does not expose a usable image. */
export function coverArtworkFor(details = {}) {
  const { title = '', description = '', tags = [] } = details || {};
  const original = [title, description, ...(Array.isArray(tags) ? tags : [])]
    .filter(value => typeof value === 'string').join(' ').toLowerCase();
  const text = original.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\bmoře\b/.test(original) || /\b(ocean|sea|marine|underwater|whale|dolphin|shark|fish|reef|morsk\w*|ryb\w*|delfin\w*|velryb\w*)\b/.test(text)) return 'ocean';
  if (/\b(space|astronaut\w*|galaxy|rocket\w*|cosmos|moon|vesmir\w*|raket\w*|mesic\w*)\b/.test(text)) return 'space';
  if (/\b(music\w*|song\w*|sing\w*|dance\w*|dancing|hudb\w*|pisnic\w*|zpev\w*|tanc\w*)\b/.test(text)) return 'music';
  if (/\b(butterfl\w*|insect\w*|bug\w*|bee|bees|motyl\w*|hmyz\w*|vcel\w*)\b/.test(text)) return 'butterfly';
  if (/\b(bear\w*|panda\w*|medved\w*)\b/.test(text)) return 'bears';
  if (/\b(earth|planet\w*|environment\w*|climate\w*|geograph\w*|zem\w*|prirodni prostredi|klima\w*|ekolog\w*)\b/.test(text)) return 'earth';
  if (/\b(animal\w*|nature|forest\w*|wildlife|woodland\w*|zvir\w*|prirod\w*|les\w*)\b/.test(text)) return 'forest';
  return 'stories';
}
