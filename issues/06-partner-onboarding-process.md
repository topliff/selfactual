<!-- gh issue create --title "Define partner onboarding process" --label "documentation" --label "partner-integration" --body-file issues/06-partner-onboarding-process.md -->

## Summary

The developer guide explains how to use the sandbox but doesn't cover the human workflow for how a new partner actually gets access. Define a lightweight onboarding checklist.

## Questions to Answer

- How does a partner request access? (Email? Slack channel? Direct conversation?)
- Who provisions their service account?
- How are credentials delivered securely? (Not email. 1Password shared vault? Generated during a live call? Encrypted message?)
- What communication channel for ongoing support? (Shared Slack channel? GitHub Discussions?)
- Is there an agreement or terms partners need to accept?
- What is expected turnaround time?

## Deliverable

A markdown document at `docs/developer-guide/getting-started/partner-onboarding.md` that covers:

1. Prerequisites — what the partner needs before starting
2. Request process — how to ask for access
3. What they receive — credentials, sandbox access, docs links
4. Support channels — where to ask questions
5. Expectations — what is stable vs experimental, response times

Link it from the main developer guide `README.md`.

## Acceptance Criteria

- [ ] `docs/developer-guide/getting-started/partner-onboarding.md` exists
- [ ] Linked from developer guide README
- [ ] Process could be followed by someone with no prior SelfActual context
