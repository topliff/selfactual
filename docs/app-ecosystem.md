# SelfActual App Ecosystem

The SelfActual vault is a personal data infrastructure. Multiple apps write to and read from a user's vault — no single app owns the data. This document tracks the apps that participate in the ecosystem, what data they contribute or consume, and their relationship to the vault.

---

## Data Producers (Write to Vault)

### 1. AllStarTeams (AST) — Microcourse
**Status:** Live (HI_Replit codebase)
**What it is:** A guided workshop/microcourse that helps users discover their strengths profile through the Star Card framework (Thinking, Acting, Feeling, Planning quadrants), flow attributes, and guided reflections.
**Vault role:** Primary data producer for the POC. Users complete the AST microcourse, then their results flow into the vault.

**Data contributed:**
| Data | Pod | Description |
|------|-----|-------------|
| Star Card scores | Master + Sub | Four quadrant scores (thinking, acting, feeling, planning) |
| Flow attributes | Master + Sub | Flow assessment results (JSONB, structure TBD) |
| Strength reflections | Master only | Per-dimension reflections linked to Star Card scores |
| Final insight | Master only | Synthesis reflection across all dimensions |
| AST framework context | Master + Sub | Metadata describing the assessment framework |

**Current storage:** PostgreSQL on AWS (tables: `starCards`, `flowAttributes`, `userAssessments`, `reflectionResponses`, `finalReflections`, `workshopStepData`)
**Pod integration:** Not yet built. Needs a pod write service that serializes Postgres data to RDF and writes to both pods after workshop events. See `selfactual-pod-resources-sketch.md` for the resource design.

---

### 2. Atlas — Assessment Aggregator
**Status:** Early planning (repo: `SelfActual_Atlas/Atlas`, tickets written through VAULT-055 — backlog needs revision for pod-native architecture)
**What it is:** A personal assessment aggregator that lets users consolidate results from assessments they've already taken — MBTI, Big Five, StrengthsFinder, Enneagram, DISC, and others — into their vault alongside their AST data.

**Vault role:** Second data producer for the POC. Demonstrates that the vault aggregates self-knowledge from multiple independent sources, not just AST.

**Data contributed:**
| Data | Pod | Description |
|------|-----|-------------|
| External assessment results | Master + Sub | User-entered results from MBTI, Big5, StrengthsFinder, Enneagram, DISC, etc. |
| Assessment framework metadata | Master + Sub | What each assessment measures, scoring systems, dimension descriptions |
| Cross-assessment insights | Master only (initially) | AI-generated or user-created connections between different assessment results |

**Architecture: Pod-native.** Unlike AST (which keeps its Postgres DB and syncs to pods), Atlas has no legacy database to maintain. It reads and writes directly to the user's Solid Pod — no separate backend database. This makes Atlas a lighter app: a frontend that authenticates via Auth0/Solid-OIDC, collects assessment input from the user, serializes it to RDF, and writes it to the pod.

**Note on existing backlog:** The Atlas ticket backlog (VAULT-001 through VAULT-055, ~150 SP) was designed before the pod-native decision and assumes a standalone AWS backend (Lambda, RDS, API Gateway). Much of that infrastructure work (VPC, RDS, Lambda structure, DB schema, migrations) is no longer needed. The frontend tickets (VAULT-037 through VAULT-046) and AI integration tickets (VAULT-047 through VAULT-055) are still partially relevant but need revision to target pods instead of a REST API. The backlog should be reworked rather than followed as-is.

**Supported assessment frameworks (planned):**
- Myers-Briggs Type Indicator (MBTI) — 16 types, 4 dichotomies
- Big Five / OCEAN — 5 dimensions, continuous scores
- CliftonStrengths (StrengthsFinder) — 34 themes, ranked
- Enneagram — 9 types + wings + instinctual variants
- DISC — 4 behavioral styles
- VIA Character Strengths — 24 strengths, ranked
- Others as needed (open-ended input support)

---

### 3. Imaginal Agility (IA) — Microcourse
**Status:** Live (shares HI_Replit codebase with AST)
**What it is:** A second workshop/microcourse in the Heliotrope system, focused on imagination and agility practices.
**Vault role:** Future data producer. Similar integration pattern to AST — complete the course, results flow to vault.

