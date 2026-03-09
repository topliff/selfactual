# SelfActual Vocabulary Reference

The SelfActual vocabulary (`sa:`) defines the classes and properties used in pod data. The namespace URI is `https://vocab.selfactual.ai/`.

The machine-readable ontology is in [sa.ttl](sa.ttl).

## Prefixes Used in This Document

```turtle
@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix schema:  <http://schema.org/> .
@prefix foaf:    <http://xmlns.com/foaf/0.1/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix prov:    <http://www.w3.org/ns/prov#> .
```

## Classes

### Core Types

| Class | Description | Found In |
|---|---|---|
| `sa:VaultOwner` | A user who owns a vault (master + sub pod) | Master pod profile |
| `sa:SharedProfile` | A shareable subset of user profile | Sub pod profile-summary |
| `sa:Assessment` | Base type for all assessments | Both pods |
| `sa:StarCard` | A Star Card four-quadrant assessment | Both pods |
| `sa:FlowProfile` | A Flow Attributes assessment | Both pods |
| `sa:Reflection` | A user reflection on an assessment dimension | Master pod only |
| `sa:FinalInsight` | A synthesis reflection across all assessments | Master pod only |
| `sa:Framework` | Assessment framework metadata | Both pods (context/) |

### Organization Types

| Class | Description | Found In |
|---|---|---|
| `sa:OrgVault` | An organization's vault | Org pod profile |
| `sa:Team` | A team within an organization | Org pod teams/ |
| `sa:OrgValues` | Organization mission and values | Org pod values/ |
| `sa:Integration` | A systems-of-record connection | Org pod integrations/ |

## Properties

### Identity & Profile

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:vaultCreated` | `sa:VaultOwner` | `xsd:dateTime` | When the vault was created |
| `sa:masterPod` | `sa:VaultOwner` | URI | Link to user's master pod root |
| `sa:subPod` | `sa:VaultOwner` | URI | Link to user's sub pod root |
| `sa:hasAssessment` | `sa:SharedProfile` | URI | Link to an assessment resource |

### Assessment Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:framework` | `sa:Assessment` | URI | Link to the framework this assessment uses |
| `sa:sourceApp` | (any) | `xsd:string` | Name of the application that created this resource |
| `sa:sourceVersion` | (any) | `xsd:string` | Version of the application |
| `sa:relatedAssessment` | `sa:Assessment` | URI | Link to another related assessment |

### Star Card Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:thinking` | `sa:StarCard` | `xsd:integer` | Thinking quadrant score (0–100) |
| `sa:acting` | `sa:StarCard` | `xsd:integer` | Acting quadrant score (0–100) |
| `sa:feeling` | `sa:StarCard` | `xsd:integer` | Feeling quadrant score (0–100) |
| `sa:planning` | `sa:StarCard` | `xsd:integer` | Planning quadrant score (0–100) |
| `sa:dominantQuadrant` | `sa:StarCard` | `xsd:string` | Which quadrant scored highest |
| `sa:profileShape` | `sa:StarCard` | `xsd:string` | Derived profile type (e.g., "Connector", "Strategist") |
| `sa:hasReflections` | `sa:StarCard` | URI | Link to reflections container (master pod only) |

### Flow Attribute Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:flowAttribute` | `sa:FlowProfile` | Blank node | A single flow attribute (contains name, score, category) |
| `sa:name` | (blank node) | `xsd:string` | Name of the flow attribute |
| `sa:score` | (blank node) | `xsd:integer` | Score for this attribute |
| `sa:category` | (blank node) | `xsd:string` | Category of the attribute (e.g., "cognitive", "social") |

### Reflection Properties (Master Pod Only)

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:reflectionSet` | `sa:Reflection` | `xsd:string` | Which set this reflection belongs to |
| `sa:reflectionDimension` | `sa:Reflection` | `xsd:string` | Which dimension (e.g., "thinking") |
| `sa:aboutAssessment` | `sa:Reflection` | URI | Link to the assessment this reflects on |
| `sa:aboutScore` | `sa:Reflection` | `xsd:integer` | The specific score being reflected on |
| `sa:dimensionLabel` | `sa:Reflection` | `xsd:string` | Human-readable dimension name |
| `sa:dimensionDescription` | `sa:Reflection` | `xsd:string` | Description of what this dimension measures |
| `sa:prompt` | `sa:Reflection` | `xsd:string` | The prompt that guided this reflection |
| `sa:response` | `sa:Reflection` | `xsd:string` | The user's reflection text |
| `sa:completed` | `sa:Reflection` | `xsd:boolean` | Whether the reflection is complete |
| `sa:synthesizes` | `sa:FinalInsight` | URI | Link to a resource this insight synthesizes |
| `sa:insight` | `sa:FinalInsight` | `xsd:string` | The synthesis text |

### Framework Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:version` | `sa:Framework` | `xsd:string` | Framework version |
| `sa:hasDimension` | `sa:Framework` | Blank node | A dimension definition |
| `sa:dimensionId` | (blank node) | `xsd:string` | Machine-readable dimension ID |
| `sa:description` | (blank node) | `xsd:string` | Human-readable description |
| `sa:scoreRange` | (blank node) | `xsd:string` | Score range (e.g., "0-100") |
| `sa:profileShapes` | `sa:Framework` | `xsd:string` | Comma-separated list of possible shapes |
| `sa:methodology` | `sa:Framework` | `xsd:string` | Description of the assessment methodology |

### Organization Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:hasTeam` | `sa:OrgVault` | URI | Link to a team resource |
| `sa:hasMember` | `sa:Team` | Blank node | A team member (contains memberName, subPod) |
| `sa:memberName` | (blank node) | `xsd:string` | Display name of the member |
| `sa:mission` | `sa:OrgValues` | `xsd:string` | Organization mission statement |
| `sa:value` | `sa:OrgValues` | `xsd:string` | An organization value (repeatable) |
| `sa:system` | `sa:Integration` | `xsd:string` | Name of the external system |
| `sa:dataTypes` | `sa:Integration` | `xsd:string` | Types of data available |
| `sa:status` | `sa:Integration` | `xsd:string` | Integration status (e.g., "planned", "active") |

### Provenance Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `sa:writeType` | `prov:Activity` | `xsd:string` | Category of write operation |
| `sa:triggeredBy` | `prov:Activity` | `xsd:string` | What caused this write |
| `sa:masterOnly` | `prov:Activity` | `xsd:boolean` | Whether this write was to master pod only |

## Standard Vocabularies Used

SelfActual data also uses predicates from these standard vocabularies:

| Prefix | Namespace | Used For |
|---|---|---|
| `foaf:` | `http://xmlns.com/foaf/0.1/` | `foaf:name`, `foaf:Person` |
| `schema:` | `http://schema.org/` | `schema:jobTitle`, `schema:worksFor`, `schema:email`, `schema:Organization` |
| `dcterms:` | `http://purl.org/dc/terms/` | `dcterms:created`, `dcterms:modified`, `dcterms:title`, `dcterms:publisher` |
| `rdfs:` | `http://www.w3.org/2000/01/rdf-schema#` | `rdfs:label` |
| `prov:` | `http://www.w3.org/ns/prov#` | `prov:Activity`, `prov:wasAssociatedWith`, `prov:startedAtTime`, `prov:generated` |

---

Next: [Extending the Schema →](extending-schema.md)
