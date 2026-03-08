/**
 * Slugify a display name into a username.
 * Lowercase, remove special chars, replace spaces/hyphens with nothing.
 * "Jacob Kim" → "jacobkim"
 * "María García-López" → "maragarcalopez"
 */
export function generateUsername(displayName) {
  return displayName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]/g, "")      // remove non-alphanumeric
    .slice(0, 80);                   // cap length
}

/**
 * Resolve a unique username by appending incrementing numbers if needed.
 * "jacobkim" → "jacobkim", "jacobkim2", "jacobkim3", ...
 *
 * @param {string} displayName
 * @param {(username: string) => Promise<boolean>} existsFn - checks if username is taken
 * @returns {Promise<string>} unique username
 */
export async function resolveUsername(displayName, existsFn) {
  const base = generateUsername(displayName);

  if (!base) {
    // Fallback for empty/non-latin names
    const fallback = `user${Date.now()}`;
    return fallback;
  }

  if (!(await existsFn(base))) {
    return base;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${base}${suffix}`;
    if (!(await existsFn(candidate))) {
      return candidate;
    }
    suffix++;
  }

  throw new Error(`Could not resolve unique username for "${displayName}" after 999 attempts`);
}