**Data contributed:** TBD — depends on IA's assessment and reflection structure. Uses the same `workshopStepData`, `reflectionResponses`, and `navigationProgress` tables as AST but with `workshopType: 'ia'`.

**Pod integration:** Not yet scoped. Would follow the same pattern as AST once that integration is proven.

---

## Data Consumers (Read from Vault)

### 4. Coaching Mentor — AI-Powered Personal Development App
**Status:** Concept
**What it is:** A mobile or hybrid app that serves as the user's ongoing AI coaching companion *after* they complete the AST microcourse. Users don't come back to AST — instead, they use this app for check-ins (growth plans, energy, goals), AI coaching conversations grounded in their full vault data, and producing shareable artifacts like a "Working With Me" document.

**Vault role:** Primary consumer *and* producer. Reads the user's full self-knowledge picture from the vault (assessments from AST, external assessments from Atlas, past reflections) and writes back ongoing development data (check-ins, coaching conversations, generated documents).

**Data consumed:**
| Data | Source Pod | Usage |
|------|-----------|-------|
| Star Card scores | Sub | Baseline for coaching context |
| Flow attributes | Sub | Inform coaching about work patterns |
| External assessments (from Atlas) | Sub | Broader personality context for AI coach |
| Reflections and final insights | Master | AI coach references past self-knowledge |
| Previous check-ins and growth plans | Master | Continuity across coaching sessions |

**Data contributed:**
| Data | Pod | Description |
|------|-----|-------------|
| Check-ins | Master only | Periodic updates on goals, energy, blockers, growth |
| Growth plans | Master only | Structured quarterly plans (vision, priorities, ladder levels, etc.) |
| Coaching conversations | Master only | AI coaching chat history with context snapshots |
| Coaching-generated insights | Master only | Patterns the AI identifies across sessions |
| "Working With Me" document | Sub | A shareable summary of how the user works best — strengths, communication preferences, collaboration style, energy patterns. Produced by AI from vault data, reviewed and approved by the user. Designed to be shared with coworkers, managers, or new teams. |

**Current storage:** Growth plan data exists in AST's Postgres (`growthPlans` table) but the standalone coaching app doesn't exist yet. The `growthPlans` schema has: quarterly goals, star power reflections, ladder levels, strengths examples, flow catalysts, vision statements, progress tracking, team dynamics, and key priorities.

**Key design insight:** This app is the clearest example of why the vault matters. Users finish AST and never return to it — but their data needs to travel with them into an ongoing coaching relationship. Without the vault, you'd need to build a data pipeline between AST and the coaching app. With the vault, the coaching app just reads from the user's pod.

**The "Working With Me" document** is also a strong vault story: it's AI-generated from private vault data (master pod), but the output goes into the sub pod as a shareable artifact. The user controls when it's generated, reviews it before publishing, and can revoke access at any time. It's a concrete example of the master → sub data flow with user consent in the middle.

---

### 5. Vault Viewer — POC Demo App
**Status:** Planned for POC
**What it is:** A lightweight web app that authenticates against a user's vault and displays its contents. Shows master pod (everything) vs. sub pod (shareable subset) side by side.

**Vault role:** Pure consumer. Reads from both pods to demonstrate the access control model. This is the "prove the security works" app.

**What it shows:**
- Master pod contents: full profile, all assessments, all reflections, growth plans, coaching history
- Sub pod contents: shareable profile, assessment results only, framework context
- Access control: which apps have read access to the sub pod
- Provenance: which app wrote each piece of data and when
- Data from multiple sources: AST data and Atlas data appearing in the same vault

**Technical scope:** Minimal — a single-page app using a Solid client library (@inrupt/solid-client or similar) that authenticates via Solid-OIDC and renders pod contents. No backend needed beyond the pod server itself.

---

## Future / Speculative

### 6. Team Dynamics App
A team-level view that reads sub pod data (with permission) from multiple team members to surface team composition, complementary strengths, and collaboration insights. Builds on the `connectionSuggestions` and `userProfilesExtended` concepts already in the AST schema.

### 7. Third-Party Integrations
The long-term vision: any app can request read access to a user's sub pod. Coaching platforms, HR tools, team-building apps, hiring tools (with user consent), peer feedback systems, etc. The sub pod becomes a portable, user-controlled self-knowledge API.

---

## Authentication: Shared Auth0 Tenant

