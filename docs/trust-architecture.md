# SelfActual Trust Architecture

## The Custodial Reality

SelfActual runs the pod server. We hold the infrastructure, manage the accounts, and can technically access any pod's contents. This is the same custody model as email providers, password managers, banks, and brokerages. The user "owns" their data in the same way they "own" money in a bank account — the institution has custody and is bound by obligations to act in the owner's interest.

The goal is not to pretend we don't have custody. It's to build a system where the custodial relationship is trustworthy by design — where the architecture, business model, legal structure, and technical choices all reinforce the same commitment: **this data exists for the user's benefit, not ours.**

This is the data fiduciary model.

---

## What a Data Fiduciary Means

A financial fiduciary has three structural properties:

1. **Duty of care** — obligated to act in the client's best interest, not their own
2. **Duty of loyalty** — cannot profit from the client's assets at the client's expense
3. **Accountability** — subject to audit, transparency requirements, and consequences for breach

SelfActual adopts these same properties for data custody. The difference from a financial fiduciary: we don't announce it with a badge. Instead, every layer of the system — technical, legal, commercial — is designed so the fiduciary behavior is the natural outcome, not a policy someone has to remember to follow.

---

## How Each Layer Reinforces Trust

### 1. Architecture: The Data Can Leave

The most powerful trust signal isn't a promise — it's the absence of lock-in. If the user can take their data and go at any time, then SelfActual must continuously earn the right to hold it.

**What makes this real:**
- Data is stored as standard RDF (Turtle) using standard vocabularies (Schema.org, FOAF, Dublin Core) and the Solid protocol — not a proprietary format
- Pod contents are exportable. A user can download their entire pod as files and host them on any Solid-compatible server (CSS, NSS, or a future provider)
- The Solid specification is a W3C-backed open standard — SelfActual doesn't control it
- Pod URLs use the user's namespace (`/username/master/`, `/username/sub/`) — the data structure is theirs, not ours

**Analogy:** A brokerage must let you transfer your portfolio to another brokerage. The assets are standard (stocks, bonds), not proprietary instruments that only work at one firm. SelfActual's data is the same — standard formats, standard protocols, portable by design.

**What we build:**
- Export tool: one-click download of full pod contents as a ZIP of Turtle files
- Migration guide: documentation for how to stand up your own CSS instance and import your pod
- No degradation on export: exported data is complete and self-describing (includes framework context, provenance, links)

### 2. Business Model: No Conflict of Interest

The fiduciary obligation breaks down when the custodian profits from using the client's assets against their interest. For data, this means: if SelfActual's revenue comes from selling or monetizing user data, the fiduciary claim is hollow.

**What makes this real:**
- Revenue comes from the apps and services built on top of the vault (subscriptions, coaching, team tools) — not from data brokerage, advertising, or analytics on user data
- SelfActual never sells, licenses, or provides aggregate access to pod data to third parties
- Third-party apps access user data only through the sub pod, only with user-granted permissions, and only in real-time (no bulk export by apps, no data warehousing by consumers)
- There is no "free tier funded by data monetization" model

**Analogy:** A fee-only financial advisor charges the client directly. They don't earn commissions from the products they recommend. The fee structure eliminates the conflict. SelfActual's revenue model does the same for data.

### 3. Access Minimization: We Don't Look Unless We Must

Even with custody, the system should be designed so that accessing user data is unnecessary, logged, and exceptional.

**What makes this real:**
- **No analytics on pod contents.** SelfActual does not read, index, scan, or analyze the RDF data inside user pods for any business purpose. Server logs track HTTP requests (URLs, timestamps, status codes) for operational purposes only — not the content of resources.
- **No internal tools that browse pods.** There is no admin dashboard that lets SelfActual employees read a user's reflections or assessment scores. If such a tool is ever needed for debugging, it requires explicit user consent and is logged.
- **Principle of least privilege.** Production server access is limited to infrastructure operations (Docker, Nginx, TLS). The pod data directory (`/srv/css-data`) is not routinely accessed by any person or process other than CSS itself.
- **Separation of infrastructure and data.** SelfActual operates the server. The data belongs to the user. These are different roles, like a landlord and a tenant — the landlord maintains the building but doesn't enter the apartment without cause.

**What we build:**
- Access logging: any direct access to the pod data directory (outside of CSS serving HTTP requests) is logged and auditable
- Operational procedures that explicitly prohibit content inspection without user consent
- Infrastructure designed so that routine operations (backups, updates, scaling) never require reading pod contents

### 4. Encryption: Technical Barriers to Misuse

Custody doesn't mean the custodian should be able to casually read everything. Encryption at rest creates a technical barrier that makes access a deliberate act rather than a side effect of having server access.

