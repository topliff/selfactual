# Provenance

Every write to a SelfActual pod must be traceable. Provenance records establish what was written, when, by which application, and why. This is central to the fiduciary model — users should always be able to understand the history of their data.

## Two Layers of Provenance

### 1. Inline Provenance (Required)

Every resource your app writes must include provenance predicates directly in the resource:

```turtle
<>
    a sa:Assessment ;
    dcterms:created     "2026-03-09T10:00:00Z"^^xsd:dateTime ;
    dcterms:modified    "2026-03-09T10:00:00Z"^^xsd:dateTime ;
    sa:sourceApp        "YourAppName" ;
    sa:sourceVersion    "1.0.0" ;
    # ... your data
```

This is the minimum. Any consumer of the resource can see who created it and when.

### 2. Write Log (Managed by SelfActual)

SelfActual maintains a provenance log in the master pod at `/master/provenance/ast-write-log` using the W3C PROV ontology. This is managed by SelfActual's internal services — partner apps don't write to it directly.

When your app writes to a sub pod, SelfActual's sync service records the event in the master pod's provenance log, creating a complete audit trail.

## Required Provenance Predicates

| Predicate | Type | When | Description |
|---|---|---|---|
| `dcterms:created` | `xsd:dateTime` | On creation | When this resource was first created |
| `dcterms:modified` | `xsd:dateTime` | On update | When this resource was last modified |
| `sa:sourceApp` | String | Always | Your application's name |
| `sa:sourceVersion` | String | Always | Your application's version string |

## Recommended Additional Predicates

| Predicate | Type | Description |
|---|---|---|
| `sa:writeType` | String | Category of write (e.g., `"assessment-sync"`, `"user-action"`) |
| `sa:triggeredBy` | String | What caused this write (e.g., `"assessment-completed"`, `"manual-entry"`) |

## Versioning Data

If your app updates a resource over time, the resource should always reflect its current state with updated `dcterms:modified`. There is no built-in version history in Solid — each PUT replaces the resource.

If you need to preserve historical versions, use a versioning pattern:

```
/sub/assessments/yourapp/result-v1
/sub/assessments/yourapp/result-v2
/sub/assessments/yourapp/result-latest  → always points to current
```

Or include version metadata within the resource:

```turtle
<>
    a sa:Assessment ;
    sa:version          3 ;
    sa:previousVersion  <https://vaults.selfactual.ai/.../result-v2> ;
    dcterms:created     "2026-01-15T10:00:00Z"^^xsd:dateTime ;
    dcterms:modified    "2026-03-09T10:00:00Z"^^xsd:dateTime ;
    # ...
```

## Retracting Data

Partner apps cannot delete resources. To retract or supersede data, write a replacement that marks the previous version as retracted:

```turtle
<>
    a sa:Assessment ;
    sa:status           "retracted" ;
    sa:retractedReason  "Scoring algorithm updated" ;
    sa:supersededBy     <https://vaults.selfactual.ai/.../new-result> ;
    dcterms:modified    "2026-03-09T10:00:00Z"^^xsd:dateTime ;
    sa:sourceApp        "YourAppName" ;
    sa:sourceVersion    "1.1.0" ;
```

---

Next: [SelfActual Vocabulary Reference →](../vocabulary/sa-vocab.md)
