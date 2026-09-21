#!/bin/bash
# End-to-end API test for the incident workflow and role permissions:
#   Staff reports → Quality assigns the responsible HOD → HOD investigates, writes RCA and CAPA,
#   submits → Quality reviews (sends back, then accepts). Admin views only.
# Needs a seeded database (npm run seed). Usage:
#   BASE_URL=http://localhost:5000/api/v1 bash test_full_lifecycle.sh
set -e

BASE_URL="${BASE_URL:-http://localhost:5000/api/v1}"
PY="${PYTHON:-python3}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
FAILURES=0

# ---------- helpers ----------

# api METHOD PATH TOKEN [JSON_BODY] → prints the response body; HTTP status goes to $TMP_DIR/status
api() {
  local method=$1 path=$2 token=$3 body=${4:-}
  local args=(-s -o "$TMP_DIR/body" -w "%{http_code}" -X "$method" "$BASE_URL$path" -H "Authorization: Bearer $token")
  if [ -n "$body" ]; then args+=(-H "Content-Type: application/json" -d "$body"); fi
  curl "${args[@]}" > "$TMP_DIR/status"
  cat "$TMP_DIR/body"
}
status() { cat "$TMP_DIR/status"; }

# json EXPRESSION → evaluates a Python expression on the JSON read from stdin (as d)
json() { $PY -c "import sys, json; d=json.load(sys.stdin); print($1)"; }

check() { # check DESCRIPTION ACTUAL EXPECTED
  if [ "$2" == "$3" ]; then
    echo "  OK   $1"
  else
    echo "  FAIL $1 — got '$2', expected '$3'"
    FAILURES=$((FAILURES + 1))
  fi
}

login() {
  curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/json" \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" | json "d['data']['accessToken']"
}

dept_id() { api GET /departments "$STAFF" | json "next(x['_id'] for x in d['data'] if x['code'] == '$1')"; }

# ---------- 1. Logins ----------
echo "=== 1. Log in as each role ==="
STAFF=$(login nurse.mary Staff@123)          # Emergency staff nurse (reporter)
OTHER_STAFF=$(login nurse.kavitha Staff@123) # ICU staff nurse
QUALITY=$(login quality.anita Quality@123)
HOD=$(login hod.emergency Hod@123)           # responsible HOD (after assignment)
OTHER_HOD=$(login hod.icu Hod@123)           # first (wrong) assignment
ADMIN=$(login admin Admin@123)
echo "  Tokens obtained."

WARD=$(dept_id WARD)
EMERGENCY=$(dept_id EMERGENCY)
ICU=$(dept_id ICU)
LOC=$(api GET "/locations?departmentId=$WARD" "$STAFF" | json "d['data'][0]['_id']")
CAT=$(api GET /categories "$STAFF" | json "d['data'][0]['_id']")
TARGET_DATE=$($PY -c "import datetime; print((datetime.date.today() + datetime.timedelta(days=30)).isoformat())")

# ---------- 2. Staff reports ----------
echo "=== 2. Staff uploads evidence and reports an incident (occurred in Ward) ==="
printf 'demo evidence' > "$TMP_DIR/evidence.png"
EVIDENCE_PATH="$TMP_DIR/evidence.png"
# Git Bash on Windows: curl needs a Windows path inside -F
if command -v cygpath > /dev/null; then EVIDENCE_PATH=$(cygpath -m "$EVIDENCE_PATH"); fi
FILE_ID=$(curl -s -X POST "$BASE_URL/attachments" -H "Authorization: Bearer $STAFF" \
  -F "file=@$EVIDENCE_PATH;type=image/png" -F "entityType=INCIDENT" | json "d['data']['_id']")
INC=$(api POST /incidents "$STAFF" "{
  \"incidentDateTime\": \"2026-09-18T10:00:00Z\",
  \"occurredInDepartmentId\": \"$WARD\", \"locationId\": \"$LOC\", \"categoryId\": \"$CAT\",
  \"severity\": 2, \"title\": \"Wrong antibiotic dose\",
  \"description\": \"Patient received the wrong antibiotic dose; IV bag label missing.\",
  \"attachments\": [\"$FILE_ID\"]
}")
check "report accepted" "$(status)" 201
INC_ID=$(echo "$INC" | json "d['data']['_id']")
check "new report waits for Quality" "$(echo "$INC" | json "d['data']['status']")" SUBMITTED
check "no responsible department yet" "$(echo "$INC" | json "d['data'].get('departmentId')")" None

