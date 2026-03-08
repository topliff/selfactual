# Progress Log

Chronological record of what's been built, tested, and decided.

---

## 2026-02-27 — Pod Validation (Infrastructure Proof)

### What happened

Ran a full validation of the live CSS instance at `https://vaults.selfactual.ai/` to prove that the dual-pod architecture works as designed.

### Steps completed

1. **Created test account** via CSS web UI at `https://vaults.selfactual.ai/`
   - Pod URL: `https://vaults.selfactual.ai/test_pod/`
   - WebID: `https://vaults.selfactual.ai/test_pod/profile/card#me`

2. **Registered client credentials** via CSS Account API
   - Used `scripts/create-credentials.mjs` to get a `client_id` and `client_secret` tied to the test WebID
   - These credentials enable programmatic Solid-OIDC authentication (DPoP tokens) — required for reading/writing pod resources

3. **Created dual-pod container structure** using `@inrupt/solid-client`:
   ```
   /test_pod/master/
   /test_pod/master/assessments/
   /test_pod/master/reflections/
   /test_pod/master/reflections/strength-reflections/
   /test_pod/master/context/
   /test_pod/master/provenance/
   /test_pod/sub/
   /test_pod/sub/assessments/
   /test_pod/sub/context/
   ```

4. **Wrote Star Card assessment to master pod** (with reflection link):
   - Scores: Thinking 78, Acting 65, Feeling 82, Planning 71
   - Profile shape: Connector
   - Includes `sa:hasReflections` link to `master/reflections/strength-reflections/`

5. **Wrote Star Card assessment to sub pod** (without reflection link):
   - Same scores and metadata
   - `sa:hasReflections` link deliberately omitted — sub pod must not reference private master resources

6. **Wrote test reflection to master only**:
   - Reflection on "Thinking" dimension
   - Includes explicit links: `sa:aboutAssessment` → starcard, `sa:aboutScore` → 78
   - Includes dimension description, prompt text, and user response
   - This is the key design move: the pod resource contains context that doesn't exist in the database

7. **Read back all resources and verified**:
   - ✅ Feeling score (82) round-tripped as integer
   - ✅ Master copy contains reflection link
   - ✅ Sub copy does NOT contain reflection link
   - ✅ Reflection links to assessment with correct score
   - ✅ Reflection text round-tripped correctly
   - ✅ Profile shape "Connector" preserved

8. **Tested access control**:
   - ✅ Unauthenticated request to master → HTTP 401
   - ✅ Unauthenticated request to sub → HTTP 401 (default CSS behavior; will configure explicit ACLs to open sub to authorized apps)

### What this proves

- The CSS instance handles RDF read/write correctly
- The dual-pod container structure works as designed
- The master/sub separation holds — private data stays private
- Solid-OIDC client credentials auth works for programmatic access
- The Inrupt client libraries work against our CSS instance
- The RDF resource design (from `pod-resources-sketch.md`) is viable — not just a paper design

### What it doesn't yet prove

- Cross-account access control (app reading from another user's sub pod)
- WAC ACL configuration (explicit permissions beyond CSS defaults)
- Concurrent multi-source data (AST + Atlas data coexisting)
- Automated provisioning (both pods created on signup without manual steps)

### Key learning: CSS auth is two-layered

The CSS Account API (`/.account/`) uses a simple email/password login that returns a `CSS-Account-Token`. This token only works for account management (creating credentials, linking WebIDs). It does NOT work for pod operations.

Pod read/write operations require proper Solid-OIDC authentication with DPoP tokens. The workflow is:
1. Register client credentials via the Account API (one-time)
2. Use those credentials with `@inrupt/solid-client-authn-node` to get a Solid-OIDC session
3. Use `session.fetch` (which adds DPoP tokens automatically) for all pod operations

This means bash/curl scripts can't easily write to pods — you need a proper Solid client library. The validation script was rewritten from bash to Node.js for this reason.

### Scripts created

| Script | Purpose |
|--------|---------|
| `scripts/create-credentials.mjs` | One-time: registers client credentials via CSS Account API |
| `scripts/validate-pod.mjs` | Validates pod operations: creates containers, writes/reads resources, tests auth |
| `scripts/package.json` | Dependencies: `@inrupt/solid-client`, `@inrupt/solid-client-authn-node` |
| `scripts/validate-pod.sh` | (Deprecated) Initial bash attempt — failed due to CSS auth model requiring DPoP tokens |

---

## 2026-02-27 — Design Documentation

### Documents created/updated

- **`docs/app-ecosystem.md`** — Comprehensive ecosystem doc covering all six apps, their vault roles, data flows, Auth0 decision, and POC scope
- **`docs/pod-resources-sketch.md`** — RDF resource design with Turtle examples for all resource types, container layouts, ACL sketches, and data flow diagrams
- **`docs/project-context.md`** — Updated to reflect current system status, resolved design decisions, and live test pod data
- **`docs/progress-log.md`** — This file
- **`TODO.md`** — Updated with completion status for all tasks

---

## 2026-02-27 — Trust Architecture

### What happened

Documented the data fiduciary model for SelfActual's custodial relationship with user data. SelfActual runs the pod server and technically can access any pod, so the trust architecture defines how every layer of the system — technical, legal, commercial — reinforces the fiduciary obligation without marketing it explicitly.

### Key framework

SelfActual as a **data fiduciary**, analogous to a financial fiduciary: has custody of user assets (data), is bound by duty of care and loyalty, and is accountable through transparency and audit. The trust is implicit — built into the architecture and business model, not sold as a feature.

### Six reinforcing layers

1. **Portability** — Data in standard RDF/Solid format. Users can export and leave. No lock-in.
2. **Business model** — Revenue from apps/services, not data monetization. No conflict of interest.
3. **Access minimization** — No admin tools that browse pod contents. Least privilege. No analytics on pod data.
4. **Encryption roadmap** — Phase 1: TLS + EBS encryption. Phase 2: app-level encryption with user-derived keys. Phase 3: user-held keys (self-custody option).
5. **Legal structure** — ToS as fiduciary obligation. Right to delete. Breach notification.
6. **Transparency** — Provenance logs (already designed), access logs (to build), public transparency reports.

### Document created

`docs/trust-architecture.md`

---

## 2026-02-27 — Design Documentation

### Key decisions documented

1. **Atlas is pod-native** — no separate database, writes directly to pods. Existing backlog (VAULT-001 through VAULT-055) needs rework.
2. **Shared Auth0 tenant** — all apps use the same Auth0 tenant for user identity. One tenant, multiple app registrations, single user identity.
3. **Coaching Mentor app** (not "Growth Plan") — broader AI coaching companion that produces "Working With Me" documents for the sub pod.
4. **Middle-path for AST** — keeps existing Postgres, adds pod write service to sync data. No database replacement.
5. **Push at write time** — data flows from producer to both pods in a single write operation, with private data stripped from sub copy.
