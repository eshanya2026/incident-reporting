# Incident Reporting Application: Likelihood, Severity, and Risk Scoring

**Document type:** Functional and configuration specification  
**Purpose:** Define a consistent, auditable method for classifying incident likelihood and severity in the hospital incident reporting application.  
**Status:** Proposed sample logic for Quality/Patient Safety Committee approval before production use.

> **Governance note:** NABH expects hospitals to identify, report, review, and act on incidents and risks. The exact likelihood frequency bands, severity descriptors, risk bands, and escalation rules below are a proposed local model. They must be aligned with the hospital's approved policy and current NABH requirements. Do not label these numeric cutoffs as universal NABH-mandated values.

## 1. Core scoring model

For a prospective risk or an incident's potential risk rating, calculate:

```text
Risk Score = Likelihood Score × Severity Score
```

Both inputs are integers from **1 to 5**, giving a total score from **1 to 25**. The score prioritizes review and action; it does not replace incident classification, mandatory reporting, clinical response, investigation, or escalation required by hospital policy.

The application should keep these concepts distinct:

- **Actual harm:** What happened to the patient, staff member, visitor, or service in this event.
- **Potential severity:** The credible consequence if the same event or hazard occurs again, or if it had not been intercepted.
- **Likelihood:** How often the event or hazard is occurring or is reasonably expected to occur, based on a defined reference period and available evidence.
- **Initial risk:** Rating before new corrective actions are implemented.
- **Residual risk:** Rating after actions are completed and their effectiveness is reviewed.

A near miss can have no actual harm and still have high potential severity and a high risk score.

## 2. Likelihood scale

Use the previous **12 months** as the default evidence window, unless the hospital approves another period. Consider incident and near-miss reports, audit findings, exposure volume, process changes, staffing/workload, and existing controls. A lack of reports alone is not evidence that a risk is rare.

The frequency examples below are guidance for consistent scoring, not fixed NABH thresholds. Departments should interpret frequency in proportion to exposure (for example, doses administered, procedures performed, or patient-days).

| Score | Category | Suggested interpretation | Suggested evidence |
|---:|---|---|---|
| 1 | Rare | Not known to have occurred locally, or possible only in exceptional circumstances | No known local occurrence in the reference period; robust controls; event remains credible |
| 2 | Unlikely | Could occur, but is not expected in normal operations; has occurred very rarely | Isolated occurrence or credible external/near-miss evidence |
| 3 | Possible | Could occur sometimes under foreseeable working conditions | Occasional local examples, near misses, audit findings, or control gaps |
| 4 | Likely | Recurs or is expected to recur without further action | Repeated local occurrences or persistent process weakness |
| 5 | Almost certain / Frequent | Recurs frequently or is expected in the current process | Frequent occurrences, repeated failures, or a known uncontrolled condition |

### Likelihood selection rules

1. Identify the event/hazard being rated precisely. Avoid scoring a broad category such as “medication issue.” Use a defined event such as “delayed administration of time-critical medication due to unavailable stock.”
2. Record the reference period and exposure denominator when available.
3. Use the frequency of the **event or hazard**, not only the frequency of harm. If harm is rare but the unsafe condition occurs often, rate likelihood using the unsafe condition recurrence and separately rate severity for its credible consequence.
4. Consider whether controls are actually used and effective, not merely documented.
5. If local evidence is limited, record the uncertainty and use a documented multidisciplinary judgment. Do not automatically assign 1.
6. The application should allow a short rationale and optional supporting counts/data.

## 3. Severity scale

Select the most serious **credible** consequence relevant to the event, using approved hospital harm definitions. Avoid both under-rating and implausible worst-case speculation.

