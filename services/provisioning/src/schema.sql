CREATE TABLE IF NOT EXISTS vault_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,          -- opaque ID from calling app
  auth0_sub VARCHAR(255) NOT NULL UNIQUE, -- Auth0 subject identifier
  css_account_id VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  web_id VARCHAR(500) NOT NULL,
  master_pod_url VARCHAR(500) NOT NULL,
  sub_pod_url VARCHAR(500) NOT NULL,
  provisioning_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  last_error TEXT,
  provisioned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vault_accounts_auth0_sub ON vault_accounts(auth0_sub);
CREATE INDEX IF NOT EXISTS idx_vault_accounts_username ON vault_accounts(username);
