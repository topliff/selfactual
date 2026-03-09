# GitHub Issues — Ready to Create

This directory contains 11 GitHub Issue definitions as markdown files.

Each file has an HTML comment on line 1 with the exact `gh issue create` command to run. The rest of the file is the issue body.

## For Claude Code: Create All Issues

Run these commands from the repo root (`~/Desktop/SelfActualSystem`):

### Step 1: Create labels

```bash
gh label create "documentation" --color "0075ca" --description "Documentation improvements" 2>/dev/null || true
gh label create "infrastructure" --color "d876e3" --description "Infrastructure and deployment" 2>/dev/null || true
gh label create "partner-integration" --color "0e8a16" --description "Partner developer experience" 2>/dev/null || true
gh label create "cleanup" --color "fef2c0" --description "Technical debt and cleanup" 2>/dev/null || true
gh label create "design" --color "f9d0c4" --description "Design decisions needed" 2>/dev/null || true
gh label create "feature" --color "a2eeef" --description "New feature" 2>/dev/null || true
gh label create "ast-integration" --color "c5def5" --description "AllStarTeams application integration" 2>/dev/null || true
gh label create "research" --color "d4c5f9" --description "Investigation or research needed" 2>/dev/null || true
gh label create "manual" --color "fbca04" --description "Requires manual action outside of code" 2>/dev/null || true
```

### Step 2: Create each issue

For each `.md` file (excluding this README), extract the `gh issue create` command from the HTML comment on line 1 and run it. The `--body-file` flag should point to the file itself — the HTML comment line will be included in the body but renders as invisible in GitHub.

```bash
gh issue create --title "Clean up repo artifacts from developer guide extraction" --label "cleanup" --body-file issues/01-cleanup-repo-artifacts.md
gh issue create --title "Publish sa: vocabulary at vocab.selfactual.ai" --label "infrastructure" --label "partner-integration" --body-file issues/02-publish-vocabulary.md
gh issue create --title "Add DNS A record for vocab.selfactual.ai" --label "infrastructure" --label "manual" --body-file issues/03-dns-a-record-vocab.md
gh issue create --title "Run sandbox provisioning against live CSS" --label "infrastructure" --label "partner-integration" --body-file issues/04-run-sandbox-provisioning.md
gh issue create --title "Clean up stale test pods on CSS instance" --label "infrastructure" --label "cleanup" --body-file issues/05-cleanup-stale-pods.md
gh issue create --title "Define partner onboarding process" --label "documentation" --label "partner-integration" --body-file issues/06-partner-onboarding-process.md
gh issue create --title "Repeatable process for adding partner WebIDs to sandbox ACLs" --label "infrastructure" --label "partner-integration" --body-file issues/07-add-partner-webids.md
gh issue create --title "Design org pod ACL model" --label "design" --label "partner-integration" --body-file issues/08-org-pod-acl-model.md
gh issue create --title "Build pod write service in AST" --label "feature" --label "ast-integration" --body-file issues/09-pod-write-service.md
gh issue create --title "Investigate flow attributes JSONB structure in AST database" --label "research" --label "ast-integration" --body-file issues/10-flow-attributes-jsonb.md
gh issue create --title "Update repo README and TODO to reflect current state" --label "documentation" --label "cleanup" --body-file issues/11-update-readme-todo.md
```

### Step 3: Verify

```bash
gh issue list --limit 20 --state open
```

## Priority Order

Suggested execution sequence:

1. **#1** — Clean up repo artifacts (quick, unblocks clean commits)
2. **#5** — Clean up stale test pods (before sandbox provisioning)
3. **#3** — DNS A record for vocab (manual, Brad does this)
4. **#4** — Run sandbox provisioning
5. **#2** — Publish vocabulary (after DNS propagates)
6. **#11** — Update README/TODO
7. **#6** — Partner onboarding process
8. **#7, #8, #9, #10** — Parallel tracks, less urgent