echo "=== 3. Who can see the new report ==="
BODY=$(api GET "/incidents/$INC_ID" "$STAFF")
check "reporter sees it, limited view (no confirmed severity / HOD fields)" \
  "$(echo "$BODY" | json "'severity' in d['data'] or 'assignedHod' in d['data'] or 'qualityReviews' in d['data']")" False
api GET "/incidents/$INC_ID" "$OTHER_STAFF" > /dev/null; check "other staff cannot view" "$(status)" 403
api GET "/incidents/$INC_ID" "$HOD" > /dev/null;         check "HOD cannot view before assignment" "$(status)" 403
api GET "/attachments/$FILE_ID/download" "$STAFF" > /dev/null;       check "reporter downloads own file" "$(status)" 200
api GET "/attachments/$FILE_ID/download" "$OTHER_STAFF" > /dev/null; check "other staff cannot download it" "$(status)" 403
CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL%/api/v1}/uploads/anything.png")
check "no public /uploads folder" "$CODE" 404

# ---------- 4. Quality triage ----------
echo "=== 4. Quality asks for more information; staff answers ==="
check "in Quality's triage queue" "$(api GET /incidents/triage-queue "$QUALITY" | json "'$INC_ID' in [i['_id'] for i in d['data']]")" True
api POST "/incidents/$INC_ID/request-info" "$QUALITY" '{"question": ""}' > /dev/null
check "question is required" "$(status)" 422
check "info requested" "$(api POST "/incidents/$INC_ID/request-info" "$QUALITY" '{"question": "Which bed and what time?"}' | json "d['data']['status']")" INFO_REQUESTED
api POST "/incidents/$INC_ID/respond" "$OTHER_STAFF" '{"response": "Not me"}' > /dev/null
check "only the reporter can answer" "$(status)" 403
check "reporter answers, back to Quality" "$(api POST "/incidents/$INC_ID/respond" "$STAFF" '{"response": "Bed 12, 10:00"}' | json "d['data']['status']")" SUBMITTED

echo "=== 5. Quality assigns to ICU; ICU HOD returns it (wrong department) ==="
check "assigned to ICU" "$(api POST "/incidents/$INC_ID/assign" "$QUALITY" "{\"departmentId\": \"$ICU\", \"severity\": 3}" | json "d['data']['status']")" ASSIGNED
api POST "/incidents/$INC_ID/return-to-quality" "$HOD" '{"reason": "x"}' > /dev/null
check "Emergency HOD cannot return an ICU incident" "$(status)" 403
check "ICU HOD returns it" "$(api POST "/incidents/$INC_ID/return-to-quality" "$OTHER_HOD" '{"reason": "Happened on the ward, not in ICU"}' | json "d['data']['status']")" SUBMITTED
api GET "/incidents/$INC_ID" "$OTHER_HOD" > /dev/null
check "ICU HOD can still view it (previously assigned)" "$(status)" 200

echo "=== 6. Quality assigns to Emergency with severity 4 ==="
BODY=$(api POST "/incidents/$INC_ID/assign" "$QUALITY" "{\"departmentId\": \"$EMERGENCY\", \"severity\": 4, \"remarks\": \"Major harm; RCA required\"}")
check "assigned, RCA and CAPA required" "$(echo "$BODY" | json "(d['data']['status'], d['data']['requiresRca'], d['data']['requiresCapa'])")" "('ASSIGNED', True, True)"
check "in Emergency HOD's queue" "$(api GET /incidents/my-department "$HOD" | json "'$INC_ID' in [i['_id'] for i in d['data']]")" True
check "HOD actions" "$(api GET "/incidents/$INC_ID" "$HOD" | json "d['data']['availableActions']")" "['RETURN_TO_QUALITY', 'START_INVESTIGATION']"
api GET "/attachments/$FILE_ID/download" "$HOD" > /dev/null; check "responsible HOD can download the evidence" "$(status)" 200
api POST "/incidents/$INC_ID/investigation" "$OTHER_HOD" > /dev/null
check "ICU HOD can no longer work on it" "$(status)" 403

