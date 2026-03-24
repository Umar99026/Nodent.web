export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ salt: string; hash: string }> {
  const encoder = new TextEncoder();
  const saltBytes = existingSalt
    ? hexToBytes(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    512
  );

  return { salt, hash: bytesToHex(new Uint8Array(hashBuffer)) };
}

export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== storedHash.length) return false;

  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
