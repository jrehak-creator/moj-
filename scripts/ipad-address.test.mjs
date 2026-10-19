import test from 'node:test';
import assert from 'node:assert/strict';
import { ipadAddresses } from './ipad-address.mjs';

test('Mac handoff lists physical IPv4 addresses and excludes VPN, loopback, IPv6, and disconnected interfaces', () => {
  const ip = (address, extra = {}) => ({ address, family: 'IPv4', internal: false, ...extra });
  assert.deepEqual(ipadAddresses({
    lo0: [ip('127.0.0.1', { internal: true })],
    utun0: [ip('10.8.0.1')],
    en1: [ip('192.168.1.30'), ip('192.168.1.30')],
    en0: [ip('192.168.1.20'), ip('fe80::1', { family: 'IPv6' }), ip('169.254.1.1')],
    en2: undefined,
  }), ['http://192.168.1.20:3001', 'http://192.168.1.30:3001']);
  assert.deepEqual(ipadAddresses({ en0: [ip('192.168.1.20', { family: 4 })] }, 3002), ['http://192.168.1.20:3002']);
  assert.deepEqual(ipadAddresses({}), []);
});
