# ADR-001: Schema Extension Process for Partner Applications

**Status:** Accepted
**Date:** March 2026
**Context:** Development partners are beginning to build applications against SelfActual pods.

## Decision

Partner applications that need to store new types of data in user pods follow a two-tier vocabulary approach:

1. **App-specific predicates** use the partner's own namespace (e.g., `https://vocab.yourapp.com/`). No review required.
2. **Shared predicates** intended for cross-application use are proposed as additions to the `sa:` vocabulary via GitHub Issue → review → PR.

The `sa:` vocabulary is versioned (semver) and published as `vocabulary/sa.ttl` in this repository. Additions are always backward-compatible (minor version bumps). Breaking changes require a major version bump and advance notice.

## Context

Multiple applications will read from and write to user pods. Without coordination, each app would invent its own terms for similar concepts, making data siloed even within the pod ecosystem — defeating the purpose of Solid.

At the same time, requiring central approval for every predicate would slow down development partners unnecessarily. Most app-specific data only needs to be understood by that app.

## Consequences

- Partners can move fast on their own data model without waiting for review.
- Shared concepts converge on common terms, enabling cross-app data interoperability.
- The `sa:` vocabulary grows organically based on real partner needs, not speculative design.
- The review process is lightweight (GitHub Issue, conversational review, PR) — appropriate for the current scale of 2–5 close partners.
- If the partner count grows beyond ~10, a more formal RFC process may be needed.

## Alternatives Considered

- **Fully centralized vocabulary:** All terms must be in `sa:`. Rejected — too slow for partners, creates bottleneck.
- **Fully decentralized:** No shared vocabulary, each app uses its own. Rejected — defeats interoperability goals.
- **Automatic promotion:** App terms that get used by multiple apps auto-promote to `sa:`. Rejected — premature; introduces naming collisions and versioning complexity.
