#!/bin/bash
# =============================================================================
# SelfActual Pod Validation Script
# 
# Tests the CSS instance at vaults.selfactual.ai by:
#   1. Reading the existing test pod profile
#   2. Creating master/ and sub/ containers (full directory structure)
#   3. Writing a test Star Card resource to master (with reflection link)
#   4. Writing a shareable copy to sub (without reflection link)
#   5. Writing a test reflection to master only
#   6. Reading everything back and verifying round-trip
#   7. Verifying unauthenticated access is denied
#
# Prerequisites:
#   - A pod already created at https://vaults.selfactual.ai/test_pod/
#   - CSS credentials (email + password used during registration)
#
# Usage:
#   export CSS_EMAIL="your-email@example.com"
#   export CSS_PASSWORD="your-password"
#   chmod +x validate-pod.sh
#   ./validate-pod.sh
# =============================================================================

set -euo pipefail

BASE_URL="https://vaults.selfactual.ai"
POD_URL="${BASE_URL}/test_pod"
WEBID="${POD_URL}/profile/card#me"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { printf "${GREEN}✓ %s${NC}\n" "$1"; }
fail() { printf "${RED}✗ %s${NC}\n" "$1"; }
info() { printf "${YELLOW}→ %s${NC}\n" "$1"; }

# macOS-compatible: get body (all but last line) and code (last line) from curl output
get_body() { sed '$d'; }
get_code() { tail -1; }

echo ""
echo "============================================"
echo "  SelfActual Pod Validation"
echo "============================================"
echo ""

if [ -z "${CSS_EMAIL:-}" ] || [ -z "${CSS_PASSWORD:-}" ]; then
    echo "Set your CSS credentials first:"
    echo "  export CSS_EMAIL=\"your-email@example.com\""
    echo "  export CSS_PASSWORD=\"your-password\""
    exit 1
fi

# --- Authenticate ---
info "Authenticating with CSS..."

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${CSS_EMAIL}\", \"password\": \"${CSS_PASSWORD}\"}" \
    "${BASE_URL}/.account/login/password/")

LOGIN_HTTP_CODE=$(echo "$LOGIN_RESPONSE" | get_code)
LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | get_body)

if [ "$LOGIN_HTTP_CODE" = "200" ]; then
    pass "Login successful"
    AUTH_TOKEN=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('authorization',''))" 2>/dev/null || echo "")
    if [ -n "$AUTH_TOKEN" ]; then
        info "Got authorization token"
        AUTH_HEADER="Authorization: CSS-Account-Token ${AUTH_TOKEN}"
    else
        info "No token in response body — CSS may use a different auth flow"
        info "Body: ${LOGIN_BODY}"
        AUTH_HEADER=""
    fi
else
    fail "Login failed (HTTP ${LOGIN_HTTP_CODE}): ${LOGIN_BODY}"
    exit 1
fi

echo ""

# --- Read profile ---
info "Reading existing profile..."

PROFILE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -H "Accept: text/turtle" \
    "${POD_URL}/profile/card")

PROFILE_HTTP_CODE=$(echo "$PROFILE_RESPONSE" | get_code)
PROFILE_BODY=$(echo "$PROFILE_RESPONSE" | get_body)

if [ "$PROFILE_HTTP_CODE" = "200" ]; then
    pass "Profile readable (HTTP 200)"
    echo "$PROFILE_BODY" | head -15
else
    fail "Could not read profile (HTTP ${PROFILE_HTTP_CODE})"
fi

echo ""

# --- Create container structure ---
info "Creating container structure..."

for CONTAINER in "master/" "sub/" "master/assessments/" "master/reflections/" "master/reflections/strength-reflections/" "master/context/" "master/provenance/" "sub/assessments/" "sub/context/"; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PUT \
        -H "${AUTH_HEADER}" \
        -H "Content-Type: text/turtle" \
        -H 'Link: <http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' \
        -d '' \
        "${POD_URL}/${CONTAINER}")
    
    if [ "$CODE" = "201" ] || [ "$CODE" = "200" ] || [ "$CODE" = "205" ]; then
        pass "${CONTAINER} created (HTTP ${CODE})"
    elif [ "$CODE" = "409" ]; then
        pass "${CONTAINER} already exists"
    else
        fail "${CONTAINER} failed (HTTP ${CODE})"
    fi
