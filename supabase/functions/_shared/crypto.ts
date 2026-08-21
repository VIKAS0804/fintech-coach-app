function requireEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`${name} is not set.`);
  }

  return value;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function getEncryptionKey() {
  const rawKey = requireEnv('PLAID_ACCESS_TOKEN_ENCRYPTION_KEY');
  const encodedKey = new TextEncoder().encode(rawKey.padEnd(32, '0').slice(0, 32));

  return crypto.subtle.importKey('raw', encodedKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptString(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey();
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    new TextEncoder().encode(value),
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptString(payload: string) {
  const [ivSegment, encryptedSegment] = payload.split('.');

  if (!ivSegment || !encryptedSegment) {
    throw new Error('Encrypted Plaid token payload is malformed.');
  }

  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: fromBase64(ivSegment),
    },
    key,
    fromBase64(encryptedSegment),
  );

  return new TextDecoder().decode(decrypted);
}
