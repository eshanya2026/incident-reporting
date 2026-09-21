import mongoose from 'mongoose';
import { logger } from '../config/logger.js';
import { Incident, IncidentStatus } from '../modules/incidents/incident.model.js';
import { Investigation } from '../modules/investigations/investigation.model.js';
import { RootCauseAnalysis } from '../modules/rca/rca.model.js';
import { Capa, CapaStatus, CapaType, CapaPriority } from '../modules/capa/capa.model.js';
import { Notification } from '../modules/notifications/notification.model.js';
import { AuditLog } from '../modules/audit/audit.model.js';
import { Counter } from '../common/models/counter.model.js';

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Near Miss',
  2: 'Minor Harm',
  3: 'Moderate Harm',
  4: 'Major Harm',
  5: 'Critical / Sentinel Event',
};

// The HOD of the receiving department is assigned the incident and writes/owns its CAPA
const DEPARTMENT_HOD: Record<string, string> = {
  EMERGENCY: 'hod.emergency',
  ICU: 'hod.icu',
  OT: 'hod.ot',
  WARD: 'hod.ward',
  PHARMACY: 'hod.pharmacy',
  RADIOLOGY: 'hod.radiology',
  LAB: 'hod.lab',
  QUALITY: 'hod.quality',
};

// Demo incidents are reported by a staff member of the department where they occurred
const DEPARTMENT_STAFF: Record<string, string> = {
  EMERGENCY: 'nurse.mary',
  ICU: 'nurse.kavitha',
  OT: 'nurse.john',
  WARD: 'nurse.selvi',
  PHARMACY: 'pharm.raj',
  RADIOLOGY: 'rad.bala',
  LAB: 'lab.anitha',
  QUALITY: 'nurse.divya',
};

const daysAgo = (n: number, hours = 10): Date => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hours, (n * 7) % 60, 0, 0);
  return d;
};

const daysFromNow = (n: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(17, 0, 0, 0);
  return d;
};

interface DummyPatient {
  uhid: string;
  ipNumber: string;
  name: string;
  age: number;
  gender: string;
  ward?: string;
  bed?: string;
  consultant?: string;
  admissionDaysAgo?: number;
}

interface DummyInvestigation {
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
  dueOffsetDays: number;
  facts: string;
  chronology: string;
  peopleInterviewed: Array<{ name: string; designation: string; statement?: string }>;
  contributingFactors: string[];
  immediateCorrections?: string;
  findings: string;
  recommendation?: string;
}

interface DummyRca {
  method: 'FIVE_WHY' | 'FISHBONE' | 'BOTH';
  status: 'DRAFT' | 'COMPLETED';
  fiveWhy: Array<{ sequence: number; question: string; answer: string }>;
  fishbone?: {
    people?: string[];
    process?: string[];
    equipment?: string[];
    environment?: string[];
    communication?: string[];
    policy?: string[];
    training?: string[];
    technology?: string[];
  };
  rootCauseSummary: string;
}

interface DummyCapa {
  seq: number;
  type: CapaType;
  action: string;
  priority: CapaPriority;
  assignedDaysAgo: number;
  targetOffsetDays: number;
  status: CapaStatus;
  completionRemarks?: string;
  completedDaysAgo?: number;
  verification?: {
    verifiedBy: string;
    verifiedDaysAgo: number;
    effective: boolean;
    remarks: string;
  };
}

interface DummyIncidentDef {
  seq: number;
  daysAgo: number;
  department: string;
  reportingDepartment?: string;
  occurredInDepartment?: string;
  location: string;
  category: string;
  subcategory: string;
  patientInvolved: boolean;
  patient?: DummyPatient;
  title: string;
  description: string;
  immediateAction?: string;
  initialSeverity?: number;
  severity: number;
  status: IncidentStatus;
  requiresRca?: boolean;
  requiresCapa?: boolean;
  closureRemarks?: string;
  closedDaysAgo?: number;
  investigation?: DummyInvestigation;
  rca?: DummyRca;
  capas?: DummyCapa[];
  assignments?: Array<{
    department: string;
    hodUser?: string;
    severity?: number;
    remarks?: string;
    daysAgo?: number;
  }>;
  infoRequests?: Array<{
    question: string;
    askedDaysAgo: number;
    response?: string;
    respondedDaysAgo?: number;
  }>;
  rejection?: {
    reason: string;
    daysAgo?: number;
  };
  hodReturns?: Array<{
    reason: string;
    department?: string;
    hodUser?: string;
    daysAgo: number;
  }>;
  qualityReviews?: Array<{
    decision: 'ACCEPTED' | 'RETURNED';
    remarks: string;
    daysAgo?: number;
  }>;
  closureSubmission?: {
    summary: string;
    daysAgo?: number;
  };
}

