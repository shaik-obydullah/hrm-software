import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// Pure-JS PBKDF2 on older Android hardware is slow. A local 4-6 digit PIN has
// a small keyspace anyway, so 1,000 salted rounds is a reasonable balance
// between responsiveness and offline guessing cost.
const ITERATIONS = 1_000;
const SALT_BYTES = 16;

function randomSalt(): Uint8Array {
  // Hermes has no Web Crypto. A local device PIN is a deterrent, not a
  // network secret; this salt only needs to be unique per install.
  const salt = new Uint8Array(SALT_BYTES);
  for (let i = 0; i < SALT_BYTES; i += 1) {
    salt[i] = Math.floor(Math.random() * 256);
  }
  return salt;
}

export function hashPin(pin: string): string {
  const salt = randomSalt();
  const hash = pbkdf2(sha256, utf8ToBytes(pin), salt, {
    c: ITERATIONS,
    dkLen: 32,
  });
  return `pbkdf2$${ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(hash)}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }
  const iterations = Number(parts[1]);
  const salt = hexToBytes(parts[2]);
  const expected = hexToBytes(parts[3]);
  if (!Number.isFinite(iterations) || iterations <= 0) {
    return false;
  }
  const actual = pbkdf2(sha256, utf8ToBytes(pin), salt, {
    c: iterations,
    dkLen: expected.length,
  });
  if (actual.length !== expected.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}
