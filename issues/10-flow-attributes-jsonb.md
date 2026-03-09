<!-- gh issue create --title "Investigate flow attributes JSONB structure in AST database" --label "research" --label "ast-integration" --body-file issues/10-flow-attributes-jsonb.md -->

## Summary

The `flowAttributes.attributes` column in the AST Postgres database is JSONB with an unknown internal structure. The current pod resource design and sandbox data use plausible but speculative values. Need to inspect actual data to finalize the RDF mapping.

## Context

The vocabulary (`docs/developer-guide/vocabulary/sa-vocab.md`) defines `sa:FlowProfile` with `sa:flowAttribute` blank nodes containing `sa:name`, `sa:score`, and `sa:category`. The sandbox uses sample values like:

```turtle
sa:flowAttribute [
    sa:name     "Deep Focus" ;
    sa:score    8 ;
    sa:category "cognitive"
] ;
```

This may not match what the actual JSONB contains.

## Steps

1. Connect to the AST Postgres database
2. Run: `SELECT attributes FROM flow_attributes LIMIT 5;`
3. Document the actual JSON structure
4. Compare against current `sa:FlowProfile` RDF design
5. Update vocabulary (`sa.ttl`, `sa-vocab.md`) if structure differs
6. Update sandbox data files (`services/sandbox/data/`) to match reality

## Acceptance Criteria

- [ ] Actual JSONB structure documented
- [ ] `sa:FlowProfile` RDF mapping verified or updated to match real data
- [ ] Sandbox flow attributes data is realistic
