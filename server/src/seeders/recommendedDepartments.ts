// Hospital department taxonomy, from Recommended_Department_Categories.md (repo root).
// Seeded as additional Department records alongside the 8 demo departments the seed users,
// locations and demo incidents already reference — this list is additive, not a replacement.
//
// A few names are intentionally cross-listed under more than one category in the source
// document (e.g. "Emergency Medicine" is both a medical specialty and an emergency service).
// Each is seeded once, under its first-listed category; dedupeByName() below does that.

interface RawDepartment {
  category: string;
  name: string;
}

const RAW: RawDepartment[] = [
  // 1. Clinical — Medical Specialties
  ...[
    'Cardiology',
    'Clinical Pharmacology',
    'Community Medicine',
    'Critical Care / Intensive Medicine',
    'Dermatology',
    'Diabetology',
    'Emergency Medicine',
    'Endocrinology and Metabolism',
    'Gastroenterology',
    'General Medicine',
    'Geriatric Medicine',
    'Hepatology',
    'Medical Oncology',
    'Neonatology',
    'Nephrology',
    'Neurology',
    'Nuclear Medicine',
    'Paediatrics',
    'Psychiatry',
    'Pulmonology / Respiratory Medicine',
    'Rheumatology',
    'Tuberculosis and Chest Medicine',
  ].map((name) => ({ category: 'Clinical — Medical Specialties', name })),

  // 2. Clinical — Surgical Specialties
  ...[
    'Anaesthesiology',
    'Arthroscopy',
    'Cardiothoracic and Vascular Surgery',
    'ENT / Otorhinolaryngology',
    'General Surgery',
    'Joint Replacement',
    'Laparoscopic Surgery',
    'Neurosurgery',
    'Ophthalmology',
    'Oral and Maxillofacial Surgery',
    'Orthopaedics',
    'Paediatric Surgery',
    'Plastic and Reconstructive Surgery',
    'Surgical Gastroenterology',
    'Surgical Oncology',
    'Urology',
    'Vascular and Endovascular Surgery',
  ].map((name) => ({ category: 'Clinical — Surgical Specialties', name })),

  // 3. Women and Child Health
  ...[
    'Obstetrics and Gynaecology',
    'Fertility / Reproductive Medicine',
    'Neonatology',
    'Paediatrics',
    'Paediatric Surgery',
    'Paediatric Dentistry',
  ].map((name) => ({ category: 'Women and Child Health', name })),

  // 4. Dental Services
  ...[
    'Dental',
    'Oral and Maxillofacial Surgery',
    'Orthodontics',
    'Paediatric Dentistry / Pedodontics',
    'Maxillofacial Prosthodontics',
  ].map((name) => ({ category: 'Dental Services', name })),

  // 5. Allied Health and Rehabilitation
  ...[
    'Physiotherapy',
    'Physical Medicine and Rehabilitation',
    'Occupational Therapy',
    'Nutrition and Dietetics',
    'Dietary Services',
    'Opticals',
  ].map((name) => ({ category: 'Allied Health and Rehabilitation', name })),

  // 6. Emergency and Pre-Hospital Services
  ...['Accident and Emergency / Casualty', 'Emergency Medicine', 'Ambulance Services'].map((name) => ({
    category: 'Emergency and Pre-Hospital Services',
    name,
  })),

  // 7. Diagnostics — Laboratory and Blood Services
  ...[
    'Laboratory Medicine',
    'Biochemistry',
    'Clinical Pathology',
    'Cytology',
    'Haematology',
    'Histopathology',
    'Microbiology',
    'Molecular Biology',
    'Molecular Pathology',
    'Pathology',
    'Serology',
    'Phlebotomy',
    'Transfusion Medicine and Blood Bank',
  ].map((name) => ({ category: 'Diagnostics — Laboratory and Blood Services', name })),

  // 8. Diagnostics — Imaging and Cardiac Diagnostics
  ...[
    'Radiology',
    'CT Scan',
    'MRI',
    'X-Ray',
    'Ultrasound',
    'Mammography',
    'Echocardiography',
    'Stress Test Unit',
    'Cath Lab',
  ].map((name) => ({ category: 'Diagnostics — Imaging and Cardiac Diagnostics', name })),

  // 9. Nursing and Inpatient Services
  ...[
    'Nursing Services',
    'General Wards',
    'Specialty Wards',
    'Private Wards / Private Rooms',
    'Intensive Care Services',
    'Ward Secretariat',
    'Injection and Dressing Services',
  ].map((name) => ({ category: 'Nursing and Inpatient Services', name })),

  // 10. Operation Theatre and Procedure Services
  ...[
    'Operation Theatre',
    'Minor Operation Theatre',
    'Emergency Operation Theatre',
    'Obstetrics and Gynaecology OT',
    'Preoperative Unit',
    'Postoperative Unit',
    'Endoscopy',
    'CSSD',
  ].map((name) => ({ category: 'Operation Theatre and Procedure Services', name })),

  // 11. Pharmacy and Materials Management
  ...[
    'Pharmacy',
    'Pharmacy Store',
    'Drugs and Disposables',
    'Purchase Department',
    'Central Stores',
    'General Stores',
    'Paramedical Stores',
    'Linen Stores',
    'Stationery Stores',
    'Inventory',
  ].map((name) => ({ category: 'Pharmacy and Materials Management', name })),

  // 12. Patient Administration and Revenue Services
  ...[
    'Front Office / Reception',
    'OPD Front Office',
    'IPD Front Office',
    'Billing',
    'Inpatient Billing',
    'Accounts and Finance',
    'Health Insurance / Government Scheme Desk',
    'Master Health Check-up',
    'Medical Records Department',
  ].map((name) => ({ category: 'Patient Administration and Revenue Services', name })),

  // 13. Hospital Administration and Governance
  ...[
    'Hospital Administration',
    "Medical Director's Office",
    'Operations',
    'Quality Department',
    'Human Resources',
    'Training and Development',
    'Marketing',
    'Skill Lab',
  ].map((name) => ({ category: 'Hospital Administration and Governance', name })),

  // 14. Facility, Engineering, and Safety Services
  ...[
    'Facility Management',
    'Maintenance',
    'Electrical',
    'HVAC',
    'Plumbing',
    'Biomedical Engineering',
    'Fire and Safety',
    'Security',
    'Transportation',
  ].map((name) => ({ category: 'Facility, Engineering, and Safety Services', name })),

  // 15. Hospitality and Environmental Services
  ...['Housekeeping', 'Laundry', 'Linen Services', 'Food and Beverage Services', 'Canteen'].map((name) => ({
    category: 'Hospitality and Environmental Services',
    name,
  })),

  // 16. Information Technology
  ...[
    'Information Technology Department',
    'HIS / Application Support',
    'Network and Infrastructure',
    'Cybersecurity',
    'Helpdesk',
  ].map((name) => ({ category: 'Information Technology', name })),

  // 17. Outreach and Satellite Services
  ...['Uthiramerur Centre', 'Uthiramerur Specialty Clinic', 'Prime Clinic', 'Other outreach or satellite centres'].map(
    (name) => ({ category: 'Outreach and Satellite Services', name })
  ),
];

/** First occurrence wins, preserving the category the name was originally listed under. */
const dedupeByName = (rows: RawDepartment[]): RawDepartment[] => {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
};

/** "Pulmonology / Respiratory Medicine" → "RD_PULMONOLOGY_RESPIRATORY_MEDICINE". */
const codeFor = (name: string): string =>
  'RD_' +
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export interface RecommendedDepartment {
  code: string;
  name: string;
  category: string;
}

export const RECOMMENDED_DEPARTMENTS: RecommendedDepartment[] = dedupeByName(RAW).map(({ category, name }) => ({
  code: codeFor(name),
  name,
  category,
}));
