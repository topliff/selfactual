# SelfActual Developer Guide

**For development partners building applications on the SelfActual vault system.**

SelfActual is a personal data infrastructure built on the [Solid protocol](https://solidproject.org/). Users own their data in Solid Pods — personal data stores hosted at `vaults.selfactual.ai` — and selectively share subsets with authorized applications.

As a development partner, your application reads from (and potentially writes to) these pods using standard Solid/HTTP protocols. This guide covers everything you need to get started.

## Quick Start

1. **[Getting Credentials](getting-started/authentication.md)** — Obtain a service account and tokens
2. **[Sandbox Setup](getting-started/sandbox-setup.md)** — Get test pods with sample data
3. **[Your First Read](getting-started/first-read.md)** — Read a Star Card assessment from a sub pod

## Reference

- **[Reading Pods](api-reference/reading-pods.md)** — HTTP methods, content negotiation, container traversal
- **[Writing Pods](api-reference/writing-pods.md)** — Creating and updating resources, container rules
- **[Access Control](api-reference/access-control.md)** — ACL model, what your app can and can't do
- **[Provenance](api-reference/provenance.md)** — Audit logging requirements for writes

## Vocabulary

- **[SelfActual Vocabulary Reference](vocabulary/sa-vocab.md)** — Full reference for the `sa:` namespace
- **[Extending the Schema](vocabulary/extending-schema.md)** — How to propose new resource types and predicates
- **[sa.ttl](vocabulary/sa.ttl)** — Machine-readable OWL ontology

## Code Examples

- **[Node.js: Read a Star Card](examples/node-read-starcard/)** — Working example using `@inrupt/solid-client`
- **[Node.js: Write an Assessment](examples/node-write-assessment/)** — Authenticated write with provenance
- **[curl Examples](examples/curl-examples.md)** — Raw HTTP for protocol-level understanding

## Architecture Decisions

- **[ADR-001: Schema Extension Process](decisions/adr-001-schema-extension.md)** — How partners propose and integrate new resource types
- **[ADR-002: Sub Pod as Integration Surface](decisions/adr-002-sub-pod-surface.md)** — Why partners read from sub pods, not master pods

## Key Concepts

### Three-Pod Architecture

Each user has two pods; organizations have a third:

| Pod | Purpose | Your App's Access |
|-----|---------|-------------------|
| **Master Pod** | Complete private data store | No access (user only) |
| **Sub Pod** | Curated shareable subset | Read (with authorization) |
| **Org Pod** | Organization-level context (teams, values) | Read (for org members) |

Your application interacts with the **sub pod** — never the master pod. The sub pod contains assessments, profile summaries, and framework context. Reflections and private data stay in the master pod.

### Data Format

All data is stored as [RDF](https://www.w3.org/RDF/) in [Turtle](https://www.w3.org/TR/turtle/) syntax. The SelfActual vocabulary (`sa:` prefix, `https://vocab.selfactual.ai/`) extends standard vocabularies (Schema.org, FOAF, Dublin Core).

### Authentication

SelfActual uses [Solid-OIDC](https://solidproject.org/TR/oidc) for authentication. Your app authenticates as a service account with a WebID, obtains DPoP-bound tokens, and makes HTTP requests to pod resources.

## Environment

| Resource | URL |
|----------|-----|
| Vault Server | `https://vaults.selfactual.ai/` |
| Vocabulary (planned) | `https://vocab.selfactual.ai/` |
| Sandbox Pods | See [Sandbox Setup](getting-started/sandbox-setup.md) |

## Status & Stability

This is a pre-release partner integration. The following are **stable** (will not change without notice):

- Sub pod container layout (`/sub/assessments/`, `/sub/context/`, `/sub/profile-summary`)
- Core vocabulary terms (`sa:StarCard`, `sa:Assessment`, `sa:FlowProfile`, quadrant score predicates)
- ACL model for sub pod read access
- Authentication flow

The following are **experimental** (may change):

- Org pod structure and ACLs
- Write API conventions for partner apps
- Flow attributes internal structure
- Provenance log format

See [Extending the Schema](vocabulary/extending-schema.md) for how changes are proposed and communicated.

## Questions & Support

Contact: [TBD — partner Slack channel / email]

---

*Last updated: March 2026*