# ---------- 7. HOD works ----------
echo "=== 7. HOD investigates, writes RCA, completes the investigation ==="
INV_ID=$(api POST "/incidents/$INC_ID/investigation" "$HOD" | json "d['data']['_id']")
check "investigation started" "$(status)" 201
api POST "/investigations/$INV_ID/complete" "$HOD" '{"findings": "Label missing during handover"}' > /dev/null
check "cannot complete before the RCA (severity 4)" "$(status)" 400
api POST "/incidents/$INC_ID/rca" "$HOD" '{
  "method": "FIVE_WHY",
  "fiveWhy": [{"sequence": 1, "question": "Why wrong dose?", "answer": "Label missing"}],
  "rootCauseSummary": "No double check at handover"
}' > /dev/null
check "RCA saved" "$(status)" 200
api POST "/investigations/$INV_ID/complete" "$HOD" '{"findings": "Label missing during handover"}' > /dev/null
check "investigation completed" "$(status)" 200
check "incident moves to CAPA" "$(api GET "/incidents/$INC_ID" "$HOD" | json "d['data']['status']")" CAPA_IN_PROGRESS

echo "=== 8. HOD writes CAPA and submits for review ==="
api POST "/incidents/$INC_ID/capas" "$HOD" '{"type": "CORRECTIVE", "action": "Two-nurse check", "targetDate": "2020-01-01"}' > /dev/null
check "target date in the past is refused" "$(status)" 422
CAPA_ID=$(api POST "/incidents/$INC_ID/capas" "$HOD" "{\"type\": \"CORRECTIVE\", \"action\": \"Two-nurse check on IV antibiotics\", \"targetDate\": \"$TARGET_DATE\"}" | json "d['data']['_id']")
check "CAPA created" "$(status)" 201
check "CAPA edited" "$(api PATCH "/capas/$CAPA_ID" "$HOD" '{"priority": "HIGH"}' | json "d['data']['priority']")" HIGH
api POST "/incidents/$INC_ID/submit-closure" "$HOD" '{"summary": "Done"}' > /dev/null
check "cannot submit with an open CAPA" "$(status)" 400
check "CAPA marked done" "$(api POST "/capas/$CAPA_ID/done" "$HOD" '{"completionRemarks": "Checklist introduced"}' | json "d['data']['status']")" DONE
check "submitted for review" "$(api POST "/incidents/$INC_ID/submit-closure" "$HOD" '{"summary": "RCA and CAPA complete"}' | json "d['data']['status']")" PENDING_QUALITY_REVIEW

# ---------- 9. Quality review ----------
echo "=== 9. Quality sends it back, then accepts ==="
check "in Quality's review queue" "$(api GET /incidents/review-queue "$QUALITY" | json "'$INC_ID' in [i['_id'] for i in d['data']]")" True
api POST "/incidents/$INC_ID/review" "$QUALITY" '{"decision": "ACCEPT", "remarks": "OK", "capaResults": []}' > /dev/null
check "a verdict per CAPA is required" "$(status)" 400
BODY=$(api POST "/incidents/$INC_ID/review" "$QUALITY" "{\"decision\": \"RETURN\", \"remarks\": \"Attach the audit sheet\", \"capaResults\": [{\"capaId\": \"$CAPA_ID\", \"effective\": false}]}")
check "sent back to HOD" "$(echo "$BODY" | json "d['data']['status']")" CAPA_IN_PROGRESS
check "CAPA reopened for the HOD" "$(api GET "/incidents/$INC_ID/capas" "$HOD" | json "d['data'][0]['status']")" OPEN
api POST "/capas/$CAPA_ID/done" "$HOD" '{"completionRemarks": "Audit sheet attached"}' > /dev/null
api POST "/incidents/$INC_ID/submit-closure" "$HOD" '{"summary": "Audit sheet attached"}' > /dev/null
BODY=$(api POST "/incidents/$INC_ID/review" "$QUALITY" "{\"decision\": \"ACCEPT\", \"remarks\": \"CAPA effective; incident closed\", \"capaResults\": [{\"capaId\": \"$CAPA_ID\", \"effective\": true}]}")
check "closed" "$(echo "$BODY" | json "d['data']['status']")" CLOSED
api POST "/incidents/$INC_ID/review" "$QUALITY" '{"decision": "RETURN", "remarks": "again"}' > /dev/null
check "closed is final" "$(status)" 409

