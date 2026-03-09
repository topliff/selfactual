# ADR-002: Sub Pod as the Partner Integration Surface

**Status:** Accepted
**Date:** March 2026
**Context:** Defining which pod(s) partner applications interact with.

## Decision

Partner applications read from and write to the **sub pod** only. The master pod is never accessible to partner applications. SelfActual's internal services handle synchronization between sub and master pods.

## Context

The dual-pod architecture separates private data (master) from shareable data (sub). The key question is: where do partner apps plug in?

Options considered:

1. **Partners access master pod** — simplest, but exposes private data (reflections, full profile) and creates trust/permission complexity.
2. **Partners access sub pod only** — partners see a curated surface. Private data stays private. SelfActual controls what's exposed.
3. **Partners access a third "integration pod"** — maximum isolation but adds architectural complexity and another sync surface.

## Consequences

- Reflections and private data are never exposed to partner applications, even accidentally.
- The sub pod acts as a well-defined API surface — changes to the master pod structure don't break partner integrations.
- Partner writes go to the sub pod. SelfActual can choose whether/how to sync partner-contributed data into the master pod.
- Users have a single mental model: "the sub pod is what I share."
- Trade-off: data written by partners to the sub pod may need to be synced to the master pod for the user's complete record. This sync service is not yet built.

## Future Considerations

- A consent UI will let users control which partners have access to their sub pod.
- Partner access may be scoped to specific containers (e.g., a partner can only read/write `/sub/assessments/theirapp/`), not the entire sub pod.
- If org-level partner access is needed (e.g., an analytics tool reading all team members' sub pods), the org pod ACL model needs to support delegation.
