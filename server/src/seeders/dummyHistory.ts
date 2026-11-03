// A year of demo incident history (~220 incidents) on top of the hand-written demo cases in
// dummyData.ts, so the dashboard, reports and AI Insights show real trends. Deterministic: the same
// pseudo-random seed always produces the same incidents, so re-seeding updates them in place.
//
// Locations are only the hospital's own wards (passed in from the database), matched to the
// responsible department where possible.

import type { IncidentStatus } from '../modules/incidents/incident.model.js';
import type { CapaPriority, CapaType } from '../modules/capa/capa.model.js';

export const HISTORY_COUNT = 220;

type Dept = 'EMERGENCY' | 'ICU' | 'OT' | 'WARD' | 'PHARMACY' | 'RADIOLOGY' | 'LAB' | 'QUALITY';
type Affected = 'INPATIENT' | 'OUTPATIENT' | 'VISITOR_FAMILY' | 'EMPLOYEE' | 'OTHER';

interface Template {
  category: string;
  sub: string;
  depts: Dept[];
  affected: Affected;
  /** Relative weights for severity 1..5. */
  sev: [number, number, number, number, number];
  /** How common this type is relative to the others. */
  weight: number;
  titles: string[];
  description: string;
  action: string;
  factors: string[];
  findings: string;
  rootCause: string;
  whys: Array<[string, string]>;
  capas: Array<[CapaType, string]>;
}