echo "=== 10. What the reporter sees at the end ==="
BODY=$(api GET "/incidents/$INC_ID" "$STAFF")
check "status and closure summary" "$(echo "$BODY" | json "(d['data']['status'], d['data']['closureRemarks'])")" "('CLOSED', 'CAPA effective; incident closed')"
check "responsible department shown" "$(echo "$BODY" | json "d['data']['departmentId']['code']")" EMERGENCY
check "no review details or HOD returns" "$(echo "$BODY" | json "'qualityReviews' in d['data'] or 'hodReturns' in d['data'] or 'closureSubmission' in d['data']")" False
api GET "/incidents/$INC_ID/capas" "$STAFF" > /dev/null; check "no CAPA details" "$(status)" 403
check "staff timeline has no names" "$(api GET "/incidents/$INC_ID/timeline" "$STAFF" | json "any(t.get('by') for t in d['data'])")" False
check "staff timeline shows milestones only" "$(api GET "/incidents/$INC_ID/timeline" "$STAFF" | json "[t['action'] for t in d['data']]")" \
  "['SUBMITTED', 'REQUEST_INFO', 'RESPOND_INFO', 'ASSIGN', 'ASSIGN', 'REVIEW_ACCEPT']"
check "full timeline for Quality" "$(api GET "/incidents/$INC_ID/timeline" "$QUALITY" | json "[t['action'] for t in d['data']]")" \
  "['SUBMITTED', 'REQUEST_INFO', 'RESPOND_INFO', 'ASSIGN', 'RETURN_TO_QUALITY', 'ASSIGN', 'START_INVESTIGATION', 'COMPLETE_INVESTIGATION', 'SUBMIT_CLOSURE', 'REVIEW_RETURN', 'SUBMIT_CLOSURE', 'REVIEW_ACCEPT']"

echo "=== 11. Rejection path ==="
INC2_ID=$(api POST /incidents "$STAFF" "{\"incidentDateTime\": \"2026-09-18T11:00:00Z\", \"occurredInDepartmentId\": \"$WARD\", \"locationId\": \"$LOC\", \"categoryId\": \"$CAT\", \"title\": \"Duplicate\", \"description\": \"Same event reported twice\"}" | json "d['data']['_id']")
api POST "/incidents/$INC2_ID/reject" "$QUALITY" '{"reason": " "}' > /dev/null
check "reason is required" "$(status)" 422
api POST "/incidents/$INC2_ID/reject" "$QUALITY" '{"reason": "Duplicate of the earlier report"}' > /dev/null
check "reporter sees the rejection reason" "$(api GET "/incidents/$INC2_ID" "$STAFF" | json "(d['data']['status'], d['data']['rejection']['reason'])")" "('REJECTED', 'Duplicate of the earlier report')"

echo "=== 12. Admin is read-only ==="
check "Admin sees the incident, no actions" "$(api GET "/incidents/$INC_ID" "$ADMIN" | json "d['data']['availableActions']")" "[]"

