<!-- gh issue create --title "Build pod write service in AST" --label "feature" --label "ast-integration" --body-file issues/09-pod-write-service.md -->

## Summary

AllStarTeams needs a module that writes assessment and reflection data to SelfActual pods when users complete activities. This is the core integration that makes pods contain real data.

## What It Does

When a user completes an assessment or submits a reflection, AST:

1. Writes to Postgres as today (no change)
2. Serializes data to Turtle RDF, adding context links that don't exist in Postgres (assessment↔reflection relationships, dimension labels, provenance)
3. Writes to the master pod via authenticated HTTP PUT
4. If sub-pod-eligible (assessments, profile summary), writes to sub pod with reflection links stripped
5. Appends to provenance log

## Architecture

A module within AST's Node.js server (not a standalone service). It should:

- Export functions: `syncStarCardToPod(userId)`, `syncReflectionToPod(userId, reflectionId)`, etc.
- Be callable from existing route handlers after Postgres writes
- Look up pod URLs from `vault_accounts` table (Drizzle ORM)
- Authenticate as service account (`service/profile/card#me`)
- Handle failures gracefully — pod write failure must not block the user-facing operation

## Dependencies

- User pods must be provisioned (via Auth0 signup → provisioning service)
- `vault_accounts` table with Auth0 → pod URL mapping
- Service account credentials in AST environment
- `@inrupt/solid-client` + `@inrupt/solid-client-authn-node`

## Repo

Primary work happens in `equalsAndy/HI_Replit`. Create a corresponding issue there when ready to start.

## Acceptance Criteria

- [ ] Star Card data appears in user pods after assessment completion
- [ ] Reflection data appears in master pod only (not sub pod)
- [ ] Provenance log updated on each write
- [ ] Pod write failures logged but don't block user operations
- [ ] Data readable by partner example code from developer guide