const INCIDENTS: DummyIncidentDef[] = [
  {
    seq: 1,
    daysAgo: 1,
    department: 'EMERGENCY',
    location: 'ER-BAY-1',
    category: 'PATIENT_FALL',
    subcategory: 'FALL_WITHOUT_INJURY',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401891',
      ipNumber: 'IP-26-10421',
      name: 'Mr. Selvam R',
      age: 72,
      gender: 'Male',
      ward: 'ER Observation',
      bed: 'Bay 1',
      consultant: 'Dr. Ramesh Emergency HOD',
      admissionDaysAgo: 1,
    },
    title: 'Elderly patient slipped while transferring from trolley',
    description:
      '72-year-old male being transferred from ambulance trolley to ER bay bed lost balance. Attendant and nurse broke the fall. No visible injury. Patient was wearing socks without non-slip soles.',
    immediateAction: 'Patient assessed, vitals stable, fall-risk wristband applied, family informed.',
    severity: 2,
    status: 'SUBMITTED',
  },
  {
    seq: 2,
    daysAgo: 2,
    department: 'ICU',
    reportingDepartment: 'ICU',
    occurredInDepartment: 'ICU',
    location: 'ICU-BED-01',
    category: 'MEDICATION_SAFETY',
    subcategory: 'WRONG_DOSE',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2402014',
      ipNumber: 'IP-26-09811',
      name: 'Mrs. Lakshmi Devi',
      age: 64,
      gender: 'Female',
      ward: 'ICU',
      bed: '01',
      consultant: 'Dr. Lakshmi ICU HOD',
      admissionDaysAgo: 5,
    },
    title: 'Insulin dose transcribed incorrectly on ICU chart',
    description:
      'Evening insulin dose of 8 units was transcribed as 18 units on the ICU medication chart. Error caught at double-check before administration. Patient not given the incorrect dose.',
    immediateAction: 'Dose withheld, physician notified, chart corrected, independent double-check restarted.',
    initialSeverity: 3,
    severity: 3,
    status: 'ASSIGNED',
    assignments: [
      {
        department: 'PHARMACY',
        hodUser: 'hod.pharmacy',
        severity: 3,
        remarks: 'Please investigate dispensing vs prescription discrepancy.',
        daysAgo: 2,
      },
      {
        department: 'ICU',
        hodUser: 'hod.icu',
        severity: 3,
        remarks: 'Re-assigned to ICU nursing: bedside transcription verification and double-check protocol.',
        daysAgo: 1,
      },
    ],
    hodReturns: [
      {
        department: 'PHARMACY',
        hodUser: 'hod.pharmacy',
        reason:
          'Physician e-prescription and pharmacy dispensing record both show 8 units. Transcription error occurred at ICU bedside nursing chart. Re-assign to ICU nursing.',
        daysAgo: 2,
      },
    ],
  },
  {
    seq: 3,
    daysAgo: 3,
    department: 'EMERGENCY',
    location: 'ER-BAY-2',
    category: 'PATIENT_IDENTIFICATION',
    subcategory: 'WRISTBAND_MISSING',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2402102',
      ipNumber: 'IP-26-10502',
      name: 'Ms. Divya K',
      age: 29,
      gender: 'Female',
      ward: 'ER',
      bed: 'Bay 2',
      consultant: 'Dr. Ramesh Emergency HOD',
      admissionDaysAgo: 3,
    },
    title: 'Trauma patient arrived without identification wristband',
    description:
      'Unconscious trauma patient brought by 108 ambulance had no ID wristband. Two similar-name patients were in adjacent bays, creating identification risk before CT.',
    immediateAction: 'Temporary ID generated, two-identifier check enforced before imaging.',
    severity: 2,
    status: 'ASSIGNED',
  },
  {
    seq: 4,
    daysAgo: 5,
    department: 'EMERGENCY',
    location: 'ER-BAY-1',
    category: 'CLINICAL_CARE_TREATMENT',
    subcategory: 'TREATMENT_DELAY',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401766',
      ipNumber: 'IP-26-10110',
      name: 'Mr. Karthik M',
      age: 54,
      gender: 'Male',
      ward: 'ER Resuscitation',
      bed: 'Bay 1',
      consultant: 'Dr. Ramesh Emergency HOD',
      admissionDaysAgo: 5,
    },
    title: 'Stroke thrombolysis delayed beyond door-to-needle target',
    description:
      'Suspected acute ischemic stroke. CT completed at 28 minutes but neurology consult and thrombolysis decision delayed. Door-to-needle 82 minutes against 60-minute target.',
    immediateAction: 'Stroke code re-activated, thrombolysis given after eligibility confirmation, family counselled.',
    severity: 4,
    status: 'UNDER_INVESTIGATION',
    requiresRca: true,
    investigation: {
      status: 'IN_PROGRESS',
      dueOffsetDays: 3,
      facts: 'Door-to-CT met target. Delay occurred waiting for on-call neurologist confirmation and pharmacy mixing of alteplase.',
      chronology:
        '21:10 arrival → 21:18 stroke code → 21:38 CT complete → 22:12 neurology callback → 22:32 drug administered.',
      peopleInterviewed: [
        { name: 'Nurse Mary Staff', designation: 'Senior Staff Nurse', statement: 'Neurology did not answer first two calls.' },
        { name: 'Dr. Ramesh', designation: 'HOD Emergency', statement: 'Escalation matrix for after-hours stroke is unclear.' },
      ],
      contributingFactors: ['COMMUNICATION', 'PROCESS', 'HUMAN_FACTOR'],
      immediateCorrections: 'Printed after-hours stroke escalation card placed at ER desk.',
      findings: 'Investigation in progress. Primary delay is on-call response plus drug preparation.',
      recommendation: 'Dedicated stroke phone and pre-mixed protocol to be evaluated.',
    },
  },
  {
    seq: 5,
    daysAgo: 8,
    department: 'OT',
    location: 'OT-SUITE-1',
    category: 'SURGERY_PROCEDURE',
    subcategory: 'WRONG_SITE',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401550',
      ipNumber: 'IP-26-09440',
      name: 'Mr. Anand P',
      age: 47,
      gender: 'Male',
      ward: 'Pre-op',
      bed: 'OT Holding',
      consultant: 'Dr. Venkat OT HOD',
      admissionDaysAgo: 9,
    },
    title: 'Wrong-site mark identified during surgical time-out',
    description:
      'Left inguinal hernia listed. Site marked on right groin in holding area. Time-out in OT Suite 1 identified mismatch before incision. Procedure stopped and remarking completed.',
    immediateAction: 'Time-out halted case, site re-verified with consent and imaging, WHO checklist repeated.',
    severity: 5,
    status: 'UNDER_INVESTIGATION',
    requiresRca: true,
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -1,
      facts: 'Marking performed by junior resident without consent form in hand. Consent listed left side.',
      chronology: '07:40 marking in holding → 08:05 transfer to OT → 08:12 time-out catch → 08:25 remarking → 08:40 surgery started correctly.',
      peopleInterviewed: [
        { name: 'Nurse John OT', designation: 'OT Staff Nurse', statement: 'WHO checklist caught the error before knife to skin.' },
        { name: 'Dr. Venkat', designation: 'HOD OT', statement: 'Site marking policy requires operating surgeon, not covering resident.' },
      ],
      contributingFactors: ['PROCESS', 'HUMAN_FACTOR', 'POLICY', 'TRAINING'],
      immediateCorrections: 'Case paused, correct side confirmed with patient (awake) and consent.',
      findings: 'Site marking was delegated contrary to policy. Time-out barrier worked.',
      recommendation: 'Mandatory operating-surgeon marking and dual verification with consent.',
    },
    rca: {
      method: 'BOTH',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why was the wrong side marked?', answer: 'Junior resident marked without the consent form.' },
        { sequence: 2, question: 'Why did the resident mark without consent?', answer: 'Surgeon was delayed in another theatre.' },
        { sequence: 3, question: 'Why was marking delegated?', answer: 'No visual cue that only the operating surgeon may mark.' },
        { sequence: 4, question: 'Why was there no cue?', answer: 'Holding-area checklist does not include surgeon identity.' },
        { sequence: 5, question: 'Why is the checklist incomplete?', answer: 'Policy updated in 2024 was not rolled into the OT holding form.' },
      ],
      fishbone: {
        people: ['Covering resident performed marking', 'Operating surgeon arrived after transfer'],
        process: ['Holding checklist missing surgeon-mark step'],
        policy: ['Site-marking SOP not posted in holding bay'],
        training: ['New residents not signed off on laterality policy'],
        communication: ['Handover did not mention laterality risk'],
      },
      rootCauseSummary:
        'Wrong-site mark occurred because site-marking SOP was not operationalised in the OT holding checklist, allowing delegation to a covering resident.',
    },
  },
  {
    seq: 6,
    daysAgo: 10,
    department: 'LAB',
    location: 'LAB-PHLEBO-1',
    category: 'LABORATORY',
    subcategory: 'MISLABELING',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401622',
      ipNumber: 'IP-26-09601',
      name: 'Mrs. Geetha S',
      age: 58,
      gender: 'Female',
      ward: 'Ward 302',
      bed: '302-B',
      consultant: 'Dr. Meena Ward HOD',
      admissionDaysAgo: 12,
    },
    title: 'Cross-labelled blood samples for two ward patients',
    description:
      'Two EDTA vials from adjacent beds in Ward 302 were labelled with swapped UHIDS. Mismatch detected at accessioning when barcode did not match request form.',
    immediateAction: 'Samples rejected, re-collection ordered, no results released.',
    severity: 3,
    status: 'CAPA_IN_PROGRESS',
    requiresRca: true,
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -3,
      facts: 'Phlebotomy round labelled vials after leaving the bedside. Two patients had similar first names.',
      chronology: '06:15 draw bed A → 06:17 draw bed B → 06:22 labelling at nursing station → 06:45 lab rejection.',
      peopleInterviewed: [
        { name: 'Tech Anitha Lab', designation: 'Lab Technician', statement: 'Accessioning barcode check caught the swap.' },
        { name: 'Ward Staff', designation: 'Staff Nurse', statement: 'Tubes were left unlabelled on the procedure tray.' },
      ],
      contributingFactors: ['PROCESS', 'HUMAN_FACTOR', 'COMMUNICATION'],
      immediateCorrections: 'Re-bleed both patients at bedside with two identifiers.',
      findings: 'Bedside labelling policy was not followed during morning round.',
      recommendation: 'Enforce label-at-bedside and scan-on-collect.',
    },
    rca: {
      method: 'FIVE_WHY',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why were samples swapped?', answer: 'Vials labelled away from the bedside.' },
        { sequence: 2, question: 'Why away from bedside?', answer: 'Printer labels were kept at the nursing station.' },
        { sequence: 3, question: 'Why were labels not at bedside?', answer: 'Portable printer was not issued to phlebotomy.' },
        { sequence: 4, question: 'Why no portable printer?', answer: 'Capital request pending since last audit.' },
        { sequence: 5, question: 'Why was the workaround accepted?', answer: 'No process audit of morning phlebotomy round.' },
      ],
      rootCauseSummary: 'Samples were labelled away from the patient because bedside label printing was not available and not audited.',
    },
    capas: [
      {
        seq: 1,
        type: 'CORRECTIVE',
        action: 'Issue portable barcode printers and mandate label-at-bedside for all inpatient draws.',
        priority: 'HIGH',
        assignedDaysAgo: 6,
        targetOffsetDays: 4,
        status: 'OPEN',
      },
      {
        seq: 2,
        type: 'PREVENTIVE',
        action: 'Weekly phlebotomy observational audit for two-identifier and bedside labelling compliance.',
        priority: 'MEDIUM',
        assignedDaysAgo: 6,
        targetOffsetDays: -2,
        status: 'OPEN',
      },
    ],
  },
  {
    seq: 7,
    daysAgo: 14,
    department: 'RADIOLOGY',
    location: 'RAD-CT-1',
    category: 'RADIOLOGY_IMAGING',
    subcategory: 'CONTRAST_REACTION',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401408',
      ipNumber: 'OP-26-33110',
      name: 'Mr. Natarajan V',
      age: 61,
      gender: 'Male',
      ward: 'CT Suite',
      consultant: 'Radiology Consultant',
      admissionDaysAgo: 14,
    },
    title: 'Moderate contrast reaction during CT abdomen',
    description:
      'Patient developed urticaria and mild bronchospasm 4 minutes after IV contrast. Known atopy not flagged on request form. Recovered after antihistamine and oxygen.',
    immediateAction: 'Contrast stopped, emergency trolley used, physician called, observation for 2 hours.',
    severity: 3,
    status: 'PENDING_QUALITY_REVIEW',
    requiresRca: true,
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -7,
      facts: 'Allergy history was in old paper file, not in HIS. Screening checklist ticked “no allergy” by default.',
      chronology: '10:00 screening → 10:18 contrast → 10:22 reaction → 10:25 treatment → 12:30 discharge from observation.',
      peopleInterviewed: [
        { name: 'Radiographer Bala', designation: 'CT Technologist', statement: 'Checklist auto-defaults to no known allergy.' },
      ],
      contributingFactors: ['PROCESS', 'TECHNOLOGY', 'COMMUNICATION'],
      findings: 'Allergy reconciliation between HIS and radiology worklist is incomplete.',
      recommendation: 'Hard-stop allergy prompt before contrast injection.',
    },
    rca: {
      method: 'FISHBONE',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why was allergy missed?', answer: 'HIS allergy field was empty.' },
        { sequence: 2, question: 'Why empty?', answer: 'OP registration does not require allergy entry.' },
      ],
      fishbone: {
        process: ['Optional allergy field at OP registration'],
        technology: ['Radiology worklist does not pull allergy alerts'],
        people: ['Technologist relied on default checklist'],
        policy: ['Contrast SOP lacks independent allergy verification'],
      },
      rootCauseSummary: 'Contrast reaction risk was missed because allergy capture is optional at registration and not hard-stopped in CT.',
    },
    capas: [
      {
        seq: 3,
        type: 'CORRECTIVE',
        action: 'Add mandatory allergy capture on contrast request and verbal confirmation at CT console.',
        priority: 'HIGH',
        assignedDaysAgo: 10,
        targetOffsetDays: -1,
        status: 'DONE',
        completionRemarks: 'Verbal confirmation script posted; HIS change requested and in UAT.',
        completedDaysAgo: 2,
      },
    ],
  },
  {
    seq: 8,
    daysAgo: 16,
    department: 'PHARMACY',
    location: 'PHARM-CTR-1',
    category: 'MEDICATION_PHARMACY',
    subcategory: 'DISPENSING_ERROR',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401333',
      ipNumber: 'IP-26-09002',
      name: 'Master Arjun (Paediatric)',
      age: 6,
      gender: 'Male',
      ward: 'Ward 401',
      bed: '401-A',
      consultant: 'Dr. Meena Ward HOD',
      admissionDaysAgo: 18,
    },
    title: 'Adult-strength antibiotic dispensed for paediatric patient',
    description:
      'IPD pharmacy issued cefixime 200 mg tablets instead of 50 mg/5 ml suspension. Ward nurse identified before first dose during independent double-check.',
    immediateAction: 'Pack returned, correct suspension dispensed, near-miss logged with family informed.',
    severity: 2,
    status: 'PENDING_QUALITY_REVIEW',
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -8,
      facts: 'Look-alike bins. Paediatric flag on HIS prescription was not highlighted on pick-list.',
      chronology: '14:00 order → 14:22 pick → 14:40 ward check catch.',
      peopleInterviewed: [
        { name: 'Pharmacist Raj', designation: 'IPD Pharmacist', statement: 'Pick-list did not show age or weight.' },
      ],
      contributingFactors: ['PROCESS', 'ENVIRONMENT', 'TECHNOLOGY'],
      findings: 'Dispensing UI omits age, increasing look-alike pick risk.',
      recommendation: 'Age/weight on pick-list and segregated paediatric bins.',
    },
    rca: {
      method: 'FIVE_WHY',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why was adult strength picked?', answer: 'Bins were adjacent and similar packaging.' },
        { sequence: 2, question: 'Why adjacent?', answer: 'No paediatric storage zoning.' },
        { sequence: 3, question: 'Why no zoning?', answer: 'Storage SOP not updated after formulary expansion.' },
      ],
      rootCauseSummary: 'Adult-strength antibiotic was picked because paediatric products are not zoned and the pick-list hides age.',
    },
    capas: [
      {
        seq: 4,
        type: 'CORRECTIVE',
        action: 'Segregate paediatric SKUs and display age/weight on IPD pick-list.',
        priority: 'HIGH',
        assignedDaysAgo: 12,
        targetOffsetDays: -3,
        status: 'EFFECTIVE',
        completionRemarks: 'Paediatric bay created; HIS pick-list now shows age.',
        completedDaysAgo: 5,
        verification: {
          verifiedBy: 'quality.anita',
          verifiedDaysAgo: 2,
          effective: true,
          remarks: 'Spot audit of 20 paediatric prescriptions: 0 strength mismatches.',
        },
      },
    ],
  },
  {
    seq: 9,
    daysAgo: 12,
    department: 'ICU',
    location: 'ICU-BED-02',
    category: 'BLOOD_TRANSFUSION',
    subcategory: 'TRANSFUSION_REACTION',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401288',
      ipNumber: 'IP-26-08821',
      name: 'Mrs. Banu Priya',
      age: 45,
      gender: 'Female',
      ward: 'ICU',
      bed: '02',
      consultant: 'Dr. Lakshmi ICU HOD',
      admissionDaysAgo: 15,
    },
    title: 'Febrile non-haemolytic transfusion reaction in ICU',
    description:
      'During second unit of PRBC, patient developed fever 38.9°C and chills. Transfusion stopped. Clerical check matched. Blood bank workup consistent with FNHTR. Recovered.',
    immediateAction: 'Transfusion stopped, vitals monitored, blood bank notified, remaining unit returned.',
    severity: 4,
    status: 'CLOSED',
    requiresRca: true,
    requiresCapa: true,
    closedDaysAgo: 3,
    closureRemarks: 'Workup complete. Pre-medication protocol updated for previously transfused patients. CAPA verified.',
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -4,
      facts: 'Unit identity correct. Patient had two prior transfusions this admission without pre-medication.',
      chronology: '19:00 start unit 2 → 19:25 fever → 19:26 stop → 19:40 blood bank informed.',
      peopleInterviewed: [
        { name: 'Nurse Kavitha ICU', designation: 'ICU Staff Nurse', statement: 'Bedside clerical check was completed before hanging.' },
      ],
      contributingFactors: ['PROCESS', 'POLICY'],
      findings: 'Reaction was recognised and managed per protocol. Pre-medication policy gap for repeat transfusions.',
      recommendation: 'Update transfusion SOP for patients with prior FNHTR risk factors.',
    },
    rca: {
      method: 'FIVE_WHY',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why did FNHTR occur?', answer: 'Repeat transfusion without leukodepletion preference documented.' },
        { sequence: 2, question: 'Why not documented?', answer: 'Prior reaction flag is free-text in HIS.' },
      ],
      rootCauseSummary: 'Repeat-transfusion reaction risk was not systematically flagged in HIS.',
    },
    capas: [
      {
        seq: 5,
        type: 'PREVENTIVE',
        action: 'Add structured previous-reaction flag and optional pre-medication order set.',
        priority: 'MEDIUM',
        assignedDaysAgo: 8,
        targetOffsetDays: -2,
        status: 'EFFECTIVE',
        completionRemarks: 'Order set live; ICU nurses in-serviced.',
        completedDaysAgo: 4,
        verification: {
          verifiedBy: 'quality.anita',
          verifiedDaysAgo: 3,
          effective: true,
          remarks: 'Three subsequent transfusions used the order set correctly.',
        },
      },
    ],
  },
  {
    seq: 10,
    daysAgo: 7,
    department: 'ICU',
    location: 'ICU-BED-01',
    category: 'MEDICAL_DEVICE_EQUIPMENT',
    subcategory: 'DEVICE_MALFUNCTION',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401990',
      ipNumber: 'IP-26-10221',
      name: 'Mr. Yusuf Ali',
      age: 68,
      gender: 'Male',
      ward: 'ICU',
      bed: '01',
      consultant: 'Dr. Lakshmi ICU HOD',
      admissionDaysAgo: 9,
    },
    title: 'Ventilator switched to backup after unexpected alarm storm',
    description:
      'Ventilator on ICU Bed 01 produced repeated disconnect alarms despite intact circuit. Patient desaturated to 88%. Manual ventilation then backup ventilator used. Biomedical found faulty flow sensor.',
    immediateAction: 'Bagged patient, backup ventilator connected, biomedical called, incident escalated to HOD.',
    severity: 4,
    status: 'CAPA_IN_PROGRESS',
    requiresRca: true,
    requiresCapa: true,
    investigation: {
      status: 'IN_PROGRESS',
      dueOffsetDays: 2,
      facts: 'Device had a deferred PM due to spare-part delay. Night staff had no second flow sensor in ICU store.',
      chronology: '02:10 alarms → 02:12 bagging → 02:18 backup vent → 03:00 biomedical on site.',
      peopleInterviewed: [
        { name: 'Nurse Kavitha ICU', designation: 'ICU Staff Nurse', statement: 'Crash cart bag-valve-mask was immediately available.' },
      ],
      contributingFactors: ['EQUIPMENT', 'PROCESS', 'ENVIRONMENT'],
      findings: 'Preventive maintenance overdue; spare sensor stock-out. Investigation extended after a similar alarm on another unit.',
      recommendation: 'Critical-device PM never deferred without HOD and quality sign-off.',
    },
  },
  {
    seq: 11,
    daysAgo: 0,
    department: 'EMERGENCY',
    reportingDepartment: 'EMERGENCY',
    occurredInDepartment: 'EMERGENCY',
    location: 'ER-BAY-2',
    category: 'INFECTION_PREVENTION_CONTROL',
    subcategory: 'NEEDLE_STICK_INJURY',
    patientInvolved: false,
    title: 'Needle-stick injury during trauma suturing',
    description:
      'Staff nurse sustained needle-stick to left index finger while assisting suturing. Source patient HIV/HBsAg status unknown at time of injury. Occupied sharps tray was overfilled.',
    immediateAction: 'Wound washed, occupational health notified, source serology sent, PEP counselling started.',
    initialSeverity: 2,
    severity: 2,
    status: 'SUBMITTED',
    infoRequests: [
      {
        question: 'Please confirm whether source patient serology was obtained and if PEP prophylaxis was initiated.',
        askedDaysAgo: 0,
        response:
          'Source patient consented; rapid serology returned negative for HIV and HBsAg. Staff nurse evaluated by Occupational Health; baseline bloods drawn and starter PEP pack dispensed.',
        respondedDaysAgo: 0,
      },
    ],
  },
  {
    seq: 12,
    daysAgo: 4,
    department: 'ICU',
    location: 'ICU-BED-02',
    category: 'COMMUNICATION_HANDOVER',
    subcategory: 'HANDOVER_FAILURE',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401880',
      ipNumber: 'IP-26-10002',
      name: 'Mr. Senthil Kumar',
      age: 59,
      gender: 'Male',
      ward: 'ICU',
      bed: '02',
      consultant: 'Dr. Lakshmi ICU HOD',
      admissionDaysAgo: 6,
    },
    title: 'Overnight potassium replacement omitted after shift handover',
    description:
      'Critical potassium of 2.8 mmol/L was reported at 21:40. Replacement ordered but not handed over at 22:00 night shift. Next ABG at 05:30 showed 2.6. No arrhythmia. Replacement given immediately.',
    immediateAction: 'Replacement given, cardiac monitoring, night team debriefed.',
    severity: 3,
    status: 'UNDER_INVESTIGATION',
    investigation: {
      status: 'IN_PROGRESS',
      dueOffsetDays: 4,
      facts: 'Verbal handover used a scrap paper list. HIS task list was not reviewed. Critical-result read-back not documented.',
      chronology: '21:40 critical K+ → 21:50 order → 22:00 handover missed → 05:30 repeat ABG.',
      peopleInterviewed: [
        { name: 'Nurse Kavitha ICU', designation: 'ICU Staff Nurse', statement: 'Outgoing nurse mentioned “pending labs” without naming potassium.' },
      ],
      contributingFactors: ['COMMUNICATION', 'PROCESS', 'HUMAN_FACTOR'],
      findings: 'Structured ISBAR handover not used for pending critical tasks.',
      recommendation: 'Mandatory HIS task review during ICU handover.',
    },
  },
  {
    seq: 13,
    daysAgo: 6,
    department: 'OT',
    reportingDepartment: 'OT',
    occurredInDepartment: 'OT',
    location: 'OT-SUITE-2',
    category: 'DOCUMENTATION_MEDICAL_RECORDS',
    subcategory: 'MISSING_RECORD',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401711',
      ipNumber: 'IP-26-09710',
      name: 'Mrs. Radha N',
      age: 52,
      gender: 'Female',
      ward: 'OT Holding',
      consultant: 'Dr. Venkat OT HOD',
      admissionDaysAgo: 6,
    },
    title: 'Signed surgical consent missing at OT receiving',
    description:
      'Patient arrived in OT Suite 2 for laparoscopic cholecystectomy without a signed consent in the file. Procedure delayed 40 minutes while consent was obtained from the ward.',
    immediateAction: 'Case held, consent completed, family updated on delay.',
    initialSeverity: 2,
    severity: 2,
    status: 'INFO_REQUESTED',
    infoRequests: [
      {
        question:
          'Please verify with Ward 302 whether the physical consent was signed and retained in the ward nursing file, or if patient was wheeled to OT without signing.',
        askedDaysAgo: 5,
      },
    ],
  },
  {
    seq: 14,
    daysAgo: 1,
    department: 'WARD',
    location: 'WARD-302',
    category: 'FACILITY_ENVIRONMENTAL_SAFETY',
    subcategory: 'WATER_LEAKAGE',
    patientInvolved: false,
    title: 'Ceiling leak above Ward 302 medication trolley',
    description:
      'Water dripping from AC drain onto the medication trolley after overnight rain. Two blister packs damp. No patient doses administered from wet stock.',
    immediateAction: 'Trolley moved, wet stock quarantined, housekeeping and maintenance informed, wet-floor signage.',
    severity: 1,
    status: 'SUBMITTED',
  },
  {
    seq: 15,
    daysAgo: 3,
    department: 'EMERGENCY',
    location: 'ER-BAY-1',
    category: 'SECURITY_WORKPLACE_SAFETY',
    subcategory: 'VIOLENCE',
    patientInvolved: false,
    title: 'Attendant verbal aggression towards ER triage nurse',
    description:
      'Attendant of a waiting patient shouted and attempted to push past triage when wait time exceeded 45 minutes. Security escorted the attendant. No physical injury.',
    immediateAction: 'Security called, staff rotated off triage, incident documented, CCTV retained.',
    severity: 3,
    status: 'ASSIGNED',
  },
  {
    seq: 16,
    daysAgo: 9,
    department: 'QUALITY',
    location: 'QUALITY-OFFICE',
    category: 'IT_SYSTEM_FAILURE',
    subcategory: 'HIS_DOWNTIME',
    patientInvolved: false,
    title: 'HIS downtime delayed medication administration records',
    description:
      'Hospital Information System unavailable for 73 minutes during evening peak. Paper downtime forms used. Two ICU administrations were charted late after recovery.',
    immediateAction: 'Downtime boxes opened, IT war-room started, verbal clinical updates continued.',
    severity: 3,
    status: 'CAPA_IN_PROGRESS',
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -2,
      facts: 'Application server patch restarted services without a communication to clinical areas.',
      chronology: '18:05 HIS down → 18:08 downtime announced on PA → 19:18 restored.',
      peopleInterviewed: [
        { name: 'Dr. Anita Quality Head', designation: 'Chief Quality Officer', statement: 'Change window was not booked in the ITSM calendar.' },
      ],
      contributingFactors: ['TECHNOLOGY', 'PROCESS', 'COMMUNICATION'],
      findings: 'Unscheduled patching without clinical change control.',
      recommendation: 'Mandatory change advisory for production HIS, with downtime kit drills.',
    },
    capas: [
      {
        seq: 6,
        type: 'CORRECTIVE',
        action: 'Enforce CAB approval for HIS production changes and quarterly downtime drills.',
        priority: 'HIGH',
        assignedDaysAgo: 7,
        targetOffsetDays: 10,
        status: 'OPEN',
      },
      {
        seq: 7,
        type: 'PREVENTIVE',
        action: 'Restock and seal downtime boxes in ER, ICU, OT and wards with dated checklist.',
        priority: 'MEDIUM',
        assignedDaysAgo: 7,
        targetOffsetDays: -1,
        status: 'OPEN',
      },
    ],
  },
  {
    seq: 17,
    daysAgo: 2,
    department: 'WARD',
    location: 'WARD-401',
    category: 'PATIENT_VISITOR_COMPLAINT',
    subcategory: 'SERVICE_DELAY',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2402055',
      ipNumber: 'IP-26-10330',
      name: 'Mrs. Kamala Devi',
      age: 70,
      gender: 'Female',
      ward: 'Ward 401',
      bed: '401-C',
      consultant: 'Dr. Meena Ward HOD',
      admissionDaysAgo: 4,
    },
    title: 'Family complaint about delayed discharge summary',
    description:
      'Patient medically fit for discharge at 11:00. Discharge summary ready only at 16:40. Family lodged a service complaint citing lost wages for the attendant.',
    immediateAction: 'Apology by ward in-charge, summary expedited, guest relations involved.',
    severity: 2,
    status: 'SUBMITTED',
  },
  {
    seq: 18,
    daysAgo: 20,
    department: 'PHARMACY',
    location: 'PHARM-CTR-1',
    category: 'MEDICATION_SAFETY',
    subcategory: 'WRONG_DRUG',
    patientInvolved: false,
    title: 'Near miss: look-alike vials almost issued to OT',
    description:
      'Phenylephrine and dexamethasone 1 ml vials were stored in the same OT emergency box. OT nurse noticed before drawing. No patient involved.',
    immediateAction: 'Vials segregated, look-alike stickers applied, all OT boxes checked the same shift.',
    severity: 1,
    status: 'CLOSED',
    requiresCapa: true,
    closedDaysAgo: 8,
    closureRemarks: 'Look-alike audit completed across OT and ICU emergency boxes. No further mismatches found.',
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -12,
      facts: 'Restock performed by night pharmacy using similar-size ampoules without tall-man lettering.',
      chronology: 'Night restock → morning OT check catch.',
      peopleInterviewed: [
        { name: 'Pharmacist Raj', designation: 'IPD Pharmacist', statement: 'Emergency boxes were restocked from a mixed crate.' },
      ],
      contributingFactors: ['ENVIRONMENT', 'PROCESS'],
      findings: 'Look-alike storage in emergency boxes without physical separation.',
      recommendation: 'Compartmentalised OT boxes and tall-man labels.',
    },
    capas: [
      {
        seq: 8,
        type: 'PREVENTIVE',
        action: 'Redesign OT emergency boxes with labelled compartments and monthly look-alike audit.',
        priority: 'MEDIUM',
        assignedDaysAgo: 16,
        targetOffsetDays: -6,
        status: 'EFFECTIVE',
        completionRemarks: 'New boxes issued to OT Suite 1 and 2.',
        completedDaysAgo: 10,
        verification: {
          verifiedBy: 'quality.anita',
          verifiedDaysAgo: 8,
          effective: true,
          remarks: 'Audit of all OT boxes satisfactory.',
        },
      },
    ],
  },
  {
    seq: 19,
    daysAgo: 6,
    department: 'ICU',
    location: 'ICU-BED-02',
    category: 'INFECTION_PREVENTION_CONTROL',
    subcategory: 'ISOLATION_BREACH',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401822',
      ipNumber: 'IP-26-09914',
      name: 'Mr. Dinesh B',
      age: 36,
      gender: 'Male',
      ward: 'ICU',
      bed: '02',
      consultant: 'Dr. Lakshmi ICU HOD',
      admissionDaysAgo: 8,
    },
    title: 'Contact isolation not followed for MDRO patient',
    description:
      'Visitor and two covering staff entered ICU Bed 02 without gown/gloves. Patient flagged MRSA on previous admission. Isolation card had fallen behind the monitor.',
    immediateAction: 'Isolation card re-posted, staff/visitor PPE enforced, IPC nurse informed.',
    severity: 3,
    status: 'UNDER_INVESTIGATION',
    investigation: {
      status: 'IN_PROGRESS',
      dueOffsetDays: 3,
      facts: 'HIS isolation flag exists but is not displayed on the ICU bed header. Card is paper-only.',
      chronology: 'Isolation known from previous admission → card fell → covering staff unaware.',
      peopleInterviewed: [
        { name: 'Nurse Kavitha ICU', designation: 'ICU Staff Nurse', statement: 'Bed header in HIS does not show MRSA flag.' },
      ],
      contributingFactors: ['PROCESS', 'COMMUNICATION', 'ENVIRONMENT'],
      findings: 'Reliance on a paper card without a digital bed-header alert.',
      recommendation: 'Hard isolation icon on ICU bed header and visitor briefing.',
    },
  },
  {
    seq: 20,
    daysAgo: 18,
    department: 'OT',
    location: 'OT-SUITE-1',
    category: 'FACILITY_ENVIRONMENTAL_SAFETY',
    subcategory: 'FIRE_SMOKE',
    patientInvolved: false,
    title: 'Smoke from cautery smoke evacuator during elective case',
    description:
      'Brief smoke smell from a faulty smoke evacuator filter in OT Suite 1. Case was at closing. No flame. Evacuator switched off, ventilation increased, biomedical replaced filter.',
    immediateAction: 'Equipment isolated, fire officer informed, filter replaced, theatre cleared for next case after air check.',
    severity: 1,
    status: 'CLOSED',
    closedDaysAgo: 11,
    closureRemarks: 'Filter inventory increased. No patient or staff harm. Preventive maintenance brought forward.',
  },
  {
    seq: 21,
    daysAgo: 11,
    department: 'LAB',
    location: 'LAB-PHLEBO-1',
    category: 'LABORATORY',
    subcategory: 'CRITICAL_RESULT_DELAY',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401501',
      ipNumber: 'IP-26-09302',
      name: 'Mr. Ibrahim S',
      age: 66,
      gender: 'Male',
      ward: 'Ward 302',
      bed: '302-A',
      consultant: 'Dr. Meena Ward HOD',
      admissionDaysAgo: 13,
    },
    title: 'Critical potassium result notified 48 minutes late',
    description:
      'Serum potassium 6.4 mmol/L auto-verified at 09:12. Critical call to ward only at 10:00 because the LIS critical-call queue was paused during analyser maintenance.',
    immediateAction: 'Ward notified, ECG done, treatment started, LIS queue restored.',
    severity: 4,
    status: 'UNDER_INVESTIGATION',
    requiresRca: true,
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -2,
      facts: 'Analyser maintenance mode suppressed auto-critical alerts. Manual call log not used.',
      chronology: '09:12 result → 09:12 alert suppressed → 10:00 technologist noticed backlog.',
      peopleInterviewed: [
        { name: 'Tech Anitha Lab', designation: 'Lab Technician', statement: 'We pause the queue during QC; there is no backup caller.' },
      ],
      contributingFactors: ['TECHNOLOGY', 'PROCESS', 'POLICY'],
      findings: 'No failover for critical callbacks during analyser maintenance.',
      recommendation: 'Never pause critical queue; assign a dedicated callback owner.',
    },
    rca: {
      method: 'BOTH',
      status: 'DRAFT',
      fiveWhy: [
        { sequence: 1, question: 'Why was the call delayed?', answer: 'Critical-call queue was paused.' },
        { sequence: 2, question: 'Why paused?', answer: 'Local practice during analyser QC.' },
        { sequence: 3, question: 'Why is that allowed?', answer: 'SOP does not forbid pausing the queue.' },
      ],
      fishbone: {
        process: ['QC workaround pauses alerts'],
        technology: ['No secondary SMS/HIS push for criticals'],
        policy: ['SOP silent on maintenance-mode callbacks'],
        people: ['Single technologist covering analyser and phones'],
      },
      rootCauseSummary: 'Critical notification failed because maintenance workaround pauses the only callback channel.',
    },
  },
  {
    seq: 22,
    daysAgo: 4,
    department: 'WARD',
    location: 'WARD-401',
    category: 'SECURITY_WORKPLACE_SAFETY',
    subcategory: 'PATIENT_ELOPEMENT',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401933',
      ipNumber: 'IP-26-10188',
      name: 'Mr. Murugan T',
      age: 41,
      gender: 'Male',
      ward: 'Ward 401',
      bed: '401-D',
      consultant: 'Dr. Meena Ward HOD',
      admissionDaysAgo: 5,
    },
    title: 'Confused patient found outside ward unattended',
    description:
      'Post-operative patient with known alcohol withdrawal was found near the hospital lobby in hospital gown. Bed alarm was not armed. Patient returned safely, no injury.',
    immediateAction: 'Patient returned, CIWA protocol restarted, sitter arranged, security review of CCTV.',
    severity: 3,
    status: 'ASSIGNED',
  },
  {
    seq: 23,
    daysAgo: 2,
    department: 'OT',
    location: 'OT-SUITE-2',
    category: 'MEDICAL_DEVICE_EQUIPMENT',
    subcategory: 'EQUIPMENT_UNAVAILABLE',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2402088',
      ipNumber: 'IP-26-10490',
      name: 'Mrs. Shanthi R',
      age: 39,
      gender: 'Female',
      ward: 'OT Holding',
      consultant: 'Dr. Venkat OT HOD',
      admissionDaysAgo: 2,
    },
    title: 'Laparoscopy camera stack unavailable — case delayed',
    description:
      'Elective laparoscopic case delayed 70 minutes because the only working camera stack was in Suite 1. Backup stack had an expired sterilisation label on the light cable.',
    immediateAction: 'Case delayed, backup cable replaced, family updated, biomedical asked for loaner.',
    severity: 2,
    status: 'SUBMITTED',
  },
  {
    seq: 24,
    daysAgo: 2,
    department: 'EMERGENCY',
    reportingDepartment: 'EMERGENCY',
    occurredInDepartment: 'EMERGENCY',
    location: 'ER-BAY-2',
    category: 'OTHER',
    subcategory: 'OTHER_REPORTABLE_INCIDENT',
    patientInvolved: false,
    title: 'Duplicate notice: unusual odour from medical gas alarm panel',
    description:
      'Staff reported a faint burning odour near the medical gas alarm panel. No alarm activated. Biomedical maintenance was already engaged on work order #4401.',
    immediateAction: 'Area ventilated, biomedical informed, panel not touched.',
    initialSeverity: 1,
    severity: 1,
    status: 'REJECTED',
    rejection: {
      reason:
        'Duplicate report. Facilities & Biomedical Engineering already logged work order #4401 for this sensor inspection; no clinical hazard or patient involvement.',
      daysAgo: 1,
    },
  },
  {
    seq: 25,
    daysAgo: 9,
    department: 'ICU',
    reportingDepartment: 'ICU',
    occurredInDepartment: 'ICU',
    location: 'ICU-BED-01',
    category: 'BLOOD_TRANSFUSION',
    subcategory: 'IDENTIFICATION_ERROR',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401600',
      ipNumber: 'IP-26-09550',
      name: 'Mr. Rajan K',
      age: 55,
      gender: 'Male',
      ward: 'ICU',
      bed: '01',
      consultant: 'Dr. Lakshmi ICU HOD',
      admissionDaysAgo: 11,
    },
    title: 'Sentinel near-event: blood unit brought for neighbouring bed',
    description:
      'PRBC unit labelled for ICU Bed 02 was carried to Bed 01. Bedside two-person check identified mismatch before spike. No transfusion started. Treated as sentinel near-event.',
    immediateAction: 'Unit returned to blood bank, both patients re-identified, transfusion SOP huddle held.',
    initialSeverity: 5,
    severity: 5,
    status: 'CLOSED',
    requiresRca: true,
    requiresCapa: true,
    closedDaysAgo: 2,
    closureRemarks:
      'Independent double-check reinforced. Porter pickup now uses bed-level barcode. Quality committee closed after CAPA verification.',
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -3,
      facts: 'Porter collected two units together. Bed 01 nurse accepted the bag without matching the pickup slip first.',
      chronology: '16:10 blood bank issue → 16:18 arrival ICU → 16:19 mismatch at bedside check.',
      peopleInterviewed: [
        { name: 'Nurse Kavitha ICU', designation: 'ICU Staff Nurse', statement: 'The two-person check worked. Pickup slip was for a different bed.' },
        { name: 'Dr. Anita Quality Head', designation: 'Chief Quality Officer', statement: 'This meets sentinel near-event criteria.' },
      ],
      contributingFactors: ['PROCESS', 'HUMAN_FACTOR', 'COMMUNICATION'],
      findings: 'Batch transport of units plus incomplete receipt check at the bedside.',
      recommendation: 'One unit per trip and barcode receipt at the bed.',
    },
    rca: {
      method: 'BOTH',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why was the wrong unit at the bed?', answer: 'Two units were carried together.' },
        { sequence: 2, question: 'Why together?', answer: 'Porter wanted one trip for both ICU beds.' },
        { sequence: 3, question: 'Why was that allowed?', answer: 'Transport SOP does not limit one unit per movement.' },
        { sequence: 4, question: 'Why did the nurse take the bag?', answer: 'Receipt check was done at the nursing station, not the bed.' },
        { sequence: 5, question: 'Why at the station?', answer: 'Training demonstrates station-level receipt, not bed-level.' },
      ],
      fishbone: {
        people: ['Porter batching units', 'Receipt away from the patient'],
        process: ['No one-unit-per-trip rule'],
        policy: ['Transport SOP silent on batching'],
        training: ['Bedside receipt not included in competency'],
        communication: ['Pickup slip not read aloud at the bed'],
      },
      rootCauseSummary:
        'A neighbouring-bed blood unit reached the bedside because transport allows batching and receipt check is performed away from the patient.',
    },
    capas: [
      {
        seq: 9,
        type: 'CORRECTIVE',
        action: 'Mandate one blood unit per porter trip and bed-level barcode receipt before hanging.',
        priority: 'CRITICAL',
        assignedDaysAgo: 7,
        targetOffsetDays: -1,
        status: 'EFFECTIVE',
        completionRemarks: 'SOP revised, porters and ICU nurses trained, barcode scanners at each ICU bed.',
        completedDaysAgo: 3,
        verification: {
          verifiedBy: 'quality.anita',
          verifiedDaysAgo: 2,
          effective: true,
          remarks: 'Direct observation of 5 transfusions: 100% bed-level barcode receipt.',
        },
      },
    ],
    closureSubmission: {
      summary:
        'Expanded RCA completed covering transport logistics; bedside barcode check implemented and verified.',
      daysAgo: 3,
    },
    qualityReviews: [
      {
        decision: 'RETURNED',
        remarks:
          'Initial RCA only focused on nurse verification. Need root cause analysis of why porter batch-transported two units simultaneously, and CAPA must include transport SOP revision.',
        daysAgo: 4,
      },
      {
        decision: 'ACCEPTED',
        remarks:
          'Transport SOP updated, one-unit-per-trip rule enforced, and bedside barcode verification confirmed 100% effective in audit.',
        daysAgo: 2,
      },
    ],
  },
  {
    seq: 26,
    daysAgo: 13,
    department: 'RADIOLOGY',
    reportingDepartment: 'RADIOLOGY',
    occurredInDepartment: 'RADIOLOGY',
    location: 'RAD-CT-1',
    category: 'RADIOLOGY_IMAGING',
    subcategory: 'RAD_WRONG_PATIENT',
    patientInvolved: true,
    patient: {
      uhid: 'UHID-2401470',
      ipNumber: 'OP-26-32801',
      name: 'Mr. Suresh Babu',
      age: 49,
      gender: 'Male',
      ward: 'CT Waiting',
      consultant: 'Radiology Consultant',
      admissionDaysAgo: 13,
    },
    title: 'Wrong patient called for non-contrast CT brain',
    description:
      'Two patients with similar names in waiting. Incorrect patient taken for CT brain. Scout image started, then identity mismatch found. No contrast given. Correct patient scanned afterwards.',
    immediateAction: 'Scan aborted, both patients re-identified, images discarded from PACS worklist, apology given.',
    initialSeverity: 3,
    severity: 3,
    status: 'CAPA_IN_PROGRESS',
    requiresRca: true,
    requiresCapa: true,
    investigation: {
      status: 'COMPLETED',
      dueOffsetDays: -5,
      facts: 'Calling by last name only. Wristband check skipped because patient was outpatient without band.',
      chronology: '11:00 call → 11:04 scout → 11:06 identity catch.',
      peopleInterviewed: [
        { name: 'Radiographer Bala', designation: 'CT Technologist', statement: 'We called “Mr. Suresh”. Two men stood up.' },
      ],
      contributingFactors: ['PROCESS', 'HUMAN_FACTOR', 'COMMUNICATION'],
      findings: 'OP radiology identification does not use two identifiers consistently.',
      recommendation: 'Call full name + UHID and verify ID proof at console.',
    },
    rca: {
      method: 'FIVE_WHY',
      status: 'COMPLETED',
      fiveWhy: [
        { sequence: 1, question: 'Why was the wrong patient scanned?', answer: 'Called by first name only.' },
        { sequence: 2, question: 'Why first name only?', answer: 'Waiting-area PA practice.' },
        { sequence: 3, question: 'Why is that the practice?', answer: 'No SOP for verbal two-identifier call in OP imaging.' },
      ],
      rootCauseSummary: 'Wrong patient was taken because OP imaging identification relies on first-name call-out.',
    },
    capas: [
      {
        seq: 10,
        type: 'CORRECTIVE',
        action: 'Implement two-identifier call-out (full name + UHID/Aadhaar) at all imaging modalities.',
        priority: 'HIGH',
        assignedDaysAgo: 9,
        targetOffsetDays: 5,
        status: 'OPEN',
      },
    ],
    closureSubmission: {
      summary:
        'Investigation and preliminary CAPA completed for OP waiting call-out; submitted for Quality review.',
      daysAgo: 4,
    },
    qualityReviews: [
      {
        decision: 'RETURNED',
        remarks:
          'Proposed CAPA only relies on verbal call-out diligence. Please revise CAPA to include mandatory photographic/Aadhaar identity verification at CT console and updated SOP for OP imaging reception before resubmitting.',
        daysAgo: 3,
      },
    ],
  },
];