done

echo ""

# --- Write Star Card to MASTER (includes reflection link) ---
info "Writing Star Card to master pod..."

STARCARD_MASTER='@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment, sa:StarCard ;
    dcterms:created     "2026-02-27T12:00:00Z"^^xsd:dateTime ;
    dcterms:modified    "2026-02-27T12:00:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;
    sa:sourceVersion    "2.1.7" ;
    sa:thinking         78 ;
    sa:acting           65 ;
    sa:feeling          82 ;
    sa:planning         71 ;
    sa:dominantQuadrant "feeling" ;
    sa:profileShape     "Connector" ;
    sa:hasReflections   <https://vaults.selfactual.ai/test_pod/master/reflections/strength-reflections/> .
'

WRITE_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: text/turtle" \
    -d "$STARCARD_MASTER" \
    "${POD_URL}/master/assessments/starcard")

if [ "$WRITE_CODE" = "201" ] || [ "$WRITE_CODE" = "205" ] || [ "$WRITE_CODE" = "200" ]; then
    pass "Star Card → master (HTTP ${WRITE_CODE})"
else
    fail "Star Card → master failed (HTTP ${WRITE_CODE})"
fi

# --- Write Star Card to SUB (NO reflection link) ---
info "Writing Star Card to sub pod (no reflection link)..."

STARCARD_SUB='@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Assessment, sa:StarCard ;
    dcterms:created     "2026-02-27T12:00:00Z"^^xsd:dateTime ;
    dcterms:modified    "2026-02-27T12:00:00Z"^^xsd:dateTime ;
    sa:framework        <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp        "AllStarTeams" ;
    sa:sourceVersion    "2.1.7" ;
    sa:thinking         78 ;
    sa:acting           65 ;
    sa:feeling          82 ;
    sa:planning         71 ;
    sa:dominantQuadrant "feeling" ;
    sa:profileShape     "Connector" .
'

WRITE_SUB_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: text/turtle" \
    -d "$STARCARD_SUB" \
    "${POD_URL}/sub/assessments/starcard")

if [ "$WRITE_SUB_CODE" = "201" ] || [ "$WRITE_SUB_CODE" = "205" ] || [ "$WRITE_SUB_CODE" = "200" ]; then
    pass "Star Card → sub (HTTP ${WRITE_SUB_CODE})"
else
    fail "Star Card → sub failed (HTTP ${WRITE_SUB_CODE})"
fi

echo ""

# --- Write reflection to MASTER only ---
info "Writing test reflection to master (private)..."

REFLECTION='@prefix sa:      <https://vocab.selfactual.ai/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .

<>
    a sa:Reflection ;
    dcterms:created         "2026-02-27T12:30:00Z"^^xsd:dateTime ;
    sa:framework            <https://vocab.selfactual.ai/frameworks/ast> ;
    sa:sourceApp            "AllStarTeams" ;
    sa:reflectionSet        "strength-reflections" ;
    sa:reflectionDimension  "thinking" ;
    sa:aboutAssessment      <https://vaults.selfactual.ai/test_pod/master/assessments/starcard> ;
    sa:aboutScore           78 ;
    sa:dimensionLabel       "Thinking" ;
    sa:dimensionDescription "Analytical and strategic reasoning — how you process information, solve problems, and make decisions." ;
    sa:prompt               "Reflect on how your Thinking strength shows up in your daily work." ;
    sa:response             "I notice my analytical side comes out most in planning sessions. I tend to map dependencies before anyone else sees them, which helps the team avoid surprises." ;
    sa:completed            true .
'

REFL_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "${AUTH_HEADER}" \
    -H "Content-Type: text/turtle" \
    -d "$REFLECTION" \
    "${POD_URL}/master/reflections/strength-reflections/thinking")

if [ "$REFL_CODE" = "201" ] || [ "$REFL_CODE" = "205" ] || [ "$REFL_CODE" = "200" ]; then
    pass "Reflection → master (HTTP ${REFL_CODE})"
else
    fail "Reflection → master failed (HTTP ${REFL_CODE})"
fi

echo ""

