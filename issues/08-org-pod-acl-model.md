<!-- gh issue create --title "Design org pod ACL model" --label "design" --label "partner-integration" --body-file issues/08-org-pod-acl-model.md -->

## Summary

The org pod ACL model needs a decision before org pods go beyond sandbox use. The current sandbox implementation uses individual `acl:agent` grants per member, but this may not scale.

## Options

### A: Individual agent grants

```turtle
<#member-alice>
    a acl:Authorization ;
    acl:agent <https://vaults.selfactual.ai/alice/profile/card#me> ;
    acl:accessTo <https://vaults.selfactual.ai/org-acme/> ;
    acl:default <https://vaults.selfactual.ai/org-acme/> ;
    acl:mode acl:Read .
```

- **Pro:** Simple, explicit, easy to audit
- **Con:** ACL file grows linearly with membership; every member change requires ACL rewrite

### B: Agent groups (`acl:agentGroup`)

```turtle
<#members>
    a acl:Authorization ;
    acl:agentGroup <https://vaults.selfactual.ai/org-acme/members#group> ;
    acl:accessTo <https://vaults.selfactual.ai/org-acme/> ;
    acl:default <https://vaults.selfactual.ai/org-acme/> ;
    acl:mode acl:Read .
```

- **Pro:** Single ACL entry; membership managed in a separate resource
- **Con:** Need to verify CSS supports `acl:agentGroup`; adds a group resource to manage

### C: Hybrid

Individual grants for admin/write access, group for member read access.

## Decision Criteria

- Does CSS actually support `acl:agentGroup`? (Needs live testing)
- Expected org sizes — 5 people or 500?
- How often does membership change?
- Who manages membership — SelfActual service or org admin?

## Deliverable

An ADR at `docs/developer-guide/decisions/adr-003-org-pod-acl-model.md`

## Acceptance Criteria

- [ ] `acl:agentGroup` tested against live CSS (works / doesn't work)
- [ ] Decision documented as ADR
- [ ] Chosen model implemented in sandbox org pod