const T: Template[] = [
  {
    category: 'PATIENT_FALL_AND_ACCIDENTAL_INJURY', sub: 'FALL_FROM_BED', depts: ['WARD', 'ICU'], affected: 'INPATIENT', sev: [3, 5, 3, 0.4, 0], weight: 9,
    titles: ['Patient found on floor beside bed at night', 'Elderly patient fell from bed during night shift', 'Post-operative patient slid off bed while reaching for water'],
    description: 'Patient was found on the floor beside the bed during the night round. Bed rails were found lowered and the call bell was out of reach. Patient was assessed by the duty doctor.',
    action: 'Patient assessed by duty doctor, vitals checked, X-ray arranged where needed, bed lowered and rails raised, relatives informed.',
    factors: ['Bed rails lowered', 'Call bell out of reach', 'Fall-risk score not updated'],
    findings: 'Fall-risk reassessment was not repeated after sedation was started; night hourly rounding was missed during a busy admission.',
    rootCause: 'No trigger to repeat the fall-risk assessment after a change in condition or medication.',
    whys: [['Why did the patient fall?', 'Got out of bed unassisted'], ['Why unassisted?', 'Call bell out of reach and rails down'], ['Why not noticed?', 'Hourly rounding missed during admissions']],
    capas: [['CORRECTIVE', 'Re-educate ward nurses on fall-risk reassessment after sedation or condition change'], ['PREVENTIVE', 'Add fall-risk reassessment prompt to the nursing shift checklist']],
  },
  {
    category: 'PATIENT_FALL_AND_ACCIDENTAL_INJURY', sub: 'FALL_IN_TOILET_OR_BATHROOM', depts: ['WARD'], affected: 'INPATIENT', sev: [2, 5, 3, 0.3, 0], weight: 5,
    titles: ['Patient slipped in ward bathroom', 'Patient fell in toilet while unaccompanied'],
    description: 'Patient slipped on the wet bathroom floor while unaccompanied. Sustained a minor bruise on the forearm.',
    action: 'First aid given, doctor reviewed, floor dried and wet-floor sign placed, attendant advised to accompany patient.',
    factors: ['Wet floor', 'No grab bar near toilet', 'Patient unaccompanied'],
    findings: 'Bathroom floor mopped during visiting hours without a wet-floor sign; grab bar on one side was loose.',
    rootCause: 'Housekeeping schedule overlaps peak patient-use hours and grab bars are not on the maintenance checklist.',
    whys: [['Why did the patient slip?', 'Floor was wet'], ['Why was it wet?', 'Mopped during peak use without a sign'], ['Why then?', 'Cleaning schedule not aligned with ward routine']],
    capas: [['CORRECTIVE', 'Fix loose grab bars in ward bathrooms'], ['PREVENTIVE', 'Reschedule bathroom mopping outside peak hours and mandate wet-floor signs']],
  },
  {
    category: 'PATIENT_FALL_AND_ACCIDENTAL_INJURY', sub: 'FALL_DURING_TRANSFER', depts: ['EMERGENCY', 'RADIOLOGY', 'OT'], affected: 'INPATIENT', sev: [3, 4, 2, 0.3, 0], weight: 4,
    titles: ['Patient slipped during trolley-to-bed transfer', 'Patient lost balance during transfer to scan table'],
    description: 'During transfer from trolley the patient lost balance; staff broke the fall. Only one staff member was assisting.',
    action: 'Patient assessed, no visible injury, transfer completed with slide sheet and two staff.',
    factors: ['Single-person transfer', 'No slide sheet', 'Trolley brake not applied'],
    findings: 'Two-person transfer rule was not followed because the second staff member was attending another patient.',
    rootCause: 'Transfer policy does not define what to do when a second staff member is unavailable.',
    whys: [['Why did the patient lose balance?', 'Unsupported transfer'], ['Why unsupported?', 'Only one staff member'], ['Why one?', 'No escalation route for a second helper']],
    capas: [['CORRECTIVE', 'Provide slide sheets at all transfer points'], ['PREVENTIVE', 'Update transfer policy: wait or call porter when a second helper is unavailable']],
  },
  {
    category: 'MEDICATION_ERROR', sub: 'WRONG_DOSE_OR_STRENGTH', depts: ['WARD', 'ICU', 'PHARMACY'], affected: 'INPATIENT', sev: [5, 4, 2, 0.3, 0.1], weight: 8,
    titles: ['Wrong strength of tablet dispensed and caught at bedside', 'Insulin dose prepared at wrong strength', 'Paediatric syrup dose calculated incorrectly'],
    description: 'The dose prepared did not match the prescription. The discrepancy was noticed during the bedside double-check before administration.',
    action: 'Dose withheld, prescriber informed, correct dose prepared and given, patient monitored.',
    factors: ['Look-alike packaging', 'Interruption during preparation', 'No independent double-check'],
    findings: 'Two strengths of the same medicine were stored side by side; preparation was interrupted by a phone call.',
    rootCause: 'Look-alike strengths stored together without tall-man labelling or separation.',
    whys: [['Why the wrong strength?', 'Picked from adjacent bin'], ['Why adjacent?', 'Both strengths stored together'], ['Why not caught earlier?', 'No independent check at preparation']],
    capas: [['CORRECTIVE', 'Separate look-alike strengths and apply tall-man labels'], ['PREVENTIVE', 'Introduce independent double-check for high-alert medicines']],
  },
  {
    category: 'MEDICATION_ERROR', sub: 'OMITTED_OR_MISSED_DOSE', depts: ['WARD', 'ICU'], affected: 'INPATIENT', sev: [3, 5, 2, 0.2, 0], weight: 6,
    titles: ['Scheduled antibiotic dose missed', 'Evening dose not given after ward transfer'],
    description: 'A scheduled dose was not given at the due time. It was identified at the next medication round.',
    action: 'Prescriber informed, dose given as advised, patient monitored.',
    factors: ['Ward transfer', 'Medication chart not handed over', 'Busy shift'],
    findings: 'The dose fell due during transfer between wards and the medication chart was not reviewed at handover.',
    rootCause: 'Transfer handover does not include a review of doses due in the next 4 hours.',
    whys: [['Why was it missed?', 'Not on the receiving nurse\'s list'], ['Why?', 'Chart not reviewed at handover'], ['Why?', 'Handover tool has no "doses due" section']],
    capas: [['CORRECTIVE', 'Counsel staff involved and audit medication charts after transfer'], ['PREVENTIVE', 'Add "doses due in next 4 hours" to the transfer handover form']],
  },
  {
    category: 'MEDICATION_ERROR', sub: 'WRONG_MEDICINE', depts: ['PHARMACY', 'WARD'], affected: 'INPATIENT', sev: [4, 3, 2, 0.4, 0.1], weight: 5,
    titles: ['Look-alike medicine dispensed instead of prescribed drug', 'Wrong medicine issued from pharmacy counter'],
    description: 'A look-alike medicine was dispensed instead of the prescribed one. It was noticed by the ward nurse before administration.',
    action: 'Medicine returned to pharmacy, correct medicine issued, prescriber informed.',
    factors: ['Look-alike sound-alike names', 'Dispensing rush', 'Similar packaging'],
    findings: 'Both medicines are stored alphabetically next to each other and the pharmacist was covering two counters.',
    rootCause: 'LASA medicines are not physically separated in the dispensing area.',
    whys: [['Why the wrong medicine?', 'Picked the adjacent LASA item'], ['Why adjacent?', 'Alphabetical storage'], ['Why not checked?', 'Single pharmacist covering two counters']],
    capas: [['CORRECTIVE', 'Physically separate LASA medicines and add warning shelf labels'], ['PREVENTIVE', 'Barcode scan at dispensing for high-risk medicines']],
  },
  {
    category: 'ADVERSE_DRUG_REACTION', sub: 'ALLERGIC_REACTION', depts: ['WARD', 'EMERGENCY'], affected: 'INPATIENT', sev: [0.5, 3, 4, 0.5, 0.1], weight: 4,
    titles: ['Rash and itching after IV antibiotic', 'Allergic reaction after first dose of antibiotic'],
    description: 'Patient developed rash and itching within 20 minutes of the IV antibiotic. Allergy history had not been documented on admission.',
    action: 'Infusion stopped, antihistamine given as per doctor, allergy band applied, pharmacovigilance form filled.',
    factors: ['Allergy history not documented', 'No test dose'],
    findings: 'Allergy history field was left blank on the admission sheet.',
    rootCause: 'Allergy status is not a mandatory field before the first medication order.',
    whys: [['Why the reaction?', 'Known allergy not recorded'], ['Why not recorded?', 'Field optional on admission'], ['Why optional?', 'Form not updated']],
    capas: [['CORRECTIVE', 'Make allergy status mandatory on the admission form'], ['PREVENTIVE', 'Pharmacist to verify allergy status before first antibiotic dose']],
  },
  {
    category: 'PATIENT_IDENTIFICATION', sub: 'MISSING_OR_INCORRECT_IDENTIFICATION_BAND', depts: ['EMERGENCY', 'WARD'], affected: 'INPATIENT', sev: [6, 3, 0.5, 0, 0], weight: 6,
    titles: ['Patient without identification band during procedure', 'ID band with wrong spelling of name'],
    description: 'Patient was found without an identification band (or with incorrect details) during a routine check before a procedure.',
    action: 'New ID band printed and applied after verifying two identifiers with the patient and relative.',
    factors: ['Band removed for IV access', 'Not reapplied', 'Registration spelling error'],
    findings: 'Band was cut for IV cannulation and not reapplied; no check at shift handover.',
    rootCause: 'Band reapplication is not part of the cannulation procedure.',
    whys: [['Why no band?', 'Removed for IV access'], ['Why not reapplied?', 'Not part of procedure'], ['Why not noticed?', 'No ID check at handover']],
    capas: [['CORRECTIVE', 'Add ID band reapplication step to the cannulation procedure'], ['PREVENTIVE', 'ID band check included in shift handover']],
  },
  {
    category: 'LABORATORY_AND_PATHOLOGY', sub: 'MISSING_OR_INCORRECT_SPECIMEN_LABEL', depts: ['LAB', 'WARD'], affected: 'INPATIENT', sev: [6, 3, 0.5, 0, 0], weight: 7,
    titles: ['Blood sample received without label', 'Specimen label did not match request form', 'Unlabelled urine sample received in lab'],
    description: 'Specimen reached the laboratory without a label / with details not matching the request form. The sample was rejected and recollection requested.',
    action: 'Sample rejected, ward informed, recollection done with labelling at bedside.',
    factors: ['Labels printed in advance', 'Batch collection', 'Labelling away from bedside'],
    findings: 'Samples were collected in a batch and labelled at the nursing station instead of at the bedside.',
    rootCause: 'Bedside labelling is not enforced; label printers are only at the nursing station.',
    whys: [['Why mislabelled?', 'Labelled away from bedside'], ['Why?', 'Printer only at nursing station'], ['Why accepted practice?', 'No audit of collection practice']],
    capas: [['CORRECTIVE', 'Reinforce bedside labelling during phlebotomy rounds'], ['PREVENTIVE', 'Monthly specimen rejection audit shared with ward in-charges']],
  },
  {
    category: 'LABORATORY_AND_PATHOLOGY', sub: 'SPECIMEN_LOST_OR_DAMAGED', depts: ['LAB'], affected: 'INPATIENT', sev: [3, 5, 1, 0, 0], weight: 3,
    titles: ['Blood sample tube broken in transit', 'Specimen lost between ward and lab'],
    description: 'The specimen did not reach the laboratory intact and had to be recollected, delaying the report.',
    action: 'Recollection arranged, ward and consultant informed of the delay.',
    factors: ['No transport box', 'No handover record'],
    findings: 'Samples were carried by hand without a closed transport container or handover register.',
    rootCause: 'No standard specimen transport container or tracking log.',
    whys: [['Why lost?', 'Carried by hand'], ['Why by hand?', 'No transport box on the ward'], ['Why not traced?', 'No handover register']],
    capas: [['CORRECTIVE', 'Provide closed specimen transport boxes to all wards'], ['PREVENTIVE', 'Introduce specimen handover register between ward and lab']],
  },
  {
    category: 'DIAGNOSIS_AND_ASSESSMENT', sub: 'FAILURE_TO_REVIEW_ABNORMAL_RESULT', depts: ['LAB', 'WARD', 'EMERGENCY'], affected: 'INPATIENT', sev: [1, 3, 4, 0.6, 0.1], weight: 4,
    titles: ['Critical potassium value not communicated in time', 'Abnormal result not reviewed for several hours'],
    description: 'A critical laboratory value was reported but not acted upon for several hours.',
    action: 'Doctor informed, correction started, patient monitored closely.',
    factors: ['Critical value phoned to wrong extension', 'No read-back', 'Shift change'],
    findings: 'The critical value was phoned to the nursing station during shift change without read-back documentation.',
    rootCause: 'Critical result communication has no read-back and escalation step.',
    whys: [['Why the delay?', 'Result not passed to the doctor'], ['Why?', 'Received during shift change'], ['Why not escalated?', 'No read-back or escalation rule']],
    capas: [['CORRECTIVE', 'Critical values to be communicated directly to the treating doctor with read-back'], ['PREVENTIVE', 'Escalate unacknowledged critical values to the duty consultant after 30 minutes']],
  },
  {
    category: 'DELAYED_OR_OMITTED_CARE', sub: 'TREATMENT_DELAYED', depts: ['EMERGENCY'], affected: 'INPATIENT', sev: [1, 3, 3, 0.6, 0.2], weight: 5,
    titles: ['Delay in starting treatment for chest pain patient', 'Delayed antibiotics in suspected sepsis'],
    description: 'Time from arrival to treatment exceeded the department target during a busy period.',
    action: 'Treatment started, consultant informed, case reviewed.',
    factors: ['Crowding', 'Triage delay', 'Bed unavailability'],
    findings: 'Triage was delayed during a surge of trauma cases; the patient waited without re-triage.',
    rootCause: 'No re-triage of waiting patients during surges.',
    whys: [['Why delayed?', 'Waited for doctor review'], ['Why?', 'Surge of trauma cases'], ['Why not prioritised?', 'No re-triage during surges']],
    capas: [['CORRECTIVE', 'Re-triage every 30 minutes for waiting patients during surges'], ['PREVENTIVE', 'Surge escalation plan with on-call doctor activation']],
  },
  {
    category: 'MONITORING_AND_EMERGENCY_RESPONSE', sub: 'ABNORMAL_VITAL_SIGN_NOT_ESCALATED', depts: ['WARD', 'ICU'], affected: 'INPATIENT', sev: [1, 3, 4, 0.8, 0.2], weight: 4,
    titles: ['Rising early warning score not escalated', 'Low oxygen saturation not escalated promptly'],
    description: 'The patient\'s early warning score rose over several hours without escalation to the doctor.',
    action: 'Rapid response called, patient stabilised and shifted for higher care.',
    factors: ['EWS not calculated', 'Workload', 'Escalation unclear'],
    findings: 'Vitals were recorded but the early warning score was not totalled; escalation thresholds were unclear to new staff.',
    rootCause: 'Manual EWS calculation and no clear escalation chart at the bedside.',
    whys: [['Why not escalated?', 'Score not calculated'], ['Why?', 'Manual calculation skipped under workload'], ['Why unclear?', 'No bedside escalation chart']],
    capas: [['CORRECTIVE', 'Display EWS escalation chart at every bedside'], ['PREVENTIVE', 'Train new staff on EWS and rapid response activation']],
  },
  {
    category: 'SURGERY_AND_INVASIVE_PROCEDURE', sub: 'SURGICAL_COUNT_DISCREPANCY', depts: ['OT'], affected: 'INPATIENT', sev: [4, 3, 1, 0.3, 0.1], weight: 3,
    titles: ['Swab count discrepancy before closure', 'Instrument count mismatch at end of surgery'],
    description: 'The closing count did not match the opening count. The missing item was found after a search before wound closure.',
    action: 'Closure paused, item located in the drape, count reconciled and documented.',
    factors: ['Staff change mid-procedure', 'Count not documented at handover'],
    findings: 'The scrub nurse changed mid-procedure without a documented count handover.',
    rootCause: 'No count handover when scrub staff change during surgery.',
    whys: [['Why the mismatch?', 'Item not recorded'], ['Why?', 'Staff changed mid-procedure'], ['Why no record?', 'No count handover step']],
    capas: [['CORRECTIVE', 'Mandatory count handover when scrub staff change'], ['PREVENTIVE', 'Whiteboard count tracking in every OT']],
  },
  {
    category: 'SURGERY_AND_INVASIVE_PROCEDURE', sub: 'WRONG_BODY_SITE_OR_SIDE', depts: ['OT'], affected: 'INPATIENT', sev: [3, 1, 0.5, 0.3, 0.3], weight: 1.5,
    titles: ['Site marking missing before limb surgery', 'Wrong side prepared, caught at time-out'],
    description: 'The surgical site was not marked / the wrong side was prepared. Caught during the surgical safety time-out before incision.',
    action: 'Procedure paused, correct site confirmed with consent and imaging, site marked, time-out repeated.',
    factors: ['Site not marked in ward', 'Time-out rushed'],
    findings: 'Site marking was not done in the pre-op area because the surgeon was in another theatre.',
    rootCause: 'Patients can be shifted into OT without a completed site-marking check.',
    whys: [['Why the wrong side?', 'No site marking'], ['Why?', 'Surgeon unavailable pre-op'], ['Why shifted?', 'No hard stop at OT reception']],
    capas: [['CORRECTIVE', 'Hard stop at OT reception for unmarked sites'], ['PREVENTIVE', 'Audit of surgical safety checklist compliance']],
  },
  {
    category: 'ANAESTHESIA_AND_SEDATION', sub: 'DIFFICULT_OR_FAILED_AIRWAY', depts: ['OT', 'ICU'], affected: 'INPATIENT', sev: [1, 3, 3, 0.4, 0.1], weight: 2,
    titles: ['Unanticipated difficult airway during induction', 'Difficult intubation with desaturation'],
    description: 'Unanticipated difficult airway during induction with brief desaturation; secured with video laryngoscope.',
    action: 'Airway secured, patient stabilised, difficult airway alert documented.',
    factors: ['Airway assessment incomplete', 'Video laryngoscope not in room'],
    findings: 'The difficult airway cart was in another theatre; pre-op airway assessment was brief.',
    rootCause: 'Only one difficult airway cart for the OT complex.',
    whys: [['Why the desaturation?', 'Delay securing airway'], ['Why?', 'Equipment not in room'], ['Why?', 'Single shared cart']],
    capas: [['CORRECTIVE', 'Procure a second difficult airway cart'], ['PREVENTIVE', 'Structured airway assessment in pre-anaesthesia check']],
  },
  {
    category: 'BLOOD_AND_BLOOD_PRODUCTS', sub: 'SUSPECTED_TRANSFUSION_REACTION', depts: ['LAB', 'WARD', 'ICU'], affected: 'INPATIENT', sev: [0.5, 2, 4, 0.5, 0.2], weight: 3,
    titles: ['Febrile reaction during blood transfusion', 'Chills and rigors during platelet transfusion'],
    description: 'Patient developed fever and chills during transfusion. Transfusion was stopped and the reaction protocol followed.',
    action: 'Transfusion stopped, unit and samples sent to blood bank, symptomatic treatment given.',
    factors: ['Observation interval not followed'],
    findings: 'Observations were due at 15 minutes but recorded at 40 minutes.',
    rootCause: 'Transfusion observation schedule is not visible at the bedside.',
    whys: [['Why late recognition?', 'Observations delayed'], ['Why?', 'Nurse attending another patient'], ['Why no reminder?', 'No bedside observation chart']],
    capas: [['CORRECTIVE', 'Bedside transfusion observation chart with timed checks'], ['PREVENTIVE', 'Transfusion safety refresher for ward nurses']],
  },
  {
    category: 'HEALTHCARE_ASSOCIATED_INFECTION', sub: 'CATHETER_ASSOCIATED_URINARY_TRACT_INFECTION', depts: ['ICU', 'WARD'], affected: 'INPATIENT', sev: [0.2, 2, 5, 0.3, 0], weight: 4,
    titles: ['Catheter-associated urinary infection identified', 'CAUTI in long-stay patient'],
    description: 'Urinary tract infection identified in a catheterised patient beyond 48 hours of admission.',
    action: 'Catheter reviewed and changed, culture-guided antibiotics started.',
    factors: ['Catheter kept longer than needed', 'Daily review not done'],
    findings: 'The catheter remained in place 4 days after it was no longer clinically needed.',
    rootCause: 'No daily catheter necessity review.',
    whys: [['Why the infection?', 'Prolonged catheter use'], ['Why prolonged?', 'Not reviewed daily'], ['Why?', 'No prompt in rounds']],
    capas: [['CORRECTIVE', 'Daily catheter necessity review on ward rounds'], ['PREVENTIVE', 'Nurse-led catheter removal protocol']],
  },
  {
    category: 'LINES_TUBES_DRAINS_AND_CATHETERS', sub: 'IV_INFILTRATION_OR_EXTRAVASATION', depts: ['WARD', 'ICU'], affected: 'INPATIENT', sev: [2, 5, 2, 0.1, 0], weight: 4,
    titles: ['IV line infiltration with swelling of forearm', 'Extravasation noticed at cannula site'],
    description: 'Swelling and pain at the cannula site noticed; infusion had infiltrated the tissue.',
    action: 'Infusion stopped, cannula removed, limb elevated, site monitored.',
    factors: ['Site not checked hourly', 'Cannula in joint area'],
    findings: 'VIP score was not documented for 6 hours.',
    rootCause: 'Cannula site checks are not part of hourly rounding.',
    whys: [['Why infiltration unnoticed?', 'Site not checked'], ['Why?', 'Not in hourly rounding'], ['Why?', 'No VIP score chart']],
    capas: [['CORRECTIVE', 'Introduce VIP score chart for all cannulated patients'], ['PREVENTIVE', 'Include cannula site check in hourly rounding']],
  },
  {
    category: 'ICU_AND_CRITICAL_CARE', sub: 'UNPLANNED_EXTUBATION', depts: ['ICU'], affected: 'INPATIENT', sev: [1, 3, 3, 0.4, 0.1], weight: 3,
    titles: ['Self-extubation by agitated patient', 'Accidental extubation during repositioning'],
    description: 'Endotracheal tube was dislodged. Patient was reintubated / managed on non-invasive support.',
    action: 'Airway secured, patient stabilised, sedation reviewed.',
    factors: ['Agitation', 'Tube not secured', 'Sedation hold'],
    findings: 'Sedation was paused without restraint assessment and the tube tape was loose.',
    rootCause: 'No agitation-risk check before sedation holds.',
    whys: [['Why dislodged?', 'Patient pulled the tube'], ['Why?', 'Agitated during sedation hold'], ['Why unprotected?', 'No risk check before hold']],
    capas: [['CORRECTIVE', 'Tube securing device for all intubated patients'], ['PREVENTIVE', 'Agitation-risk checklist before sedation holds']],
  },
  {
    category: 'RADIOLOGY_AND_IMAGING', sub: 'CONTRAST_REACTION', depts: ['RADIOLOGY'], affected: 'OUTPATIENT', sev: [1, 4, 3, 0.2, 0], weight: 3,
    titles: ['Mild contrast reaction during CT scan', 'Urticaria after IV contrast injection'],
    description: 'Patient developed urticaria shortly after IV contrast. Managed as per contrast reaction protocol.',
    action: 'Injection stopped, antihistamine given, observed until stable.',
    factors: ['Allergy screening form incomplete'],
    findings: 'Contrast allergy screening question was not asked.',
    rootCause: 'Screening form allows the scan to proceed with blank answers.',
    whys: [['Why the reaction?', 'Previous reaction not known'], ['Why?', 'Screening incomplete'], ['Why?', 'Blank answers allowed']],
    capas: [['CORRECTIVE', 'Mandatory contrast screening before every contrast scan'], ['PREVENTIVE', 'Contrast reaction drill every quarter']],
  },
  {
    category: 'RADIOLOGY_AND_IMAGING', sub: 'WRONG_PATIENT_SCANNED', depts: ['RADIOLOGY'], affected: 'OUTPATIENT', sev: [3, 2, 0.5, 0, 0], weight: 2,
    titles: ['Wrong patient called for X-ray, identified before exposure', 'Similar-name patients mixed up at CT'],
    description: 'Two patients with similar names were waiting; the wrong patient was called in. Identified before exposure.',
    action: 'Scan stopped, both patients re-identified with two identifiers, correct patient scanned.',
    factors: ['Similar names', 'Single identifier used'],
    findings: 'Only the name was used to call patients.',
    rootCause: 'Two-identifier check not applied in radiology waiting area.',
    whys: [['Why the mix-up?', 'Called by name only'], ['Why?', 'Habit in busy area'], ['Why?', 'No second identifier prompt']],
    capas: [['CORRECTIVE', 'Two-identifier check before every imaging study'], ['PREVENTIVE', 'Similar-name alert on worklist']],
  },
  {
    category: 'BIOMEDICAL_EQUIPMENT', sub: 'EQUIPMENT_FAILURE_DURING_USE', depts: ['ICU', 'OT', 'EMERGENCY'], affected: 'INPATIENT', sev: [3, 4, 1, 0.2, 0], weight: 5,
    titles: ['Infusion pump alarm failure during infusion', 'Multipara monitor switched off during use', 'Suction machine failed during procedure'],
    description: 'Equipment failed during patient use. Backup equipment was arranged.',
    action: 'Backup equipment used, faulty unit tagged and sent to biomedical engineering.',
    factors: ['Preventive maintenance overdue', 'Battery not charged'],
    findings: 'Preventive maintenance was overdue by two months.',
    rootCause: 'PM schedule not tracked for equipment moved between units.',
    whys: [['Why the failure?', 'Battery failed'], ['Why?', 'PM overdue'], ['Why?', 'Equipment moved and lost from PM list']],
    capas: [['CORRECTIVE', 'Complete overdue preventive maintenance for the unit'], ['PREVENTIVE', 'Asset tagging with PM due date on every device']],
  },
  {
    category: 'OCCUPATIONAL_EXPOSURE', sub: 'NEEDLESTICK_INJURY', depts: ['WARD', 'LAB', 'OT', 'EMERGENCY'], affected: 'EMPLOYEE', sev: [1, 5, 1, 0, 0], weight: 6,
    titles: ['Needle-stick injury while recapping', 'Staff nurse pricked by used needle', 'Needle-stick injury during waste disposal'],
    description: 'Staff member sustained a needle-stick injury from a used needle.',
    action: 'Wound washed, reported to employee health, post-exposure protocol started, source tested.',
    factors: ['Recapping', 'Sharps container overfilled'],
    findings: 'Sharps container was overfilled and the needle was recapped.',
    rootCause: 'Sharps containers not replaced at three-quarters full; recapping still practised.',
    whys: [['Why the injury?', 'Recapping'], ['Why recap?', 'Container full'], ['Why full?', 'No replacement schedule']],
    capas: [['CORRECTIVE', 'Replace sharps containers at three-quarters full'], ['PREVENTIVE', 'No-recap training and safety-engineered needles']],
  },
  {
    category: 'WORKPLACE_INJURY', sub: 'VISITOR_FALL', depts: ['QUALITY', 'EMERGENCY'], affected: 'VISITOR_FAMILY', sev: [2, 4, 1, 0, 0], weight: 2,
    titles: ['Visitor slipped near ward entrance', 'Attendant fell on stairs'],
    description: 'A visitor slipped on a wet patch near the entrance and sustained a minor injury.',
    action: 'First aid in emergency, area cleaned and cordoned.',
    factors: ['Rainwater at entrance', 'No mat'],
    findings: 'Rainwater tracked in without an entrance mat or warning sign.',
    rootCause: 'No monsoon precautions for entrances.',
    whys: [['Why the fall?', 'Wet floor'], ['Why?', 'Rainwater at entrance'], ['Why?', 'No mats during rain']],
    capas: [['CORRECTIVE', 'Anti-slip mats at all entrances'], ['PREVENTIVE', 'Monsoon readiness checklist for housekeeping']],
  },
  {
    category: 'VIOLENCE_ABUSE_AND_HARASSMENT', sub: 'VERBAL_ABUSE_OR_THREAT', depts: ['EMERGENCY', 'QUALITY'], affected: 'EMPLOYEE', sev: [3, 4, 0.5, 0, 0], weight: 3,
    titles: ['Attendant verbally abused emergency staff', 'Relatives threatened duty doctor over waiting time'],
    description: 'Relatives became aggressive and verbally abused staff over the waiting time.',
    action: 'Security called, situation de-escalated, senior doctor explained the plan.',
    factors: ['Long waiting time', 'Poor communication of delays'],
    findings: 'Family was not updated about the reason for the delay for over an hour.',
    rootCause: 'No routine update to waiting relatives in the emergency department.',
    whys: [['Why the aggression?', 'Frustration with waiting'], ['Why?', 'Not updated'], ['Why?', 'No assigned family liaison']],
    capas: [['CORRECTIVE', 'Security presence at emergency entrance during peak hours'], ['PREVENTIVE', 'Hourly update to waiting relatives by a designated staff member']],
  },
  {
    category: 'IT_AND_COMMUNICATION_DOWNTIME', sub: 'HIS_OUTAGE', depts: ['QUALITY', 'PHARMACY', 'LAB'], affected: 'OTHER', sev: [4, 4, 0.5, 0, 0], weight: 2,
    titles: ['HIS downtime delayed lab and pharmacy orders', 'Hospital system outage for two hours'],
    description: 'The hospital information system was unavailable; orders and results were handled on paper.',
    action: 'Downtime procedure activated, paper forms used, data entered after recovery.',
    factors: ['Server update during working hours', 'Downtime forms not available on all wards'],
    findings: 'An update was applied during working hours without notice; some wards had no downtime forms.',
    rootCause: 'No change-control window for system updates.',
    whys: [['Why the outage?', 'Unplanned update'], ['Why then?', 'No change window'], ['Why disruption?', 'Downtime kits missing']],
    capas: [['CORRECTIVE', 'Downtime kits on every ward'], ['PREVENTIVE', 'Change-control window for updates outside peak hours']],
  },
];

