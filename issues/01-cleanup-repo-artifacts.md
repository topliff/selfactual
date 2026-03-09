<!-- gh issue create --title "Clean up repo artifacts from developer guide extraction" --label "cleanup" --body-file issues/01-cleanup-repo-artifacts.md -->

## Summary

The developer guide tarball extraction left behind artifacts that need cleanup before pushing to remote.

## Items to Clean Up

1. **Brace-expansion artifact directory** in `docs/developer-guide/`:
   ```
   docs/developer-guide/{getting-started,api-reference,vocabulary,examples/
   ```
   This is an empty directory tree created by a malformed tarball entry. Delete it recursively.

2. **Tarball source directory** at repo root:
   ```
   files_poddevguide/selfactual-developer-guide.tar.gz
   ```
   The guide has been extracted — the tarball is no longer needed. Delete the entire `files_poddevguide/` directory.

3. **Verify** no other stray files from extraction.

## Commands

```bash
rm -rf "docs/developer-guide/{getting-started,api-reference,vocabulary,examples"
rm -rf files_poddevguide/
git add -A
git commit -m "Clean up tarball artifacts from developer guide extraction"
```

## Acceptance Criteria

- [ ] No brace-expansion directory exists in `docs/developer-guide/`
- [ ] `files_poddevguide/` is gone
- [ ] `docs/developer-guide/` structure is clean (README.md, getting-started/, api-reference/, vocabulary/, examples/, decisions/, sandbox/)