**Phase 1 (POC):**
- TLS in transit (already live — Let's Encrypt)
- Filesystem-level encryption on the EBS volume (AWS encrypts gp3 volumes at rest by default)
- This protects against physical disk theft and AWS-level breach, but not against someone with SSH access to the running instance

**Phase 2 (Post-POC):**
- Application-level encryption of sensitive pod resources (reflections, coaching conversations, personal insights)
- Encryption keys derived from user credentials — SelfActual holds the encrypted data but the decryption key is derived from something only the user knows
- Trade-off: this breaks server-side search/indexing of encrypted resources. For a vault system where the user is the primary consumer of their own data, this is acceptable.

**Phase 3 (Future):**
- User-held encryption keys for the master pod (self-custody option for advanced users)
- SelfActual can still host the encrypted pod but cannot decrypt it
- This is the "cold storage" equivalent — maximum security, reduced convenience (no server-side processing of encrypted data)

### 5. Legal Structure: Obligations With Teeth

The architecture creates the conditions for trust. Legal agreements create the obligations.

**What this looks like:**
- **Terms of Service** explicitly state: SelfActual acts as a data custodian. User data is the property of the user. SelfActual will not access, sell, license, or use pod contents for any purpose other than providing the service.
- **Data Processing Agreement (DPA)** for enterprise/team deployments — standard in regulated industries, formalizes the custodial relationship
- **Breach notification commitment** — if pod data is ever compromised, users are notified within a defined timeframe with full transparency about what was exposed
- **Right to delete** — users can delete their pods and all associated data at any time, with confirmation that deletion is complete (not just soft-deleted)

**Future consideration:** As data fiduciary frameworks mature legally (the concept is gaining traction in privacy law — India's DPDP Act, proposed US legislation, EU discussions), SelfActual should be positioned to adopt formal fiduciary status if/when a legal framework exists.

### 6. Transparency: Trust Through Visibility

A fiduciary is subject to audit. SelfActual should be auditable by its users and by the public.

**What this looks like:**
- **Provenance log in every pod** — users can see exactly which apps wrote what data and when (already designed, see `pod-resources-sketch.md`)
- **Access log in every pod** — users can see which apps read their sub pod and when (to be designed)
- **Public transparency report** — periodic disclosure of: number of active pods, any data access requests (legal, governmental), any security incidents, any changes to data handling practices
- **Open-source server configuration** — the CSS configuration and custom modules used by SelfActual are open-source and inspectable. Users can verify that the server behaves as claimed.

### 7. The Path to Self-Custody

The strongest form of the fiduciary model is one where the user can graduate out of it entirely. Like how a brokerage client can move to self-directed investing, a SelfActual user should eventually be able to host their own pod.

**What makes this real:**
- Solid is an open protocol. Any Solid server can host a pod.
- SelfActual publishes its custom vocabulary (`sa:` prefix) so any server can understand the data
- Export + import tools make migration straightforward
- Documentation for self-hosting (community CSS instance, or other Solid servers)

**Why this is good for SelfActual:** Users who *can* leave but *choose* to stay are the strongest signal that the custodial relationship is working. Removing exit barriers forces the product to earn retention through value, not lock-in.

---

## How This Shows Up in the Product

The fiduciary model is implicit — users experience it through the product, not through marketing copy.

| What the user sees | What's happening underneath |
|---|---|
| "Your vault" — the language always frames data as theirs | Architecture: data stored in user-namespaced pods |
| Pod contents visible and browsable (Vault Viewer) | Transparency: user can inspect everything |
| "Which apps can see your data" — clear permission UI | Access control: WAC ACLs on the sub pod |
| "Export your data" — always available, no friction | Portability: standard RDF, no lock-in |
| Apps request access, user approves | Sub pod model: apps never touch master |
| "Working With Me" doc requires user review before sharing | Consent flow: master → user approval → sub |
| No ads, no "personalized recommendations" from SelfActual itself | Business model: no data monetization |
| Write history visible in the pod | Provenance: auditable by the user |

The user never reads a "Data Fiduciary Policy" document. They just use a product that consistently behaves as if it's on their side — because it's built to be.

---

## What This Means for the POC

For the proof of concept, we don't need all of this. But the foundational pieces should be present:

1. **Portability** — data is already in standard RDF/Turtle. ✅ (validated)
2. **Master/sub separation** — private data stays private, sharing is explicit. ✅ (validated)
3. **Provenance** — designed, needs implementation in the write flow
4. **Vault Viewer** — lets users see their own data. Planned.
5. **Export** — a script that downloads the full pod as files. Easy to build.
6. **Language** — all UI/copy refers to "your vault", "your data", never "our database"

What we defer:
- Application-level encryption (Phase 2)
- Legal framework / ToS with fiduciary language
- Transparency reports
- Self-hosting documentation
- Access logging in pods

---

## Summary

SelfActual is a data custodian. We hold user data, and we have the technical ability to access it. The trust architecture ensures that this custody is trustworthy through multiple reinforcing layers:

```
┌─────────────────────────────────────────────────┐
│              USER'S EXPERIENCE                   │
│     "This product respects my data."            │
│     (They never think about fiduciary duty.)    │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ ARCH.   │   │ LEGAL   │   │ BUSINESS│
   │         │   │         │   │  MODEL  │
   │Standard │   │ToS as   │   │Revenue  │
   │formats  │   │fiduciary│   │from apps│
   │Open     │   │obligation│  │not data │
   │protocol │   │Right to │   │No ads   │
   │Portable │   │delete   │   │No data  │
   │Export   │   │Breach   │   │sales    │
   │Encrypted│   │notice   │   │         │
   └────┬────┘   └────┬────┘   └────┬────┘
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │TECHNICAL│   │TRANSPAR-│   │ PATH TO │
   │CONTROLS │   │  ENCY   │   │SELF-    │
   │         │   │         │   │CUSTODY  │
   │Access   │   │Provenance│  │User can │
   │minimized│   │logs     │   │export & │
   │No admin │   │Access   │   │self-host│
   │browsing │   │logs     │   │at any   │
   │Least    │   │Public   │   │time     │
   │privilege│   │reports  │   │         │
   └─────────┘   └─────────┘   └─────────┘
```

No single layer is sufficient. Together, they create a system where the fiduciary behavior is the path of least resistance — the natural outcome of how the system is built, funded, and operated.