// Wards that fit each department (codes from the hospital's ward list). Any other ward is used
// only when none of these exist on the server.
const DEPT_WARDS: Record<Dept, string[]> = {
  EMERGENCY: ['AMW', 'TICU1', 'TICU2'],
  ICU: ['MICU', 'SICU', 'CICUW', 'RICU', 'AICUW', 'CTVSW', 'RTICU', 'PICU', 'NEON', 'MTICU'],
  OT: ['OTC', 'OTCW', 'PACUW'],
  WARD: ['FMW', 'MMW', 'FSW', 'MSW', 'FOW', 'MOW', 'GNW', 'OBSW', 'PTW', 'FEW', 'MEW', 'SPW', 'CSW', 'FTCW', 'MTCW', 'DYW', 'FSSPW', 'MSSPW'],
  PHARMACY: ['FMW', 'MMW', 'FSW', 'MSW', 'SPW'],
  RADIOLOGY: ['AMW', 'TICU1', 'MSW', 'FSW'],
  LAB: ['FMW', 'MMW', 'MICU', 'FSW', 'MSW', 'DYW'],
  QUALITY: ['AMW', 'SPW', 'SRW', 'OTC'],
};

const FIRST = ['Murugan', 'Lakshmi', 'Selvi', 'Ravi', 'Meena', 'Arjun', 'Kamala', 'Senthil', 'Priya', 'Ganesh', 'Revathi', 'Kumar', 'Saranya', 'Babu', 'Anitha', 'Rajesh', 'Vasanthi', 'Karthik', 'Deepa', 'Mani', 'Jaya', 'Suresh', 'Uma', 'Prakash'];
const INITIALS = ['R', 'S', 'K', 'M', 'P', 'V', 'G', 'T', 'N', 'A'];
const HOD_NAMES = ['Staff Nurse', 'Duty Doctor', 'Ward In-charge', 'Technician', 'Pharmacist'];

