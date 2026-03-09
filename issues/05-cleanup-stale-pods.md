<!-- gh issue create --title "Clean up stale test pods on CSS instance" --label "infrastructure" --label "cleanup" --body-file issues/05-cleanup-stale-pods.md -->

## Summary

There are ~14 stale test pods on the CSS instance at `/srv/css-data/` from smoke testing. Older ones have incorrect service account WebIDs (pointing to `test_pod` instead of `service`). These should be removed before partner demos and before running the sandbox provisioning script.

## Steps

1. SSH in:
   ```bash
   ssh -i ~/.ssh/selfactual.pem ubuntu@52.32.95.140
   ```

2. Back up first:
   ```bash
   sudo tar czf /tmp/css-data-backup-$(date +%Y%m%d).tar.gz /srv/css-data/
   ```

3. List all pods:
   ```bash
   ls -la /srv/css-data/
   ```

4. Identify what to keep:
   - `service/` — the service account pod (KEEP)
   - Any pods that are actively in use (KEEP)
   - Everything else from smoke testing (DELETE)

5. For each stale pod, delete the CSS account via the Account API and remove the filesystem data. CSS stores account data separately from pod data — deleting the filesystem directory removes the pod data but may leave orphaned account records.

6. Verify `service/` pod is intact:
   ```bash
   cat /srv/css-data/service/profile/card$.ttl
   ```

## Caution

- **Do NOT delete** the `service/` pod
- **Do NOT delete** any pods created by the sandbox provisioning script (if it's been run already)
- Back up before deleting anything

## Acceptance Criteria

- [ ] Only legitimate pods remain in `/srv/css-data/`
- [ ] Service account pod is intact with correct WebID
- [ ] CSS is still running and healthy after cleanup