All apps in the ecosystem use the same Auth0 tenant. Each app registers as a separate "application" within that tenant with its own client ID and callback URLs, but users have a single identity across the system.

**Why this works:**
- Auth0 is designed for this — one tenant, multiple apps, single user identity
- Users sign in once and are recognized across AST, Atlas, Coaching Mentor, Vault Viewer
- Maps cleanly to Solid's model: a stable user identity is required for pod access control (ACLs reference the user's identity, not per-app credentials)
- AST already has Auth0 integrated (`auth0Sub` field in the users table)

**Open question for later:** CSS (Community Solid Server) has its own built-in Solid-OIDC identity provider. For the POC, we need to decide whether to use Auth0 *as* the Solid-OIDC provider (possible but requires configuration), bridge between Auth0 and CSS's built-in OIDC (user authenticates via Auth0, which maps to a Solid WebID), or use CSS's built-in OIDC and defer Auth0 integration. The simplest POC path is likely to use CSS's built-in identity for pod operations and keep Auth0 for app-level auth, then unify them later.

### Two Classes of Apps

The ecosystem has two fundamentally different types of apps with different auth relationships:

**First-party apps (SelfActual / Heliotrope):**
- AST, Atlas, Imaginal Agility, Coaching Mentor, Vault Viewer
- All share the same Auth0 tenant — single user identity across all apps
- SelfActual controls the Auth0 tenant and the pod server
- Auth0 ↔ CSS Solid-OIDC mapping is an internal problem we solve once
- Pod provisioning (creating both pods on signup) is triggered by these apps

**Third-party apps (external developers, future):**
- Have their own authentication systems (not our Auth0 tenant)
- Need to request access to a user's sub pod through a consent flow
- Must authenticate to CSS via Solid-OIDC to read pod data
- Never touch the master pod
- Identity mapping is different: their user identity must map to a Solid agent that the pod's ACL recognizes

**POC focus:** First-party apps and Auth0 first. Third-party auth patterns come later once the internal flow is proven.

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│  DATA PRODUCERS                                                │
│                                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                     │
│  │   AST    │  │  Atlas   │  │   IA     │                     │
│  │Microcourse│  │Assessment│  │Microcourse│                    │
│  │  (DB+sync)│  │(pod-native)│ │  (DB+sync)│                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                     │
│       │              │              │                          │
│       │  AST/IA keep their DBs + sync to pods                 │
│       │  Atlas writes directly to pods (no separate DB)        │
│       │              │              │                          │
│       ▼              ▼              ▼                          │
│  ┌─────────────────────────────────────────────┐              │
│  │           USER'S SOLID VAULT                 │              │
│  │                                             │              │
│  │  ┌──────────────┐    ┌──────────────┐       │              │
│  │  │  Master Pod   │    │   Sub Pod    │       │              │
│  │  │              │    │              │       │              │
│  │  │ Everything   │    │ Assessments  │       │              │
│  │  │ (private)    │    │ Profile      │       │              │
│  │  │              │    │ (shareable)  │       │              │
│  │  └──────────────┘    └──────┬───────┘       │              │
│  │         🔒                   │ 🔓            │              │
│  └──────────────────────────────┼──────────────┘              │
│                                 │                              │
│       ┌─────────────────────────┼──────────┐                   │
│       │                         │          │                   │
│       ▼                         ▼          ▼                   │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────┐            │
│  │ Coaching │  │   Vault Viewer   │  │  Future  │            │
│  │ Mentor   │  │   (POC Demo)     │  │  3rd     │            │
│  │ (AI)     │  │                  │  │  Party   │            │
│  └──────────┘  └──────────────────┘  └──────────┘            │
│                                                                │
│  DATA CONSUMERS                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## POC Scope (Minimum Viable)

For the proof of concept, we need:

1. **AST → Vault sync** — AST writes Star Card + flow attributes to sub pod, reflections to master pod only
2. **Atlas → Vault** — User enters at least one external assessment (e.g., MBTI result) that also lands in the vault
3. **Vault Viewer** — Shows both pods, demonstrates that AST data and Atlas data coexist, shows the master/sub access boundary
4. **Dual-pod provisioning** — Automated creation of both pods on user signup
5. **Access control demo** — Vault Viewer can read sub pod but not master pod; user can see both

This proves: multi-source aggregation, user ownership, selective sharing, and the trust boundary — without building the full coaching app or team dynamics layer.
