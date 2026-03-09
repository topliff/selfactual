<!-- gh issue create --title "Update repo README and TODO to reflect current state" --label "documentation" --label "cleanup" --body-file issues/11-update-readme-todo.md -->

## Summary

The repo `README.md` still reflects the initial Terraform-only state. It doesn't mention the provisioning service, developer guide, sandbox, docs, or scripts. `TODO.md` has completed items mixed with open items and doesn't reference GitHub issues.

## README Updates Needed

The repo layout section should reflect the actual structure:

```
infra/                     # Terraform, nginx configs
  nginx/
    pods.conf              # Nginx config for vaults.selfactual.ai
    vocab.conf             # Nginx config for vocab.selfactual.ai (when created)
services/
  provisioning/            # Pod provisioning service (Node.js, deployed via PM2)
  sandbox/                 # Sandbox environment provisioning script
scripts/                   # Utility scripts (bootstrap, validation)
docs/
  developer-guide/         # Partner integration documentation
  project-context.md       # System architecture and state
  pod-resources-sketch.md  # RDF resource design
  trust-architecture.md    # Data fiduciary model
  ops.md                   # Operations cheat sheet
  app-ecosystem.md         # Application ecosystem design
```

Also add:
- A "Partner Integration" section pointing to `docs/developer-guide/README.md`
- A "Services" section describing provisioning and sandbox
- Updated architecture diagram showing provisioning service on port 3001

## TODO.md

Either:
- Replace with a link to GitHub Issues (`gh issue list`), or
- Update to mark completed items and reference issue numbers for open items

## Acceptance Criteria

- [ ] README accurately reflects current repo structure
- [ ] README mentions provisioning service, developer guide, and sandbox
- [ ] TODO.md updated or replaced with issue references
