async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compares the entered password against the hash of AUTH_PASSWORD from .env. */
export async function verifyPassword(password: string): Promise<boolean> {
  return (await sha256Hex(password)) === __AUTH_PASSWORD_HASH__
}