| Score | Category | Patient harm guide | Other impact guide (where configured) |
|---:|---|---|---|
| 1 | Insignificant | No injury or harm; no treatment required | Negligible service, staff, property, or information impact |
| 2 | Minor | Temporary minor harm; minimal treatment or observation | Small, localized disruption or low-level impact |
| 3 | Moderate | Harm requiring additional treatment/intervention, or prolonging care | Meaningful localized disruption; management action required |
| 4 | Major | Serious temporary harm, major intervention, significant prolonged stay, or permanent impairment | Major service interruption, substantial staff impact, or significant data/property impact |
| 5 | Catastrophic | Death, life-threatening harm, or multiple people suffering severe harm | Critical service failure or other consequence defined as catastrophic in hospital policy |

### Severity selection rules

- Store **actual harm classification** separately from **potential severity score**.
- For an event that caused harm, actual harm is classified according to the hospital's incident policy; the risk matrix may still rate future risk.
- For a near miss, actual harm is “none,” while potential severity may be 1–5.
- Where several people or domains are affected, score each relevant domain or use the highest credible severity per approved policy. Do not silently average severities.
- The app should capture the selected severity descriptor and a rationale, especially for scores 4–5.

## 4. Risk score bands and response

The following banding is an **illustrative default for configuration review**. The hospital must approve the final boundaries, response times, owners, and escalation route. Keep thresholds configurable rather than hard-coded.

| Score | Sample band | Suggested minimum response |
|---:|---|---|
| 1–4 | Low | Record; maintain controls; monitor for recurrence and trends |
| 5–9 | Moderate | Department review; assign an owner; decide and document any additional controls |
| 10–16 | High | Prompt action plan; notify/escalate to HOD and Quality/Patient Safety team; track completion and effectiveness |
| 17–25 | Extreme | Immediate escalation under hospital policy; implement urgent controls; initiate prompt review and senior oversight |

**Safety override:** A score must never delay urgent clinical care, immediate containment, or mandatory escalation. Any event meeting defined sentinel, serious harm, death, statutory, or other hospital escalation criteria must follow that pathway regardless of its calculated score.

## 5. Calculation examples

### Example 1: Repeated delay with usually minor impact

- Likelihood: 4 (Likely)
- Severity: 2 (Minor)
- Calculation: `4 × 2 = 8`
- Sample band: Moderate
- Record: event evidence, immediate containment if needed, assigned owner, action and review date.

### Example 2: Rare wrong-patient procedure risk with catastrophic potential

- Likelihood: 2 (Unlikely)
- Severity: 5 (Catastrophic)
- Calculation: `2 × 5 = 10`
- Sample band: High
- The low likelihood does not erase the serious potential consequence; the issue receives active review.

### Example 3: Frequent low-impact near miss

- Likelihood: 5 (Almost certain/Frequent)
- Severity: 1 (Insignificant actual outcome; choose potential severity based on credible consequence)
- If potential severity is 2: `5 × 2 = 10` (High)
- If potential severity is truly 1: `5 × 1 = 5` (Moderate)
- Repeated near misses should be reviewed for system causes even when the actual outcome is harmless.

## 6. Initial and residual risk

The application should support separate, dated assessments:

```text
Initial Risk Score  = Initial Likelihood × Initial Severity
Residual Risk Score = Residual Likelihood × Residual Severity
```

- Calculate initial risk before newly planned actions are marked complete.
- After implementation, reassess likelihood and severity based on evidence that controls work.
- Severity may remain unchanged if the consequence is still possible; controls often reduce likelihood, but the assessor must judge both axes independently.
- Do not automatically reduce a score merely because an action was assigned or completed. Verify effectiveness and document evidence.
- Preserve each assessment in the audit history; do not overwrite the initial rating.

## 7. Application requirements

### Data fields