# --- Read back and verify ---
info "Reading Star Card from master..."

READ_MASTER=$(curl -s -w "\n%{http_code}" \
    -H "${AUTH_HEADER}" \
    -H "Accept: text/turtle" \
    "${POD_URL}/master/assessments/starcard")

READ_MASTER_CODE=$(echo "$READ_MASTER" | get_code)
READ_MASTER_BODY=$(echo "$READ_MASTER" | get_body)

if [ "$READ_MASTER_CODE" = "200" ]; then
    pass "Master Star Card readable"
    echo "$READ_MASTER_BODY"
    echo ""
    
    echo "$READ_MASTER_BODY" | grep -q "hasReflections" && pass "Contains reflection link ✓" || fail "Missing reflection link"
    echo "$READ_MASTER_BODY" | grep -q "82" && pass "Feeling score (82) round-tripped ✓" || fail "Score data issue"
else
    fail "Could not read master Star Card (HTTP ${READ_MASTER_CODE})"
fi

echo ""

info "Reading Star Card from sub..."

READ_SUB=$(curl -s -w "\n%{http_code}" \
    -H "${AUTH_HEADER}" \
    -H "Accept: text/turtle" \
    "${POD_URL}/sub/assessments/starcard")

READ_SUB_CODE=$(echo "$READ_SUB" | get_code)
READ_SUB_BODY=$(echo "$READ_SUB" | get_body)

if [ "$READ_SUB_CODE" = "200" ]; then
    pass "Sub Star Card readable"
    echo "$READ_SUB_BODY"
    echo ""
    
    echo "$READ_SUB_BODY" | grep -q "hasReflections" && fail "Sub has reflection link (SHOULD NOT)" || pass "No reflection link in sub ✓"
else
    fail "Could not read sub Star Card (HTTP ${READ_SUB_CODE})"
fi

echo ""

info "Reading reflection from master..."

READ_REFL=$(curl -s -w "\n%{http_code}" \
    -H "${AUTH_HEADER}" \
    -H "Accept: text/turtle" \
    "${POD_URL}/master/reflections/strength-reflections/thinking")

READ_REFL_CODE=$(echo "$READ_REFL" | get_code)
READ_REFL_BODY=$(echo "$READ_REFL" | get_body)

if [ "$READ_REFL_CODE" = "200" ]; then
    pass "Reflection readable from master"
    echo "$READ_REFL_BODY" | grep -q "aboutAssessment" && pass "Reflection links to assessment ✓" || fail "Missing assessment link"
    echo "$READ_REFL_BODY" | grep -q "analytical" && pass "Reflection text round-tripped ✓" || fail "Reflection text issue"
else
    fail "Could not read reflection (HTTP ${READ_REFL_CODE})"
fi

echo ""

# --- Access control check ---
info "Testing: read master WITHOUT authentication..."

UNAUTH_MASTER=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Accept: text/turtle" \
    "${POD_URL}/master/assessments/starcard")

if [ "$UNAUTH_MASTER" = "401" ] || [ "$UNAUTH_MASTER" = "403" ]; then
    pass "Master DENIED without auth (HTTP ${UNAUTH_MASTER}) ✓"
else
    info "Master returned HTTP ${UNAUTH_MASTER} without auth (may depend on default ACL config)"
fi

info "Testing: read sub WITHOUT authentication..."

UNAUTH_SUB=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Accept: text/turtle" \
    "${POD_URL}/sub/assessments/starcard")

info "Sub returned HTTP ${UNAUTH_SUB} without auth (default ACL behavior)"

echo ""

# --- Summary ---
echo "============================================"
echo "  Validation Complete"
echo "============================================"
echo ""
echo "Pod:    ${POD_URL}/"
echo "WebID:  ${WEBID}"
echo ""
echo "Resources written:"
echo "  ${POD_URL}/master/assessments/starcard"
echo "  ${POD_URL}/sub/assessments/starcard"
echo "  ${POD_URL}/master/reflections/strength-reflections/thinking"
echo ""
echo "Next steps:"
echo "  1. Set WAC ACLs (master=owner-only, sub=app-readable)"
echo "  2. Create a second account to test cross-pod access"
echo "  3. Try with @inrupt/solid-client in Node.js"
echo ""