/** Small seeded PRNG (mulberry32), so the history is identical on every run. */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface HistoryDef {
  daysAgo: number;
  department: Dept;
  location: string;
  category: string;
  subcategory: string;
  patientInvolved: boolean;
  affectedPersonType: Affected;
  affectedOtherDetail?: string;
  patient?: { uhid: string; ipNumber: string; name: string; age: number; gender: string };
  affectedPersonDetail?: { name?: string; department?: string };
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  description: string;
  immediateAction: string;
  initialSeverity: number;
  severity: number;
  status: IncidentStatus;
  requiresRca: boolean;
  closureRemarks?: string;
  closedDaysAgo?: number;
  riskAssessment?: { likelihood: number; severity: number; rationale?: string };
  investigation?: {
    status: 'IN_PROGRESS' | 'COMPLETED';
    dueOffsetDays: number;
    facts: string;
    chronology: string;
    peopleInterviewed: Array<{ name: string; designation: string; statement?: string }>;
    contributingFactors: string[];
    findings: string;
    recommendation?: string;
  };
  rca?: { method: 'FIVE_WHY'; status: 'DRAFT' | 'COMPLETED'; fiveWhy: Array<{ sequence: number; question: string; answer: string }>; rootCauseSummary: string };
  capas: Array<{
    type: CapaType;
    action: string;
    priority: CapaPriority;
    assignedDaysAgo: number;
    targetOffsetDays: number;
    status: 'OPEN' | 'DONE' | 'EFFECTIVE';
    completionRemarks?: string;
    completedDaysAgo?: number;
    verification?: { verifiedBy: string; verifiedDaysAgo: number; effective: boolean; remarks: string };
  }>;
  infoRequests?: Array<{ question: string; askedDaysAgo: number; response?: string; respondedDaysAgo?: number }>;
  rejection?: { reason: string; daysAgo: number };
  qualityReviews?: Array<{ decision: 'ACCEPTED' | 'RETURNED'; remarks: string; daysAgo: number }>;
  closureSubmission?: { summary: string; daysAgo: number };
}