type IdMap = Map<string, mongoose.Types.ObjectId>;

export async function seedDummyOperationalData(params: {
  userMap: IdMap;
  deptMap: IdMap;
  locationMap: IdMap;
  categoryMap: IdMap;
}): Promise<void> {
  const { userMap, deptMap, locationMap, categoryMap } = params;
  const year = new Date().getFullYear();
  let capaCount = 0;
  let investigationCount = 0;
  let rcaCount = 0;
  let notificationCount = 0;

  const requireId = (map: IdMap, key: string, kind: string): mongoose.Types.ObjectId => {
    const id = map.get(key);
    if (!id) {
      throw new Error(`Seed reference missing: ${kind} '${key}'`);
    }
    return id;
  };

  for (const def of INCIDENTS) {
    const incidentNumber = `INC-${year}-${def.seq.toString().padStart(6, '0')}`;
    const reportingDeptCode = def.reportingDepartment || def.department;
    const occurredInDeptCode = def.occurredInDepartment || def.department;
    const reportingDepartmentId = requireId(deptMap, reportingDeptCode, 'department');
    const occurredInDepartmentId = requireId(deptMap, occurredInDeptCode, 'department');
    const reportedBy = requireId(userMap, DEPARTMENT_STAFF[reportingDeptCode], 'user');

    const departmentId = requireId(deptMap, def.department, 'department');
    const departmentHodId = requireId(userMap, DEPARTMENT_HOD[def.department], 'user');
    const locationId = requireId(locationMap, def.location, 'location');
    const categoryId = requireId(categoryMap, def.category, 'category');
    const incidentDateTime = daysAgo(def.daysAgo, 8 + (def.seq % 10));
    const reportedAt = daysAgo(Math.max(def.daysAgo - 0, 0), 11 + (def.seq % 6));

    const patient = def.patient
      ? {
          ...def.patient,
          admissionDate: def.patient.admissionDaysAgo != null ? daysAgo(def.patient.admissionDaysAgo, 9) : undefined,
          source: 'MANUAL' as const,
        }
      : undefined;

    // In these statuses Quality has not assigned a responsible department yet
    const assigned = !['SUBMITTED', 'INFO_REQUESTED', 'REJECTED'].includes(def.status);
    const qualityId = requireId(userMap, 'quality.anita', 'user');
    const assignedAt = daysAgo(Math.max(def.daysAgo - 1, 0), 12);
    const submittedForReview = ['PENDING_QUALITY_REVIEW', 'CLOSED'].includes(def.status);
    const closedAt = def.closedDaysAgo != null ? daysAgo(def.closedDaysAgo, 16) : undefined;

    let assignments: any[] = [];
    if (def.assignments && def.assignments.length > 0) {
      assignments = def.assignments.map((a) => {
        const aDeptId = requireId(deptMap, a.department, 'department');
        const aHodId = requireId(userMap, a.hodUser || DEPARTMENT_HOD[a.department], 'user');
        return {
          departmentId: aDeptId,
          hodUserId: aHodId,
          severity: a.severity ?? def.severity,
          remarks: a.remarks,
          by: qualityId,
          at: daysAgo(a.daysAgo ?? Math.max(def.daysAgo - 1, 0), 12),
        };
      });
    } else if (assigned) {
      assignments = [
        {
          departmentId,
          hodUserId: departmentHodId,
          severity: def.severity,
          by: qualityId,
          at: assignedAt,
        },
      ];
    }

    const hodReturns = def.hodReturns
      ? def.hodReturns.map((hr) => ({
          reason: hr.reason,
          by: requireId(userMap, hr.hodUser || DEPARTMENT_HOD[hr.department || def.department], 'user'),
          at: daysAgo(hr.daysAgo, 14),
        }))
      : [];

    const infoRequests = def.infoRequests
      ? def.infoRequests.map((ir) => ({
          question: ir.question,
          askedBy: qualityId,
          askedAt: daysAgo(ir.askedDaysAgo, 12),
          response: ir.response,
          respondedBy: ir.response ? reportedBy : undefined,
          respondedAt: ir.response && ir.respondedDaysAgo != null ? daysAgo(ir.respondedDaysAgo, 14) : undefined,
        }))
      : def.status === 'INFO_REQUESTED'
      ? [{ question: 'Please confirm the exact time and who else was present.', askedBy: qualityId, askedAt: assignedAt }]
      : [];

    const rejection =
      def.status === 'REJECTED'
        ? {
            reason: def.rejection?.reason || 'Duplicate of an earlier report.',
            by: qualityId,
            at: daysAgo(def.rejection?.daysAgo ?? Math.max(def.daysAgo - 1, 0), 12),
          }
        : undefined;

    let qualityReviews: any[] = [];
    if (def.qualityReviews && def.qualityReviews.length > 0) {
      qualityReviews = def.qualityReviews.map((qr) => ({
        decision: qr.decision,
        remarks: qr.remarks,
        by: qualityId,
        at: daysAgo(qr.daysAgo ?? def.daysAgo, 15),
      }));
    } else if (def.status === 'CLOSED') {
      qualityReviews = [
        {
          decision: 'ACCEPTED',
          remarks: def.closureRemarks || 'CAPA effective.',
          by: qualityId,
          at: closedAt ?? daysAgo(0, 10),
        },
      ];
    }

    const closureSubmission = submittedForReview
      ? {
          summary:
            def.closureSubmission?.summary ||
            def.closureRemarks ||
            'Investigation and CAPA completed; submitted for Quality review.',
          by: departmentHodId,
          at: daysAgo(def.closureSubmission?.daysAgo ?? def.closedDaysAgo ?? 0, 9),
        }
      : undefined;

    const incident = await Incident.findOneAndUpdate(
      { incidentNumber },
      {
        $set: {
          incidentNumber,
          reportedBy,
          reportedAt,
          incidentDateTime,
          reportingDepartmentId,
          occurredInDepartmentId,
          ...(assigned
            ? { departmentId, assignedHod: departmentHodId, assignedBy: qualityId, assignedAt }
            : {}),
          assignments,
          infoRequests,
          ...(rejection ? { rejection } : {}),
          ...(closureSubmission ? { closureSubmission } : {}),
          qualityReviews,
          hodReturns,
          initialSeverity: def.initialSeverity ?? def.severity,
          locationId,
          categoryId,
          subcategoryCode: def.subcategory,
          patientInvolved: def.patientInvolved,
          patient,
          title: def.title,
          description: def.description,
          immediateAction: def.immediateAction,
          severity: def.severity,
          severityLabel: SEVERITY_LABELS[def.severity] || 'Near Miss',
          status: def.status,
          requiresRca: Boolean(def.requiresRca),
          requiresCapa: Boolean(def.requiresCapa),
          escalationLevel: def.severity >= 4 ? 1 : 0,
          escalatedAt: def.severity >= 4 ? reportedAt : undefined,
          ...(def.status === 'CLOSED' ? { closureRemarks: def.closureRemarks, closedAt, closedBy: qualityId } : {}),
        },
        $unset: {
          investigatorId: '',
          ...(assigned ? {} : { departmentId: '', assignedHod: '', assignedBy: '', assignedAt: '' }),
          ...(def.status === 'REJECTED' ? {} : { rejection: '' }),
          ...(closureSubmission ? {} : { closureSubmission: '' }),
          ...(def.status === 'CLOSED' ? {} : { closureRemarks: '', closedAt: '', closedBy: '' }),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (def.investigation) {
      const inv = def.investigation;
      await Investigation.findOneAndUpdate(
        { incidentId: incident._id },
        {
          incidentId: incident._id,
          investigatorId: departmentHodId,
          startedAt: daysAgo(Math.max(def.daysAgo - 1, 0), 12),
          dueDate: daysFromNow(inv.dueOffsetDays),
          completedAt: inv.status === 'COMPLETED' ? daysAgo(Math.max(def.daysAgo - 3, 0), 15) : undefined,
          facts: inv.facts,
          chronology: inv.chronology,
          peopleInterviewed: inv.peopleInterviewed,
          contributingFactors: inv.contributingFactors,
          immediateCorrections: inv.immediateCorrections,
          findings: inv.findings,
          recommendation: inv.recommendation,
          status: inv.status,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      investigationCount += 1;
    }

    let rcaId: mongoose.Types.ObjectId | undefined;
    if (def.rca) {
      const investigation = await Investigation.findOne({ incidentId: incident._id });
      const rca = await RootCauseAnalysis.findOneAndUpdate(
        { incidentId: incident._id },
        {
          incidentId: incident._id,
          investigationId: investigation?._id,
          method: def.rca.method,
          fiveWhy: def.rca.fiveWhy,
          fishbone: def.rca.fishbone || {},
          rootCauseSummary: def.rca.rootCauseSummary,
          status: def.rca.status,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      rcaId = rca._id as mongoose.Types.ObjectId;
      rcaCount += 1;
    }

    if (def.capas?.length) {
      for (const capa of def.capas) {
        const capaNumber = `CAPA-${year}-${capa.seq.toString().padStart(6, '0')}`;
        await Capa.findOneAndUpdate(
          { capaNumber },
          {
            capaNumber,
            incidentId: incident._id,
            rcaId,
            type: capa.type,
            action: capa.action,
            ownerUserId: departmentHodId,
            ownerDepartmentId: departmentId,
            priority: capa.priority,
            assignedDate: daysAgo(capa.assignedDaysAgo, 11),
            targetDate: daysFromNow(capa.targetOffsetDays),
            status: capa.status,
            completionRemarks: capa.completionRemarks,
            completedAt: capa.completedDaysAgo != null ? daysAgo(capa.completedDaysAgo, 16) : undefined,
            verification: capa.verification
              ? {
                  verifiedBy: requireId(userMap, capa.verification.verifiedBy, 'user'),
                  verifiedAt: daysAgo(capa.verification.verifiedDaysAgo, 17),
                  effective: capa.verification.effective,
                  remarks: capa.verification.remarks,
                }
              : undefined,
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        capaCount += 1;
      }
    }

    const existingAudit = await AuditLog.findOne({ entityId: incident._id, action: 'SEED_INCIDENT_CREATED' });
    if (!existingAudit) {
      await AuditLog.create({
        userId: reportedBy,
        action: 'SEED_INCIDENT_CREATED',
        entityType: 'INCIDENT',
        entityId: incident._id,
        newValue: { incidentNumber, status: def.status, severity: def.severity },
        timestamp: reportedAt,
      });
    }
  }

  await Counter.findOneAndUpdate(
    { name: `incident_${year}` },
    { $max: { seq: INCIDENTS.length } },
    { upsert: true, new: true }
  );
  await Counter.findOneAndUpdate(
    { name: `capa_${year}` },
    { $max: { seq: 10 } },
    { upsert: true, new: true }
  );

  await Notification.deleteMany({ type: { $regex: /^SEED_/ } });

  const notifications: Array<{
    user: string;
    type: string;
    title: string;
    message: string;
    entityType: string;
    incidentSeq: number;
    read: boolean;
    daysAgo: number;
  }> = [
    {
      user: 'quality.anita',
      type: 'SEED_INCIDENT_SUBMITTED',
      title: 'New incident awaiting triage',
      message: 'INC elderly patient fall in ER Bay 1 has been submitted and needs quality triage.',
      entityType: 'INCIDENT',
      incidentSeq: 1,
      read: false,
      daysAgo: 1,
    },
    {
      user: 'quality.anita',
      type: 'SEED_SENTINEL',
      title: 'Severity 5 incident closed after CAPA',
      message: 'Sentinel near-event (wrong blood unit at neighbouring ICU bed) is closed after verified CAPA.',
      entityType: 'INCIDENT',
      incidentSeq: 25,
      read: true,
      daysAgo: 2,
    },
    {
      user: 'hod.emergency',
      type: 'SEED_HOD_ASSIGNED',
      title: 'Incident assigned to Emergency',
      message: 'Trauma patient arrived without identification wristband was assigned to your department.',
      entityType: 'INCIDENT',
      incidentSeq: 3,
      read: false,
      daysAgo: 3,
    },
    {
      user: 'hod.radiology',
      type: 'SEED_CAPA_RETURNED',
      title: 'Quality returned incident for revised CAPA',
      message: 'CT scan patient-ID CAPA needs independent verification mechanism before re-submission.',
      entityType: 'INCIDENT',
      incidentSeq: 26,
      read: false,
      daysAgo: 1,
    },
    {
      user: 'hod.emergency',
      type: 'SEED_INVESTIGATION',
      title: 'Investigation in progress',
      message: 'Stroke thrombolysis delay in Emergency requires RCA completion.',
      entityType: 'INCIDENT',
      incidentSeq: 4,
      read: false,
      daysAgo: 4,
    },
    {
      user: 'nurse.john',
      type: 'SEED_RETURNED',
      title: 'More information requested',
      message: 'OT consent incident was returned for information: please check with Ward 302.',
      entityType: 'INCIDENT',
      incidentSeq: 13,
      read: false,
      daysAgo: 5,
    },
    {
      user: 'quality.anita',
      type: 'SEED_CAPA_OVERDUE',
      title: 'CAPA overdue',
      message: 'Weekly phlebotomy observational audit CAPA is past its target date.',
      entityType: 'CAPA',
      incidentSeq: 6,
      read: false,
      daysAgo: 1,
    },
    {
      user: 'quality.anita',
      type: 'SEED_CAPA_VERIFY',
      title: 'CAPA pending verification',
      message: 'Contrast-allergy CAPA is pending quality verification.',
      entityType: 'INCIDENT',
      incidentSeq: 7,
      read: false,
      daysAgo: 2,
    },
    {
      user: 'admin',
      type: 'SEED_MANAGEMENT',
      title: 'Critical incidents this week',
      message: 'Two severity 5 events are on the safety register (wrong-site mark and blood unit near-event).',
      entityType: 'INCIDENT',
      incidentSeq: 5,
      read: false,
      daysAgo: 1,
    },
    {
      user: 'admin',
      type: 'SEED_AUDIT',
      title: 'Records available for audit',
      message: 'Closed CAPA and RCA records for look-alike medication and transfusion near-event are ready for review.',
      entityType: 'INCIDENT',
      incidentSeq: 18,
      read: true,
      daysAgo: 3,
    },
  ];

  for (const n of notifications) {
    const incidentNumber = `INC-${year}-${n.incidentSeq.toString().padStart(6, '0')}`;
    const incident = await Incident.findOne({ incidentNumber });
    const created = await Notification.create({
      userId: requireId(userMap, n.user, 'user'),
      type: n.type,
      title: n.title,
      message: n.message,
      entityType: n.entityType,
      entityId: incident?._id,
      read: n.read,
      readAt: n.read ? daysAgo(n.daysAgo, 18) : undefined,
      deliveryChannels: ['IN_APP'],
      createdAt: daysAgo(n.daysAgo, 13),
    });
    if (created) notificationCount += 1;
  }

  logger.info(
    `✅ Dummy operational data seeded (${INCIDENTS.length} incidents, ${investigationCount} investigations, ${rcaCount} RCAs, ${capaCount} CAPAs, ${notificationCount} notifications)`
  );
}