| Field | Type / values | Required behavior |
|---|---|---|
| Event description | Text | Required; describe what happened or what hazard is being assessed |
| Event type | Configurable category | Use the application's approved incident categories |
| Actual harm status | None / near miss / harm / other approved values | Separate from risk score |
| Actual harm classification | Approved local scale | Required when harm occurred; separate from potential severity |
| Likelihood score | Integer 1–5 | Required for a risk assessment |
| Likelihood category | Derived from score | Display label from configured scale |
| Reference period | Date range / default 12 months | Show the period used in the assessment |
| Evidence / exposure | Optional structured counts and rationale | Capture counts, denominator, audits, near misses, and uncertainty as applicable |
| Severity score | Integer 1–5 | Required for a risk assessment |
| Severity category | Derived from score | Display label from configured scale |
| Severity rationale | Text | Required for scores 4–5; recommended for all scores |
| Initial risk score and band | Derived | Read-only; save assessment timestamp and assessor |
| Actions | Description, owner, due date, status, evidence | Track corrective/preventive actions |
| Residual likelihood/severity | Integer 1–5 | Enter after action effectiveness review |
| Residual score and band | Derived | Read-only; preserve with assessment history |
| Escalation flags | Configurable criteria | Trigger independently of numeric score when required by policy |

### Calculation and validation

```pseudo
assert likelihood in [1, 2, 3, 4, 5]
assert severity in [1, 2, 3, 4, 5]
riskScore = likelihood * severity
riskBand = configuredBandFor(riskScore)
```

- Do not allow zero, negative, fractional, or out-of-range scores.
- Calculate score and band on the server as well as in the UI; do not trust client-submitted derived values.
- Store the selected scale/configuration version with each assessment so historical scores remain interpretable after configuration updates.
- Keep score and band read-only to users; allow authorized reassessment through a new versioned assessment.
- Record assessor, timestamp, changes, rationale, action plan, and approval/escalation events in the audit trail.
- If a scale or threshold changes, apply it prospectively unless an authorized, documented re-rating is performed. Do not silently recalculate historical records.
- Make likelihood descriptors, severity descriptors, risk bands, and escalation mappings configurable by an authorized administrator with versioning and approval history.

## 8. Suggested workflow

1. Staff submits the incident or near miss and selects the event category.
2. Staff records the facts and any immediate actions taken. The system supports urgent reporting without requiring risk scoring first.
3. Quality/authorized reviewer confirms actual harm classification and assesses likelihood and potential severity using the approved definitions.
4. The system calculates the risk score and band and shows the required response/escalation guidance.
5. Reviewer assigns an investigation/action owner, due date, and action plan appropriate to the event and policy.
6. HOD/Quality tracks actions and records evidence of completion.
7. An authorized reviewer checks effectiveness and records residual likelihood, severity, score, and band.
8. Quality reviews trends by category, department, score, actual harm, recurrence, and action status.

## 9. Reporting and governance

Reports should distinguish and filter by:

- Actual harm classification versus potential risk band
- Initial risk versus residual risk
- Incident versus near miss
- Likelihood and severity component scores
- Department, category, date, recurrence, and action status
- Events that triggered policy-based escalation regardless of score

The Quality/Patient Safety Committee should approve the scoring policy, review it periodically, train users, monitor inter-rater consistency, and define escalation/service-level requirements. Use calibration cases so different departments apply the descriptors consistently.

## 10. Important limitations

A multiplication matrix is a prioritization aid, not a precise prediction of probability or harm. Different likelihood/severity combinations can produce the same score. Use clinical judgment, event facts, escalation rules, and trend analysis alongside the number. Never use a low numeric result to dismiss a serious event or override mandatory reporting requirements.

## 11. Approval checklist before production

- [ ] Confirm the current applicable NABH standards and hospital policy requirements.
- [ ] Approve likelihood categories, reference period, frequency guidance, and exposure denominators.
- [ ] Approve severity definitions for patients and any other impact domains in scope.
- [ ] Approve risk band boundaries, colors, response times, and escalation owners.
- [ ] Define mandatory/sentinel/serious-harm overrides independent of score.
- [ ] Approve role permissions for assessment, reassessment, closure, and configuration changes.
- [ ] Approve audit history, retention, reports, and configuration versioning.
- [ ] Train staff and calibrate scoring using representative incident scenarios.

---

**Implementation note:** Treat the tables in this document as proposed defaults until formally approved. Map approved hospital policy values into configuration before enabling automated risk-band decisions.
