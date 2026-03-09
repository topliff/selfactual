# Extending the Schema

If your application introduces new data types or needs predicates not covered by the existing `sa:` vocabulary, this document describes how to propose and integrate schema extensions.

## Principles

1. **Reuse before inventing.** Check the [vocabulary reference](sa-vocab.md) and standard vocabularies (Schema.org, FOAF, Dublin Core) before creating new terms.
2. **Your namespace for your data.** App-specific predicates that only your application uses should live in your own namespace (e.g., `https://vocab.yourapp.com/`), not in `sa:`.
3. **`sa:` for shared concepts.** If your data introduces a concept that other apps would also use (e.g., a new assessment type, a coaching interaction), propose it as an addition to the `sa:` vocabulary.
4. **Backward compatible.** New terms are additive. Existing terms are never removed or redefined in a breaking way.

## When to Extend `sa:`

Propose a `sa:` addition when:

- You're creating a **new assessment type** that other apps might read
- You're defining a **relationship between resources** that spans applications
- The concept is **domain-general** within personal development (not specific to your product's internal model)

Use your own namespace when:

- The predicates are **specific to your application's features**
- The data only makes sense in the context of your app
- You're still iterating on the schema and it may change

## Proposal Process

### Step 1: Open an Issue

In the `selfactual-developer-guide` repo, open a GitHub Issue with the label `schema-proposal`. Include:

- **Title:** `[Schema Proposal] sa:YourProposedTerm`
- **Motivation:** What data are you storing and why does it need a new term?
- **Proposed definition:** Class or property, domain, range, description
- **Example Turtle:** A realistic example showing the term in use
- **Alternatives considered:** Why existing terms don't work

### Step 2: Review

The SelfActual team will review for:

- Overlap with existing vocabulary
- Consistency with naming conventions
- Potential impact on existing pod consumers
- Whether this should be `sa:` or remain in your namespace

For close development partners, this is a lightweight conversation — expect a turnaround within a few days.

### Step 3: Merge

Accepted proposals are added to `vocabulary/sa.ttl` and the vocabulary reference via PR. The version number in the ontology is bumped.

### Step 4: Communicate

All partners are notified of vocabulary additions via the partner channel. Additions are backward-compatible — existing consumers don't break.

## Naming Conventions

| Convention | Example |
|---|---|
| Classes: PascalCase | `sa:StarCard`, `sa:FlowProfile`, `sa:GrowthPlan` |
| Properties: camelCase | `sa:profileShape`, `sa:dominantQuadrant`, `sa:hasReflections` |
| Predicate names should be self-descriptive | `sa:aboutAssessment` not `sa:ref` |
| Boolean properties: use positive form | `sa:completed` not `sa:isNotIncomplete` |

## Container Placement

When your app creates new resource types, follow this container convention:

| Data Type | Container | Example |
|---|---|---|
| Assessment results | `/sub/assessments/{yourapp}-{type}` | `/sub/assessments/coachbot-session` |
| App-specific data | `/sub/{yourapp}/` | `/sub/coachbot/preferences` |
| Framework context | `/sub/context/{yourapp}-framework` | `/sub/context/coachbot-framework` |

Never write to containers owned by other applications. If you need to reference another app's data, link to it with a URI — don't copy it into your container.

## Example Proposal

Here's what a schema proposal might look like:

**Title:** `[Schema Proposal] sa:CoachingSession`

**Motivation:** Our coaching app records structured sessions between a coach and user. Other apps (analytics, progress tracking) would benefit from reading session metadata.

**Proposed definitions:**

```turtle
sa:CoachingSession
    a owl:Class ;
    rdfs:subClassOf sa:Assessment ;
    rdfs:label      "Coaching Session" ;
    rdfs:comment    "A structured coaching interaction with topics, duration, and outcomes." .

sa:sessionDuration
    a owl:DatatypeProperty ;
    rdfs:domain     sa:CoachingSession ;
    rdfs:range      xsd:integer ;
    rdfs:label      "session duration" ;
    rdfs:comment    "Duration of the session in minutes." .

sa:sessionTopic
    a owl:DatatypeProperty ;
    rdfs:domain     sa:CoachingSession ;
    rdfs:range      xsd:string ;
    rdfs:label      "session topic" ;
    rdfs:comment    "Primary topic discussed in the session." .
```

**Example Turtle:**

```turtle
<>
    a sa:Assessment, sa:CoachingSession ;
    dcterms:created     "2026-03-09T14:00:00Z"^^xsd:dateTime ;
    sa:sourceApp        "CoachBot" ;
    sa:sourceVersion    "1.0.0" ;
    sa:sessionDuration  45 ;
    sa:sessionTopic     "Career transition planning" ;
    sa:relatedAssessment <https://vaults.selfactual.ai/jacobkim/sub/assessments/starcard> .
```

## Deprecation

If a `sa:` term needs to be retired, it will be marked with `owl:deprecated true` in the ontology but never removed. Consumers should check for this annotation and migrate to the replacement term.

```turtle
sa:oldTerm
    a owl:DatatypeProperty ;
    owl:deprecated  true ;
    rdfs:comment    "Deprecated. Use sa:newTerm instead." ;
    rdfs:seeAlso    sa:newTerm .
```