const REJECT_REASONS = [
  'Duplicate of an incident already reported for the same event.',
  'Not an incident: routine maintenance request, forwarded to the engineering helpdesk.',
  'Reported in error; the event was a planned procedure change.',
];

/** Builds the year of history. `wardCodes` are the active wards on this server. */
export const buildHistory = (wardCodes: string[]): HistoryDef[] => {
  if (!wardCodes.length) return [];
  const rand = rng(20261103);
  const pick = <V>(xs: V[]): V => xs[Math.floor(rand() * xs.length)];
  const weighted = <V>(xs: V[], weights: number[]): V => {
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rand() * total;
    for (let i = 0; i < xs.length; i++) {
      r -= weights[i];
      if (r <= 0) return xs[i];
    }
    return xs[xs.length - 1];
  };
  const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const available = new Set(wardCodes);
  const wardFor = (dept: Dept) => {
    const fits = DEPT_WARDS[dept].filter((c) => available.has(c));
    return pick(fits.length ? fits : wardCodes);
  };

  const defs: HistoryDef[] = [];
  for (let i = 0; i < HISTORY_COUNT; i++) {
    const t = weighted(T, T.map((x) => x.weight));
    // Spread over the last year, slightly busier in recent months (reporting culture improving)
    const daysAgo = Math.min(365, Math.max(9, Math.round(365 * Math.pow(rand(), 1.25))));
    const severity = weighted([1, 2, 3, 4, 5], t.sev);
    const department = pick(t.depts);
    const isPatient = t.affected === 'INPATIENT' || t.affected === 'OUTPATIENT';
    const name = `${rand() < 0.5 ? 'Mr.' : 'Mrs.'} ${pick(FIRST)} ${pick(INITIALS)}`;

    // Status by age: older incidents are mostly closed
    const r = rand();
    let status: IncidentStatus;
    if (r < 0.05) status = 'REJECTED';
    else if (daysAgo > 60) status = r < 0.94 ? 'CLOSED' : 'CAPA_IN_PROGRESS';
    else if (daysAgo > 30) status = r < 0.65 ? 'CLOSED' : r < 0.82 ? 'CAPA_IN_PROGRESS' : r < 0.93 ? 'PENDING_QUALITY_REVIEW' : 'UNDER_INVESTIGATION';
    else status = r < 0.3 ? 'CLOSED' : r < 0.45 ? 'ASSIGNED' : r < 0.62 ? 'UNDER_INVESTIGATION' : r < 0.82 ? 'CAPA_IN_PROGRESS' : r < 0.95 ? 'PENDING_QUALITY_REVIEW' : 'SUBMITTED';

    const assigned = !['SUBMITTED', 'REJECTED'].includes(status);
    const investigated = ['UNDER_INVESTIGATION', 'CAPA_IN_PROGRESS', 'PENDING_QUALITY_REVIEW', 'CLOSED'].includes(status);
    const investigationDone = investigated && status !== 'UNDER_INVESTIGATION';
    const capaDone = ['PENDING_QUALITY_REVIEW', 'CLOSED'].includes(status);
    const closed = status === 'CLOSED';

    // Closure time grows with complexity; a few go past the target
    const closeAfter = Math.min(daysAgo - 1, between(4, 12) + severity * between(1, 4) + (rand() < 0.15 ? between(10, 25) : 0));
    const closedDaysAgo = closed ? Math.max(1, daysAgo - closeAfter) : undefined;
    const reviewDay = closedDaysAgo ?? Math.max(1, daysAgo - between(5, 15));
    const returnedOnce = closed && rand() < 0.15 && closeAfter > 8;

    const capaCount = rand() < 0.55 ? 2 : 1;
    const capas: HistoryDef['capas'] = [];
    if (investigationDone) {
      for (let c = 0; c < capaCount; c++) {
        const [type, action] = t.capas[c % t.capas.length];
        const assignedDaysAgo = Math.max(1, daysAgo - between(3, 6));
        const target = between(10, 30);
        // Open CAPAs on older incidents are the overdue ones
        const targetOffsetDays = target - assignedDaysAgo;
        const done = capaDone || (status === 'CAPA_IN_PROGRESS' && c === 0 && rand() < 0.4);
        const completedDaysAgo = done ? Math.max(1, (closedDaysAgo ?? reviewDay) + between(1, 3)) : undefined;
        capas.push({
          type,
          action,
          priority: severity >= 4 ? 'CRITICAL' : severity === 3 ? 'HIGH' : severity === 2 ? 'MEDIUM' : 'LOW',
          assignedDaysAgo,
          targetOffsetDays,
          status: closed ? 'EFFECTIVE' : done ? 'DONE' : 'OPEN',
          completionRemarks: done ? 'Action completed and communicated to staff.' : undefined,
          completedDaysAgo,
          verification: closed
            ? { verifiedBy: 'quality.anita', verifiedDaysAgo: closedDaysAgo!, effective: true, remarks: 'Verified on follow-up audit.' }
            : undefined,
        });
      }
    }

    const riskSeverity = Math.min(5, Math.max(1, severity + (rand() < 0.2 ? 1 : 0)));
    defs.push({
      daysAgo,
      department,
      location: wardFor(department),
      category: t.category,
      subcategory: t.sub,
      patientInvolved: isPatient,
      affectedPersonType: t.affected,
      affectedOtherDetail: t.affected === 'OTHER' ? 'Hospital systems / no individual affected' : undefined,
      patient: isPatient
        ? { uhid: `UHID-25${String(100000 + i * 37).slice(-5)}`, ipNumber: `IP-${String(2000 + i)}`, name, age: between(18, 86), gender: name.startsWith('Mr.') ? 'Male' : 'Female' }
        : undefined,
      affectedPersonDetail: t.affected === 'EMPLOYEE' || t.affected === 'VISITOR_FAMILY' ? { name, department: t.affected === 'EMPLOYEE' ? department : undefined } : undefined,
      priority: assigned ? (severity >= 3 ? 'HIGH' : severity === 2 ? 'MEDIUM' : 'LOW') : undefined,
      title: pick(t.titles),
      description: t.description,
      immediateAction: t.action,
      initialSeverity: rand() < 0.12 ? Math.max(1, severity - 1) : severity,
      severity,
      status,
      requiresRca: severity >= 4,
      closureRemarks: closed ? 'CAPA verified effective; incident closed.' : undefined,
      closedDaysAgo,
      riskAssessment: closed
        ? {
            likelihood: weighted([1, 2, 3, 4], [3, 4, 2, 1]),
            severity: riskSeverity,
            rationale: riskSeverity >= 4 ? 'Potential for serious harm if the same failure recurs.' : undefined,
          }
        : undefined,
      investigation: investigated
        ? {
            status: investigationDone ? 'COMPLETED' : 'IN_PROGRESS',
            dueOffsetDays: between(2, 10) - Math.max(0, daysAgo - 20),
            facts: t.description,
            chronology: 'Event noticed by staff, first aid and immediate action taken, incident reported the same shift.',
            peopleInterviewed: [{ name: `${pick(FIRST)} ${pick(INITIALS)}`, designation: pick(HOD_NAMES), statement: 'Confirmed the sequence of events.' }],
            contributingFactors: t.factors,
            findings: investigationDone ? t.findings : '',
            recommendation: investigationDone ? t.capas.map((c) => c[1]).join('; ') : undefined,
          }
        : undefined,
      rca:
        severity >= 4 && investigated
          ? {
              method: 'FIVE_WHY',
              status: investigationDone ? 'COMPLETED' : 'DRAFT',
              fiveWhy: t.whys.map(([question, answer], k) => ({ sequence: k + 1, question, answer })),
              rootCauseSummary: t.rootCause,
            }
          : undefined,
      capas,
      infoRequests:
        rand() < 0.1 && status !== 'SUBMITTED'
          ? [{ question: 'Please confirm the exact time and who else was present.', askedDaysAgo: daysAgo, response: 'It happened during the shift change; the staff nurse and attendant were present.', respondedDaysAgo: Math.max(1, daysAgo - 1) }]
          : undefined,
      rejection: status === 'REJECTED' ? { reason: pick(REJECT_REASONS), daysAgo: Math.max(1, daysAgo - 1) } : undefined,
      qualityReviews: closed
        ? [
            ...(returnedOnce ? [{ decision: 'RETURNED' as const, remarks: 'Please attach evidence of the CAPA and staff briefing.', daysAgo: closedDaysAgo! + between(2, 5) }] : []),
            { decision: 'ACCEPTED' as const, remarks: 'CAPA verified effective; incident closed.', daysAgo: closedDaysAgo! },
          ]
        : undefined,
      closureSubmission: capaDone ? { summary: 'Investigation and CAPA completed; submitted for Quality review.', daysAgo: closedDaysAgo ?? reviewDay } : undefined,
    });
  }
  // Oldest first, so incident numbers follow the order they were reported
  return defs.sort((a, b) => b.daysAgo - a.daysAgo);
};
