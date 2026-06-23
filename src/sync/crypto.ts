/**
 * Client-side encryption for synced model state. Everything here runs against
 * the Web Crypto API (globalThis.crypto.subtle), which is present in modern
 * browsers and in Node 22, so the same code path serves the app and the tests.
 *
 * A passphrase is stretched into an AES-GCM key with PBKDF2 over a random salt.
 * The salt and IV are random per call and travel alongside the ciphertext, so
 * the same plaintext encrypts to a different blob every time and decryption can
 * reconstruct the key without storing it anywhere.
 */

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

const subtle = globalThis.crypto.subtle;

function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = new TextEncoder().encode(passphrase);
  return subtle
    .importKey("raw", material, "PBKDF2", false, ["deriveKey"])
    .then((baseKey) =>
      subtle.deriveKey(
        {
          name: "PBKDF2",
          salt,
          iterations: PBKDF2_ITERATIONS,
          hash: "SHA-256",
        },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
    );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encryptState(plain: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt);

  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );

  // Lay out salt || iv || ciphertext so decrypt can slice them back apart.
  const blob = new Uint8Array(salt.length + iv.length + ciphertext.length);
  blob.set(salt, 0);
  blob.set(iv, salt.length);
  blob.set(ciphertext, salt.length + iv.length);

  return toBase64(blob);
}

export async function decryptState(blob: string, passphrase: string): Promise<string> {
  const bytes = fromBase64(blob);
  if (bytes.length < SALT_BYTES + IV_BYTES) {
    throw new Error("Malformed sync blob");
  }

  const salt = bytes.subarray(0, SALT_BYTES);
  const iv = bytes.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES);
  const ciphertext = bytes.subarray(SALT_BYTES + IV_BYTES);

  const key = await deriveKey(passphrase, salt);

  // A wrong passphrase or tampered bytes fail the GCM auth tag and reject here.
  const plain = await subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}
