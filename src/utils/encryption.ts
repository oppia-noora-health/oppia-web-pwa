// utils/encryption.ts
// Simple encryption utility using Web Crypto API for sensitive data storage

const ENCRYPTION_KEY = "noora-health-api-settings-key-v1";

/**
 * Generate a crypto key from the encryption key string
 */
async function generateKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(ENCRYPTION_KEY);

  // Import the key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  // Derive the actual key
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("noora-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a string value
 */
export async function encryptValue(value: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const key = await generateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedData = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encryptedData.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedData), iv.length);

    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    throw new Error("Failed to encrypt value");
  }
}

/**
 * Decrypt a string value
 */
export async function decryptValue(encryptedValue: string): Promise<string> {
  try {
    // Convert from base64
    const combined = Uint8Array.from(atob(encryptedValue), (c) =>
      c.charCodeAt(0)
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);

    const key = await generateKey();

    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
      },
      key,
      encryptedData
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
  } catch (error) {
    throw new Error("Failed to decrypt value");
  }
}

/**
 * Store encrypted value in localStorage
 */
export async function storeEncrypted(
  key: string,
  value: string
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const encrypted = await encryptValue(value);
    localStorage.setItem(key, encrypted);
  } catch (error) {
    throw error;
  }
}

/**
 * Retrieve and decrypt value from localStorage
 */
export async function retrieveEncrypted(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    const encrypted = localStorage.getItem(key);
    if (!encrypted) return null;

    return await decryptValue(encrypted);
  } catch (error) {
    return null;
  }
}
