# SelfActual Pod Resources — Design Sketch

**Validation status:** Core elements of this design were validated against the live CSS instance on 2026-02-27. Container structure, Star Card resources, reflections with assessment links, and master/sub separation all confirmed working. See `progress-log.md` for details.

## Overview

This document sketches how AllStarTeams (AST) data maps into Solid Pod resources for the SelfActual vault system. It covers container layout, example RDF (in Turtle), and the master/sub pod separation.

**Conventions used:**
- RDF examples are in [Turtle](https://www.w3.org/TR/turtle/) syntax
- `sa:` = SelfActual custom vocabulary (to be published at `https://vocab.selfactual.ai/`)
- Standard vocabularies: `schema:` (Schema.org), `foaf:` (Friend of a Friend), `dcterms:` (Dublin Core), `xsd:` (XML Schema Datatypes)

---

## Container Layout

Each user gets two pods. Below is the directory/container structure within each.

### Master Pod
```
https://vaults.selfactual.ai/{username}/master/
├── profile                          # User identity & basic info
├── assessments/                     # All assessment results
│   ├── starcard                     # Star Card quadrant scores
│   └── flow-attributes              # Flow assessment data
├── reflections/                     # All reflections (PRIVATE)
│   ├── strength-reflections/        # Reflection set: strengths
│   │   ├── thinking                 # Individual reflection
│   │   ├── acting
│   │   ├── feeling
│   │   └── planning
│   └── final-insight                # Final synthesis reflection
├── context/                         # Framework & schema context
│   └── ast-framework                # AST methodology reference
└── provenance/                      # Audit trail
    └── ast-write-log                # When AST wrote what
```

### Sub Pod (Sharing Pod)
```
https://vaults.selfactual.ai/{username}/sub/
├── profile-summary                  # Shareable profile subset
├── assessments/                     # Assessment results (SHAREABLE)
│   ├── starcard                     # Same data as master, copied
│   └── flow-attributes              # Same data as master, copied
└── context/                         # Framework context for consumers
    └── ast-framework                # So consuming apps understand the data
```

**Key distinction:** Reflections exist *only* in the master pod. Assessment results exist in *both*. The sub pod is what third-party apps see.

---

## Vocabulary Prefix Declarations

All Turtle examples below assume these prefixes:

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix schema:  <http://schema.org/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix ldp:     <http://www.w3.org/ns/ldp#> .
```

---

## Resource Examples

### 1. Profile (Master Pod)

**Path:** `/master/profile`

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix schema:  <http://schema.org/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .

<>
    a foaf:Person, sa:VaultOwner ;
    foaf:name           "Jacob Kim" ;
    schema:jobTitle     "Product Manager" ;
    schema:worksFor     "Acme Corp" ;
    schema:email        "jacob.kim@example.com" ;
    sa:vaultCreated     "2026-02-15T10:30:00Z"^^xsd:dateTime ;
    sa:masterPod        <https://vaults.selfactual.ai/jacobkim/master/> ;
    sa:subPod           <https://vaults.selfactual.ai/jacobkim/sub/> .
```

### 2. Profile Summary (Sub Pod)

**Path:** `/sub/profile-summary`

A reduced version — no email, no internal IDs. Just what a third-party app needs.

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix schema:  <http://schema.org/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .

<>
    a foaf:Person, sa:SharedProfile ;
    foaf:name           "Jacob Kim" ;
    schema:jobTitle     "Product Manager" ;
    schema:worksFor     "Acme Corp" ;
    sa:hasAssessment    <https://vaults.selfactual.ai/jacobkim/sub/assessments/starcard> ;
    sa:hasAssessment    <https://vaults.selfactual.ai/jacobkim/sub/assessments/flow-attributes> .
```

---

### 3. Star Card Assessment (Lives in Both Pods)

**Path:** `/master/assessments/starcard` and `/sub/assessments/starcard`

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment, sa:StarCard ;
    dcterms:created     "2026-02-15T11:00:00Z"^^xsd:dateTime ;
    dcterms:modified    "2026-02-15T11:00:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;
    sa:sourceVersion    "2.1.7" ;

    # The four quadrant scores
    sa:thinking         78 ;
    sa:acting           65 ;
    sa:feeling          82 ;
    sa:planning         71 ;

    # Derived attributes
    sa:dominantQuadrant "feeling" ;
    sa:profileShape     "Connector" ;

    # Link to reflections (MASTER ONLY — this triple is omitted in sub pod copy)
    sa:hasReflections   <https://vaults.selfactual.ai/jacobkim/master/reflections/strength-reflections/> .
```

**Note on the master vs sub copy:** The sub pod version is identical except it omits the `sa:hasReflections` link (since the sub pod doesn't contain reflections and shouldn't point to the master pod's private resources).

---

### 4. Flow Attributes Assessment

**Path:** `/master/assessments/flow-attributes` and `/sub/assessments/flow-attributes`

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment, sa:FlowProfile ;
    dcterms:created     "2026-02-15T11:30:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;

    # Flow attributes (structure depends on what AST stores in JSONB)
    sa:flowAttribute [
        sa:name         "Deep Focus" ;
        sa:score        8 ;
        sa:category     "cognitive"
    ] ;
    sa:flowAttribute [
        sa:name         "Collaborative Energy" ;
        sa:score        7 ;
        sa:category     "social"
    ] ;
    sa:flowAttribute [
        sa:name         "Creative Exploration" ;
        sa:score        9 ;
        sa:category     "generative"
    ] ;

    # Link to Star Card (explicit cross-assessment relationship)
    sa:relatedAssessment <https://vaults.selfactual.ai/jacobkim/master/assessments/starcard> .
```

---

### 5. Reflection (Master Pod Only)

**Path:** `/master/reflections/strength-reflections/thinking`

This is where AST adds the context that doesn't exist in the Postgres schema.

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Reflection ;
    dcterms:created         "2026-02-15T12:00:00Z"^^xsd:dateTime ;
    dcterms:modified        "2026-02-15T12:00:00Z"^^xsd:dateTime ;
    sa:framework            <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp            "AllStarTeams" ;

    # What this reflection is about — THE CONTEXT LINK
    sa:reflectionSet        "strength-reflections" ;
    sa:reflectionDimension  "thinking" ;
    sa:aboutAssessment      <https://vaults.selfactual.ai/jacobkim/master/assessments/starcard> ;
    sa:aboutScore           78 ;
    sa:dimensionLabel       "Thinking" ;
    sa:dimensionDescription "Analytical and strategic reasoning — how you process information, solve problems, and make decisions." ;

    # The actual reflection content
    sa:prompt               "Reflect on how your Thinking strength shows up in your daily work." ;
    sa:response             "I notice my analytical side comes out most in planning sessions. I tend to map dependencies before anyone else sees them, which helps the team avoid surprises. Sometimes I over-analyze and slow things down though — I need to trust my instincts more." ;
    sa:completed            true .
```

**This is the key design move.** The database has `reflectionSetId: "strength-reflections"` and `reflectionId: "thinking"` as opaque strings. The pod resource makes those *meaningful* by linking the reflection to:
- The specific assessment it relates to (`sa:aboutAssessment`)
- The specific score in that assessment (`sa:aboutScore: 78`)
- A human-readable description of the dimension (`sa:dimensionDescription`)
- The prompt that generated the reflection (`sa:prompt`)

An AI reading this resource can fully understand what the reflection means without any external context document.

---

### 6. Final Insight Reflection (Master Pod Only)

**Path:** `/master/reflections/final-insight`

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Reflection, sa:FinalInsight ;
    dcterms:created     "2026-02-15T13:00:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;

    # Links to everything this insight synthesizes
    sa:synthesizes      <https://vaults.selfactual.ai/jacobkim/master/assessments/starcard> ;
    sa:synthesizes      <https://vaults.selfactual.ai/jacobkim/master/assessments/flow-attributes> ;
    sa:synthesizes      <https://vaults.selfactual.ai/jacobkim/master/reflections/strength-reflections/> ;

    sa:insight          "My strongest contribution to a team is seeing the big picture and connecting emotional undercurrents to strategic decisions. I need to watch my tendency to over-plan when I feel uncertain — that's when my Feeling strength can actually guide me better than my Thinking strength." .
```

---

### 7. AST Framework Context

**Path:** `/master/context/ast-framework` and `/sub/context/ast-framework`

This is the framework-level reference — not per-user, but included in each pod so the data is self-describing.

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .

<>
    a sa:Framework ;
    dcterms:title       "AllStarTeams Assessment Framework" ;
    dcterms:publisher   "Heliotrope Imaginal" ;
    sa:version          "2.1.7" ;

    sa:hasDimension [
        sa:dimensionId      "thinking" ;
        rdfs:label          "Thinking" ;
        sa:description      "Analytical and strategic reasoning — how you process information, solve problems, and make decisions." ;
        sa:scoreRange       "0-100"
    ] ;
    sa:hasDimension [
        sa:dimensionId      "acting" ;
        rdfs:label          "Acting" ;
        sa:description      "Execution and initiative — how you take action, drive results, and maintain momentum." ;
        sa:scoreRange       "0-100"
    ] ;
    sa:hasDimension [
        sa:dimensionId      "feeling" ;
        rdfs:label          "Feeling" ;
        sa:description      "Emotional intelligence and connection — how you relate to others, read the room, and build trust." ;
        sa:scoreRange       "0-100"
    ] ;
    sa:hasDimension [
        sa:dimensionId      "planning" ;
        rdfs:label          "Planning" ;
        sa:description      "Organization and foresight — how you structure work, anticipate needs, and manage complexity." ;
        sa:scoreRange       "0-100"
    ] ;

    sa:profileShapes    "Connector, Strategist, Executor, Architect, Catalyst, Integrator" ;
    sa:methodology      "Star Card assessment using four-quadrant self-evaluation with guided reflection." .
```

---

### 8. Provenance / Write Log (Master Pod)

**Path:** `/master/provenance/ast-write-log`

Tracks what was written, when, and by which app. Important for trust and auditability.

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix prov:    <http://www.w3.org/ns/prov#> .

<#write-001>
    a prov:Activity ;
    prov:wasAssociatedWith  "AllStarTeams v2.1.7" ;
    prov:startedAtTime      "2026-02-15T11:00:00Z"^^xsd:dateTime ;
    prov:generated          <https://vaults.selfactual.ai/jacobkim/master/assessments/starcard> ;
    prov:generated          <https://vaults.selfactual.ai/jacobkim/sub/assessments/starcard> ;
    sa:writeType            "assessment-sync" ;
    sa:triggeredBy          "workshop-completion" .

<#write-002>
    a prov:Activity ;
    prov:wasAssociatedWith  "AllStarTeams v2.1.7" ;
    prov:startedAtTime      "2026-02-15T12:00:00Z"^^xsd:dateTime ;
    prov:generated          <https://vaults.selfactual.ai/jacobkim/master/reflections/strength-reflections/thinking> ;
    sa:writeType            "reflection-sync" ;
    sa:triggeredBy          "reflection-submitted" ;
    sa:masterOnly           true .
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│  AllStarTeams (AST)                                     │
│  ┌───────────────┐                                      │
│  │  PostgreSQL    │                                      │
│  │  ┌───────────┐│     Pod Write Service                │
│  │  │starCards   ││──┐  (new component)                 │
│  │  │flowAttribs ││  │  ┌──────────────────┐            │
│  │  │userAssess. ││  ├─▶│ Serialize to RDF │            │
│  │  │reflections ││  │  │ Add context/links│            │
│  │  │finalReflect││──┘  │ Split master/sub │            │
│  │  └───────────┘│      └────────┬─────────┘            │
│  └───────────────┘               │                      │
└──────────────────────────────────┼──────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
        ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
        │  Master Pod   │  │  Sub Pod     │  │  Provenance  │
        │              │  │              │  │  Log         │
        │ • StarCard   │  │ • StarCard   │  │              │
        │ • Flow       │  │ • Flow       │  │ What was     │
        │ • Reflections│  │ • Profile    │  │ written,     │
        │ • Final      │  │   Summary    │  │ when, by     │
        │   Insight    │  │ • Framework  │  │ whom         │
        │ • Full       │  │   Context    │  │              │
        │   Profile    │  │              │  │              │
        │ • Framework  │  │ (No reflect- │  │              │
        │   Context    │  │  ions here)  │  │              │
        └──────────────┘  └──────────────┘  └──────────────┘
              🔒                 🔓
         User only         Shared with
                          authorized apps
```

---

## ACL (Access Control) Sketch

### Master Pod ACL

```turtle
# /master/.acl
@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#owner>
    a acl:Authorization ;
    acl:agent           <https://vaults.selfactual.ai/jacobkim/profile#me> ;
    acl:accessTo        <https://vaults.selfactual.ai/jacobkim/master/> ;
    acl:default         <https://vaults.selfactual.ai/jacobkim/master/> ;
    acl:mode            acl:Read, acl:Write, acl:Control .
```

Only the user. No one else.

### Sub Pod ACL

```turtle
# /sub/.acl
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

# Owner retains full control
<#owner>
    a acl:Authorization ;
    acl:agent           <https://vaults.selfactual.ai/jacobkim/profile#me> ;
    acl:accessTo        <https://vaults.selfactual.ai/jacobkim/sub/> ;
    acl:default         <https://vaults.selfactual.ai/jacobkim/sub/> ;
    acl:mode            acl:Read, acl:Write, acl:Control .

# Authorized third-party app gets Read access
<#app-vault-viewer>
    a acl:Authorization ;
    acl:agent           <https://apps.selfactual.ai/vault-viewer#id> ;
    acl:accessTo        <https://vaults.selfactual.ai/jacobkim/sub/> ;
    acl:default         <https://vaults.selfactual.ai/jacobkim/sub/> ;
    acl:mode            acl:Read .
```

---

## What AST's Pod Write Service Needs to Do

When a user completes an assessment or submits a reflection, AST:

1. **Writes to Postgres** as it does today (no change)
2. **Serializes the data to Turtle RDF**, adding:
   - Explicit links between reflections and assessments (the context that Postgres doesn't have)
   - Dimension labels and descriptions from the AST framework
   - Provenance metadata (app version, timestamp, trigger)
3. **Writes to the master pod** via authenticated HTTP PUT to the appropriate container
4. **If the data is sub-pod-eligible** (assessments, profile summary), also writes to the sub pod — with reflection links stripped out
5. **Appends to the provenance log**

This is a new service component — likely a module within AST's Node.js server that uses a Solid client library (e.g., `@inrupt/solid-client`) to authenticate and write to the pod.

---

## Open Questions for Next Steps

1. **Flow attributes structure** — The Postgres `flowAttributes.attributes` column is JSONB with unknown internal structure. Need to inspect actual data to design the RDF representation accurately.
2. **Workshop step data** — `workshopStepData` stores arbitrary JSONB per step. Some of this may be assessment-adjacent. Decide what (if any) of this goes into pods.
3. **Growth plans** — Rich self-knowledge data in the `growthPlans` table. Strong candidate for pod storage in a future iteration.
4. **Second app data** — What does the second data producer contribute? Needs its own resource design.
5. **User identity** — How does the pod WebID relate to AST's user ID? Need a mapping strategy.
6. **Custom vocabulary publishing** — The `sa:` prefix needs to resolve to actual RDF. For POC, this can be a static file; for production, it should be a proper ontology.
