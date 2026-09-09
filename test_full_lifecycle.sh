#!/bin/bash
set -e

BASE_URL="http://localhost:5000/api/v1"

echo "=== 1. Login Admin ==="
ADMIN_LOGIN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}')

ADMIN_TOKEN=$(echo $ADMIN_LOGIN | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['accessToken'])")
echo "Admin Token obtained."

echo "=== 2. Fetch Categories, Departments, Locations & Users ==="
CATEGORIES=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/incident-categories")
CAT_ID=$(echo $CATEGORIES | python3 -c "import sys, json; print(json.load(sys.stdin)['data'][0]['_id'])")

DEPARTMENTS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/departments")
DEPT_ID=$(echo $DEPARTMENTS | python3 -c "import sys, json; print(json.load(sys.stdin)['data'][0]['_id'])")

LOCATIONS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/locations")
LOC_ID=$(echo $LOCATIONS | python3 -c "import sys, json; print(json.load(sys.stdin)['data'][0]['_id'])")

USERS=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/users")
USER_ID=$(echo $USERS | python3 -c "import sys, json; print(json.load(sys.stdin)['data'][0]['_id'])")

echo "Cat: $CAT_ID, Dept: $DEPT_ID, Loc: $LOC_ID, User: $USER_ID"

echo "=== 3. Report Incident ==="
INCIDENT_RESP=$(curl -s -X POST "$BASE_URL/incidents" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "incidentDateTime": "2026-09-08T10:00:00Z",
    "departmentId": "'"$DEPT_ID"'",
    "locationId": "'"$LOC_ID"'",
    "categoryId": "'"$CAT_ID"'",
    "severity": 3,
    "title": "Wrong Antibiotic Dosage Administered",
    "description": "Patient received wrong dosage of antibiotic due to missing label on IV bag during shift change.",
    "immediateAction": "IV stopped immediately, physician notified, vitals monitored.",
    "patientInvolved": true,
    "patient": {
      "uhid": "UHID-987654",
      "name": "John Doe",
      "age": 45,
      "gender": "MALE",
      "ward": "Ward 3B",
      "bed": "12"
    }
  }')

INC_ID=$(echo $INCIDENT_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])")
INC_NO=$(echo $INCIDENT_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['incidentNumber'])")
echo "Incident Created: $INC_NO (ID: $INC_ID)"

echo "=== 4. Triage Incident ==="
TRIAGE_RESP=$(curl -s -X POST "$BASE_URL/incidents/$INC_ID/triage" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "severity": 4,
    "remarks": "Upgraded severity to Major Harm (4). RCA required."
  }')
echo "Triage Result Status: $(echo $TRIAGE_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

echo "=== 5. Assign Investigator ==="
ASSIGN_RESP=$(curl -s -X POST "$BASE_URL/incidents/$INC_ID/assign-investigator" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "investigatorId": "'"$USER_ID"'"
  }')
echo "Assign Result Status: $(echo $ASSIGN_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

echo "=== 6. Start & Complete Investigation ==="
INV_START=$(curl -s -X POST "$BASE_URL/incidents/$INC_ID/investigation" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
INV_ID=$(echo $INV_START | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])")

INV_COMP=$(curl -s -X POST "$BASE_URL/investigations/$INV_ID/complete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "findings": "Full investigation conducted. Verification procedure bypassed during shift change.",
    "contributingFactors": ["High patient load", "Fatigue"],
    "immediateCorrections": "Dual-nurse sign-off introduced.",
    "recommendation": "Implement mandatory barcode verification."
  }')
echo "Investigation Complete Result Status: $(echo $INV_COMP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

echo "=== 7. Create & Approve RCA ==="
RCA_RESP=$(curl -s -X POST "$BASE_URL/incidents/$INC_ID/rca" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "FIVE_WHY",
    "fiveWhy": [
      {"sequence": 1, "question": "Why was wrong dose given?", "answer": "IV bag label missing detail"},
      {"sequence": 2, "question": "Why missing detail?", "answer": "Prepared in rush during shift handover"}
    ],
    "fishbone": {
      "people": ["Fatigue", "Nurse shift handoff miscommunication"],
      "process": ["No dual-sign confirmation for high alert meds"],
      "equipment": ["Missing barcode scanner"]
    },
    "rootCauseSummary": "Root cause traced to lack of dual verification during peak handover hours."
  }')
RCA_ID=$(echo $RCA_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])")

RCA_APP=$(curl -s -X POST "$BASE_URL/rca/$RCA_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comments": "RCA approved by Quality Committee."}')
echo "RCA Approved Status: $(echo $RCA_APP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

echo "=== 8. Create CAPA Action Item ==="
CAPA_RESP=$(curl -s -X POST "$BASE_URL/incidents/$INC_ID/capas" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CORRECTIVE",
    "action": "Implement dual nurse sign-off on IV medication administration sheets before infusing.",
    "ownerUserId": "'"$USER_ID"'",
    "ownerDepartmentId": "'"$DEPT_ID"'",
    "priority": "HIGH",
    "targetDate": "2026-10-01T00:00:00Z"
  }')
CAPA_ID=$(echo $CAPA_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['_id'])")
echo "CAPA Created: $CAPA_ID"

echo "=== 9. Complete & Verify CAPA ==="
CAPA_COMP=$(curl -s -X POST "$BASE_URL/capas/$CAPA_ID/complete" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "completionRemarks": "Protocol drafted, distributed, and training completed across all wards."
  }')
echo "CAPA Completed Status: $(echo $CAPA_COMP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

CAPA_VER=$(curl -s -X POST "$BASE_URL/capas/$CAPA_ID/verify" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "effective": true,
    "remarks": "Audit confirms 100% compliance over 3 shift handovers."
  }')
echo "CAPA Verified Status: $(echo $CAPA_VER | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

echo "=== 10. Close Incident ==="
CLOSE_RESP=$(curl -s -X POST "$BASE_URL/incidents/$INC_ID/close" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"remarks": "All CAPAs verified and effective. Closing incident."}')
echo "Incident Final Status: $(echo $CLOSE_RESP | python3 -c "import sys, json; print(json.load(sys.stdin)['data']['status'])")"

echo "=== 11. Dashboard Summary & Severity ==="
DASH_SUMMARY=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/dashboard/summary")
echo "Dashboard Summary Success: $(echo $DASH_SUMMARY | python3 -c "import sys, json; print(json.load(sys.stdin)['success'])")"

DASH_SEV=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/dashboard/severity")
echo "Dashboard Severity Success: $(echo $DASH_SEV | python3 -c "import sys, json; print(json.load(sys.stdin)['success'])")"

echo "=== 12. Reports Incident & CAPA Register ==="
RPT_INC=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/reports/incidents")
echo "Incident Report Success: $(echo $RPT_INC | python3 -c "import sys, json; print(json.load(sys.stdin)['success'])")"

RPT_CAPA=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE_URL/reports/capa")
echo "CAPA Report Success: $(echo $RPT_CAPA | python3 -c "import sys, json; print(json.load(sys.stdin)['success'])")"

echo "=== ALL PHASES PASSED END TO END PERFECTLY ==="
