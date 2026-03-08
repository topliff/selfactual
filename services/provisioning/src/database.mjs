import pg from "pg";

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

export async function createVaultAccount({
  userId,
  auth0Sub,
  cssAccountId,
  username,
  webId,
  masterPodUrl,
  subPodUrl,
  provisioningStatus = "pending",
}) {
  const result = await getPool().query(
    `INSERT INTO vault_accounts
      (user_id, auth0_sub, css_account_id, username, web_id, master_pod_url, sub_pod_url, provisioning_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, auth0Sub, cssAccountId, username, webId, masterPodUrl, subPodUrl, provisioningStatus]
  );
  return result.rows[0];
}

export async function getByAuth0Sub(auth0Sub) {
  const result = await getPool().query(
    "SELECT * FROM vault_accounts WHERE auth0_sub = $1",
    [auth0Sub]
  );
  return result.rows[0] || null;
}

export async function getByUsername(username) {
  const result = await getPool().query(
    "SELECT * FROM vault_accounts WHERE username = $1",
    [username]
  );
  return result.rows[0] || null;
}

export async function updateStatus(auth0Sub, status, lastError = null) {
  const result = await getPool().query(
    `UPDATE vault_accounts
     SET provisioning_status = $1::text, last_error = $2, updated_at = NOW(),
         provisioned_at = CASE WHEN $1::text = 'complete' THEN NOW() ELSE provisioned_at END
     WHERE auth0_sub = $3
     RETURNING *`,
    [status, lastError, auth0Sub]
  );
  return result.rows[0] || null;
}

export async function usernameExists(username) {
  const result = await getPool().query(
    "SELECT 1 FROM vault_accounts WHERE username = $1",
    [username]
  );
  return result.rows.length > 0;
}
