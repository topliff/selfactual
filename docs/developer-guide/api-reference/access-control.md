# Access Control

SelfActual uses Web Access Control (WAC), the standard Solid authorization mechanism. This document explains how ACLs work from a partner app's perspective.

## How ACLs Work

Every resource and container in a Solid Pod can have an Access Control List (ACL) — a set of rules that define who can do what. ACLs are themselves RDF resources (`.acl` files stored alongside the resource they protect).

An ACL entry specifies:

- **Who** — An agent (identified by WebID) or an origin (a web app's domain)
- **What** — Which resource or container
- **How** — Read, Write, Append, or Control

## Your App's Access

As a partner app, your service account WebID will be granted access by SelfActual on a per-pod basis. The typical grants are:

### Read-Only Access (Default for Partners)

```turtle
<#partnerRead>
    a acl:Authorization ;
    acl:agent       <https://vaults.selfactual.ai/yourapp-service/profile/card#me> ;
    acl:accessTo    <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:default     <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:mode        acl:Read .
```

This grants your WebID read access to the sub pod root and (via `acl:default`) all resources within it.

### Read + Write Access (For Partners Contributing Data)

```turtle
<#partnerWrite>
    a acl:Authorization ;
    acl:agent       <https://vaults.selfactual.ai/yourapp-service/profile/card#me> ;
    acl:accessTo    <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:default     <https://vaults.selfactual.ai/{username}/sub/> ;
    acl:mode        acl:Read, acl:Write .
```

Write grants may be scoped to specific containers (e.g., only `/sub/assessments/yourapp/`) rather than the entire sub pod. This depends on your integration agreement.

## Access Modes

| Mode | Allows |
|---|---|
| `acl:Read` | GET resources, list container contents |
| `acl:Write` | PUT (create/replace), DELETE resources |
| `acl:Append` | POST to containers (add without replacing) |
| `acl:Control` | Modify ACLs — **never granted to partners** |

Partners never receive `acl:Control`. Only the pod owner and the SelfActual service account can modify ACLs.

## What You Cannot Access

Regardless of any ACL configuration:

- **Master pods** — No partner app has access to master pods. These contain reflections and private data.
- **Other users' pods** — Unless specifically granted by that user's pod ACL.
- **ACL resources** — You can't read or modify `.acl` files.
- **System resources** — CSS internal endpoints (`.account/`, `.oidc/`, etc.) are not pod resources.

## ACL Inheritance

ACLs use a `acl:default` mechanism for inheritance. A rule on a container with `acl:default` applies to all resources within that container (and sub-containers) unless a more specific ACL exists on a child resource.

In practice, this means the sub pod root ACL typically covers everything inside it. You don't need to worry about per-resource ACLs unless the SelfActual team tells you otherwise.

## Checking Your Access

Before making assumptions, you can check whether you have access to a resource:

```javascript
import { getResourceAcl, hasResourceAcl } from "@inrupt/solid-client";

// This will throw 403 if you don't have access
try {
  const dataset = await getSolidDataset(resourceUrl, { fetch: session.fetch });
  console.log("Read access confirmed");
} catch (err) {
  if (err.statusCode === 403) {
    console.log("No read access to this resource");
  }
}
```

For a more systematic check, use the WAC-Allow header:

```bash
curl -I -H "Authorization: DPoP <token>" \
  https://vaults.selfactual.ai/sandbox-alice/sub/

# Look for:
# WAC-Allow: user="read write", public=""
```

## User Consent Flow (Future)

Currently, ACL grants for partner apps are configured by SelfActual during onboarding. In a future version, users will control partner access through a consent UI — granting or revoking your app's access to their sub pod.

Your app should be prepared for access to be revoked at any time. Handle `403` responses gracefully and guide the user to re-authorize if needed.

## Origin-Based vs Agent-Based Access

Solid supports two kinds of access grants:

- **`acl:agent`** — Grants access to a specific WebID (your service account). Used for server-to-server access.
- **`acl:origin`** — Grants access to any request originating from a specific web domain. Used for browser-based apps.

If your app is a browser-based SPA that makes requests directly from the client, you'll need origin-based access. If your app is a backend service, you'll use agent-based access. Discuss your architecture with the SelfActual team during onboarding.

---

Next: [Provenance →](provenance.md)