# ---------- 13. Permission matrix ----------
echo "=== 13. Permission matrix: every endpoint refuses roles it is not meant for ==="
X=000000000000000000000000
# method path allowed-roles(comma separated)
MATRIX=(
  "POST /incidents STAFF"
  "GET /incidents/triage-queue QUALITY"
  "GET /incidents/review-queue QUALITY"
  "GET /incidents/my-department HOD"
  "POST /incidents/$INC2_ID/request-info QUALITY"
  "POST /incidents/$INC2_ID/respond STAFF"
  "POST /incidents/$INC2_ID/reject QUALITY"
  "POST /incidents/$INC2_ID/assign QUALITY"
  "POST /incidents/$INC2_ID/return-to-quality HOD"
  "POST /incidents/$INC2_ID/submit-closure HOD"
  "POST /incidents/$INC2_ID/review QUALITY"
  "POST /incidents/$INC2_ID/investigation HOD"
  "GET /incidents/$INC_ID/investigation QUALITY,HOD,ADMIN"
  "PATCH /investigations/$X HOD"
  "POST /investigations/$X/complete HOD"
  "POST /incidents/$INC2_ID/rca HOD"
  "GET /incidents/$INC_ID/rca QUALITY,HOD,ADMIN"
  "POST /incidents/$INC2_ID/capas HOD"
  "GET /incidents/$INC_ID/capas QUALITY,HOD,ADMIN"
  "GET /capas QUALITY,HOD,ADMIN"
  "PATCH /capas/$X HOD"
  "POST /capas/$X/done HOD"
  "GET /dashboard/overview QUALITY,HOD,ADMIN"
  "GET /reports/capa QUALITY,HOD,ADMIN"
  "GET /reports/incidents QUALITY,HOD,ADMIN"
  "GET /users ADMIN"
  "POST /users ADMIN"
  "POST /users/$X/reset-password ADMIN"
  "GET /roles ADMIN"
  "POST /departments ADMIN"
  "PATCH /departments/$X ADMIN"
  "POST /locations ADMIN"
  "POST /categories ADMIN"
)
declare -A TOKENS=([STAFF]="$STAFF" [QUALITY]="$QUALITY" [HOD]="$HOD" [ADMIN]="$ADMIN")
DENIED=0
for row in "${MATRIX[@]}"; do
  read -r method path allowed <<< "$row"
  for role in STAFF QUALITY HOD ADMIN; do
    if [[ ",$allowed," == *",$role,"* ]]; then continue; fi
    api "$method" "$path" "${TOKENS[$role]}" '{}' > /dev/null
    if [ "$(status)" != "403" ]; then
      echo "  FAIL $role → $method $path returned $(status), expected 403"
      FAILURES=$((FAILURES + 1))
    else
      DENIED=$((DENIED + 1))
    fi
  done
done
echo "  OK   $DENIED role/endpoint combinations refused"

echo "=== 14. Dashboards and reports ==="
for role in QUALITY HOD ADMIN; do
  api GET /dashboard/overview "${TOKENS[$role]}" > /dev/null; check "$role dashboard" "$(status)" 200
  api GET /reports/incidents "${TOKENS[$role]}" > /dev/null; check "$role reports" "$(status)" 200
done
check "Quality dashboard is hospital-wide" "$(api GET /dashboard/overview "$QUALITY" | json "d['data']['scope']")" HOSPITAL
check "HOD dashboard is scoped to the department" "$(api GET /dashboard/overview "$HOD" | json "d['data']['scope']")" DEPARTMENT
check "closed incident counted, with its send-back"   "$(api GET /dashboard/overview "$QUALITY" | json "(d['data']['inPeriod']['closed'] >= 1, d['data']['inPeriod']['rework']['sentBack'] >= 1)")" "(True, True)"
api GET "/dashboard/overview?period=5y" "$QUALITY" > /dev/null; check "unknown period refused" "$(status)" 400
check "register row has departments and turnaround"   "$(api GET /reports/incidents "$QUALITY" | json "[(r['occurredInDepartment'], r['responsibleDepartment'], r['hodReturns'], r['sentBackByQuality'], r['daysToClose'] is not None) for r in d['data'] if r['_id'] == '$INC_ID'][0]")"   "('General Inpatient Wards', 'Emergency Medicine', 1, 1, True)"
api GET "/reports/incidents?status=NOT_A_STATUS" "$QUALITY" > /dev/null; check "invalid register filter refused" "$(status)" 422

echo
if [ "$FAILURES" -gt 0 ]; then
  echo "=== $FAILURES CHECK(S) FAILED ==="
  exit 1
fi
echo "=== ALL CHECKS PASSED ==="
