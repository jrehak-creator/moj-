import { networkInterfaces } from 'node:os';
import { pathToFileURL } from 'node:url';

/** Physical network interfaces on macOS normally use en0, en1, etc. */
export function ipadAddresses(interfaces, port = 3001) {
  const addresses = [];
  const seen = new Set();
  for (const [name, entries] of Object.entries(interfaces).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (!/^en\d+$/.test(name)) continue;
    for (const entry of entries ?? []) {
      if (entry.internal || (entry.family !== 'IPv4' && entry.family !== 4)) continue;
      if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(entry.address) || entry.address.startsWith('169.254.') || entry.address.startsWith('127.') || seen.has(entry.address)) continue;
      seen.add(entry.address);
      addresses.push(`http://${entry.address}:${port}`);
    }
  }
  return addresses;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const addresses = ipadAddresses(networkInterfaces(), Number(process.env.PORT || 3001));
  if (addresses.length) {
    console.log('\nOn your iPad, connect to the same Wi-Fi and enter this in Safari:');
    for (const address of addresses) console.log(`  ${address}`);
    if (addresses.length > 1) console.log('There is more than one active network. Try the Wi-Fi address first.');
  } else {
    console.log('\nFind your Mac’s IP address in System Settings > Wi-Fi > Details > TCP/IP.');
    console.log(`On your iPad, enter http:// followed by that IP address and :${Number(process.env.PORT || 3001)} in Safari.`);
  }
}
