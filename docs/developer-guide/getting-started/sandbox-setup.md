# Sandbox Setup

To develop against SelfActual pods without affecting real user data, you'll work with pre-provisioned sandbox pods that contain realistic sample data.

## What You Get

Each development partner receives:

1. **A service account** — Your app's identity (WebID + credentials)
2. **Sandbox user pods** — 2–3 pre-populated user pod pairs (master + sub), with your service account granted read access on the sub pods
3. **A sandbox org pod** — A sample organization with team rosters linking to the sandbox users

### Sandbox Users

| Username | Profile | Star Card Shape | Notes |
|----------|---------|-----------------|-------|
| `sandbox-alice` | "Alice Torres", Product Manager | Connector (feeling-dominant) | Complete data: assessments, reflections, final insight |
| `sandbox-bob` | "Bob Nakamura", Engineering Lead | Strategist (thinking-dominant) | Assessments only, no reflections yet |
| `sandbox-cara` | "Cara Osei", Design Director | Catalyst (acting-dominant) | Complete data with flow attributes |

### Sandbox URLs

```
# Alice's sub pod (full data)
https://vaults.selfactual.ai/sandbox-alice/sub/

# Bob's sub pod (assessments only)
https://vaults.selfactual.ai/sandbox-bob/sub/

# Cara's sub pod (full data with flow)
https://vaults.selfactual.ai/sandbox-cara/sub/

# Sandbox org pod
https://vaults.selfactual.ai/org-sandbox-acme/
```

## Requesting Sandbox Access

Contact the SelfActual team to receive:

1. Your service account credentials (client ID + secret)
2. Confirmation that the sandbox pods have ACL entries for your WebID
3. Access to the partner Slack channel for support

## Verifying Your Setup

Once you have credentials, confirm everything works:

```bash
# Using the Node.js example from this repo:
cd examples/node-read-starcard
cp .env.example .env
# Edit .env with your credentials

npm install
node index.js
```

Expected output:
```
Authenticated as: https://vaults.selfactual.ai/yourapp-service/profile/card#me
Reading: https://vaults.selfactual.ai/sandbox-alice/sub/assessments/starcard

Star Card for sandbox-alice:
  Thinking: 78
  Acting:   65
  Feeling:  82
  Planning: 71
  Shape:    Connector
```

## Sub Pod Contents (What Your App Sees)

Your app has read access to sub pods only. Here's what's inside:

```
/sandbox-alice/sub/
├── profile-summary          # Name, job title, company (no email)
├── assessments/
│   ├── starcard             # Four quadrant scores + derived attributes
│   └── flow-attributes      # Flow profile (if completed)
└── context/
    └── ast-framework        # Dimension definitions, score ranges, methodology
```

Things your app **cannot** see:
- Master pod contents (reflections, full profile, provenance logs)
- Other users' pods (unless your WebID is in their ACL)
- Any resource where your WebID isn't authorized

A `403 Forbidden` response means the ACL doesn't include your WebID. A `404 Not Found` means the resource doesn't exist (e.g., Bob hasn't completed flow attributes).

## Resetting Sandbox Data

Sandbox pods can be reset to their original state. Contact the SelfActual team if you need a reset — this is useful after testing write operations.

## Working Offline

If you need to develop without network access to `vaults.selfactual.ai`, the `sandbox/` directory in this repo contains static Turtle files matching the sandbox pod contents. These are snapshots — they won't reflect any writes you've made to the live sandbox.

```
sandbox/
├── sandbox-alice-sub-starcard.ttl
├── sandbox-alice-sub-flow-attributes.ttl
├── sandbox-alice-sub-profile-summary.ttl
├── sandbox-bob-sub-starcard.ttl
├── sandbox-cara-sub-starcard.ttl
├── sandbox-cara-sub-flow-attributes.ttl
├── ast-framework.ttl
└── org-sandbox-acme-team-engineering.ttl
```

---

Next: [Your First Read →](first-read.md)
