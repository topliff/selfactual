// CSS Account API wrapper for Community Solid Server v0.5
//
// Flow discovered in Step 0 validation:
//   1. POST /.account/account/ → create account, get CSS-Account-Token
//   2. GET /.account/ (authed) → discover account-specific endpoints
//   3. POST .../login/password/ → register email/password login
//   4. POST .../pod/ → create pod, returns podUrl + webId
//   5. POST .../client-credentials/ → register client credentials

const CSS_BASE_URL = process.env.CSS_BASE_URL || "https://vaults.selfactual.ai";

/**
 * Create a new CSS account. Returns the authorization token and account ID.
 */
export async function createCssAccount() {
  // Step 1: Create the account (empty body)
  const createRes = await fetch(`${CSS_BASE_URL}/.account/account/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`CSS account creation failed: HTTP ${createRes.status} — ${errText}`);
  }

  const createData = await createRes.json();
  const authorization = createData.authorization;

  if (!authorization) {
    throw new Error("CSS account creation returned no authorization token");
  }

  return { authorization };
}

/**
 * Get authenticated account controls. Returns the controls object with
 * account-specific endpoints for pod creation, credentials, etc.
 */
export async function getAccountControls(authorization) {
  const res = await fetch(`${CSS_BASE_URL}/.account/`, {
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to get account controls: HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.controls;
}

/**
 * Extract the CSS account ID from the controls URLs.
 * Controls URLs contain the account UUID, e.g.:
 *   .../account/7cca6c42-740d-471b-a352-6a58586c83f4/pod/
 */
export function extractAccountId(controls) {
  const podUrl = controls?.account?.pod || controls?.account?.clientCredentials || "";
  const match = podUrl.match(/account\/([0-9a-f-]+)\//);
  return match ? match[1] : null;
}

/**
 * Register a password login for the account.
 */
export async function registerPasswordLogin(authorization, controls, email, password) {
  const endpoint = controls?.password?.create;
  if (!endpoint) {
    throw new Error("No password registration endpoint in controls");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Password registration failed: HTTP ${res.status} — ${errText}`);
  }

  return await res.json();
}

/**
 * Create a pod for the account. Returns { pod, webId, podResource, webIdResource }.
 */
export async function createPod(authorization, controls, podName) {
  const endpoint = controls?.account?.pod;
  if (!endpoint) {
    throw new Error("No pod creation endpoint in controls");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: podName }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pod creation failed: HTTP ${res.status} — ${errText}`);
  }

  return await res.json();
}

/**
 * Register client credentials for Solid-OIDC authentication.
 * Returns { id, secret }.
 */
export async function registerCredentials(authorization, controls, name, webId) {
  const endpoint = controls?.account?.clientCredentials;
  if (!endpoint) {
    throw new Error("No client credentials endpoint in controls");
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `CSS-Account-Token ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, webId }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Credential registration failed: HTTP ${res.status} — ${errText}`);
  }

  return await res.json();
}
