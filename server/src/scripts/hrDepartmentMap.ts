// HR department name (from the employee export) -> standard department code.
// null = no matching department; the staff member picks one on their first login.
// Keys are normalised: lower case, single spaces. 'Judgement call' marks mappings to double-check.
export const HR_DEPARTMENT_MAP: Record<string, string | null> = {
  'nursing services': 'RD_NURSING_SERVICES', // Nursing Services
  'intern': null, // staff picks on first login
  'house keeping': 'RD_HOUSEKEEPING', // Housekeeping
  'information technology dept': 'RD_INFORMATION_TECHNOLOGY_DEPARTMENT', // Information Technology Department
  'operations': 'RD_OPERATIONS', // Operations
  'anaesthesiology': 'RD_ANAESTHESIOLOGY', // Anaesthesiology
  'billing': 'RD_BILLING', // Billing
  'pharmacy': 'RD_PHARMACY', // Pharmacy
  'laboratory': 'RD_LABORATORY_MEDICINE', // Laboratory Medicine
  'general medicine': 'RD_GENERAL_MEDICINE', // General Medicine
  'ophthalmology': 'RD_OPHTHALMOLOGY', // Ophthalmology
  'electrical': 'RD_ELECTRICAL', // Electrical
  'nephrology': 'RD_NEPHROLOGY', // Nephrology
  'radiology': 'RD_RADIOLOGY', // Radiology
  'maintenence': 'RD_MAINTENANCE', // Maintenance
  'housekeeping': 'RD_HOUSEKEEPING', // Housekeeping
  'central laboratory': 'RD_LABORATORY_MEDICINE', // Laboratory Medicine
  'transportation': 'RD_TRANSPORTATION', // Transportation
  'general surgery': 'RD_GENERAL_SURGERY', // General Surgery
  'icu': 'RD_INTENSIVE_CARE_SERVICES',  // judgement call // Intensive Care Services
  'cardiology': 'RD_CARDIOLOGY', // Cardiology
  'blood bank': 'RD_TRANSFUSION_MEDICINE_AND_BLOOD_BANK', // Transfusion Medicine and Blood Bank
  'maintanance': 'RD_MAINTENANCE', // Maintenance
  'orthopaedics': 'RD_ORTHOPAEDICS', // Orthopaedics
  'obstetrics and gynaecology': 'RD_OBSTETRICS_AND_GYNAECOLOGY', // Obstetrics and Gynaecology
  'emergency': 'RD_EMERGENCY_MEDICINE',  // judgement call // Emergency Medicine
  'emergency medicine': 'RD_EMERGENCY_MEDICINE', // Emergency Medicine
  'laundry': 'RD_LAUNDRY', // Laundry
  'marketing': 'RD_MARKETING', // Marketing
  'psychiatry': 'RD_PSYCHIATRY', // Psychiatry
  'paediatrics': 'RD_PAEDIATRICS', // Paediatrics
  'quality': 'RD_QUALITY_DEPARTMENT', // Quality Department
  'medical record department': 'RD_MEDICAL_RECORDS_DEPARTMENT', // Medical Records Department
  'otorhinolaryngology (ent)': 'RD_ENT_OTORHINOLARYNGOLOGY', // ENT / Otorhinolaryngology
  'information technology': 'RD_INFORMATION_TECHNOLOGY_DEPARTMENT', // Information Technology Department
  'biomedical': 'RD_BIOMEDICAL_ENGINEERING', // Biomedical Engineering
  'cssd': 'RD_CSSD', // CSSD
  'gummidipoondi centre': 'RD_OTHER_OUTREACH_OR_SATELLITE_CENTRES',  // judgement call // Other outreach or satellite centres
  'operation theatre': 'RD_OPERATION_THEATRE', // Operation Theatre
  'uthiramerur center': 'RD_UTHIRAMERUR_CENTRE', // Uthiramerur Centre
  'administration': 'RD_HOSPITAL_ADMINISTRATION', // Hospital Administration
  'dermatology': 'RD_DERMATOLOGY', // Dermatology
  'human resources': 'RD_HUMAN_RESOURCES', // Human Resources
  'laundary': 'RD_LAUNDRY', // Laundry
  'neurosurgery': 'RD_NEUROSURGERY', // Neurosurgery
  'nutrition and dietetics': 'RD_NUTRITION_AND_DIETETICS', // Nutrition and Dietetics
  'safety': 'RD_FIRE_AND_SAFETY',  // judgement call // Fire and Safety
  'dietary': 'RD_DIETARY_SERVICES', // Dietary Services
  'mrd': 'RD_MEDICAL_RECORDS_DEPARTMENT', // Medical Records Department
  'purchase & store': 'RD_PURCHASE_DEPARTMENT',  // judgement call // Purchase Department
  'account and finance': 'RD_ACCOUNTS_AND_FINANCE', // Accounts and Finance
  'accounts': 'RD_ACCOUNTS_AND_FINANCE', // Accounts and Finance
  'human resource': 'RD_HUMAN_RESOURCES', // Human Resources
  'pharmacy store': 'RD_PHARMACY_STORE', // Pharmacy Store
  'urology': 'RD_UROLOGY', // Urology
  'administrator': 'RD_HOSPITAL_ADMINISTRATION', // Hospital Administration
  'biochemistry': 'RD_BIOCHEMISTRY', // Biochemistry
  'clinicalpathology': 'RD_CLINICAL_PATHOLOGY', // Clinical Pathology
  'general stores': 'RD_GENERAL_STORES', // General Stores
  'inpatient billing': 'RD_INPATIENT_BILLING', // Inpatient Billing
  'maintenance': 'RD_MAINTENANCE', // Maintenance
  'microbiology': 'RD_MICROBIOLOGY', // Microbiology
  'physiotherapy': 'RD_PHYSIOTHERAPY', // Physiotherapy
  '': null, // staff picks on first login
  'administrative': 'RD_HOSPITAL_ADMINISTRATION', // Hospital Administration
  'canteen': 'RD_CANTEEN', // Canteen
  'cardiothoracic & vascular surgery': 'RD_CARDIOTHORACIC_AND_VASCULAR_SURGERY', // Cardiothoracic and Vascular Surgery
  'dental': 'RD_DENTAL', // Dental
  'dialysis': 'RD_NEPHROLOGY',  // judgement call // Nephrology
  'facility management & safety': 'RD_FACILITY_MANAGEMENT', // Facility Management
  'female ortho ward': 'RD_SPECIALTY_WARDS',  // judgement call // Specialty Wards
  'glucometer': null, // staff picks on first login
  'histopathology': 'RD_HISTOPATHOLOGY', // Histopathology
  'hospital reception': 'RD_FRONT_OFFICE_RECEPTION', // Front Office / Reception
  'human resource department': 'RD_HUMAN_RESOURCES', // Human Resources
  'inventory': 'RD_INVENTORY', // Inventory
  'junior resident': null, // staff picks on first login
  'medical records unit- -mrd': 'RD_MEDICAL_RECORDS_DEPARTMENT', // Medical Records Department
  'neurology': 'RD_NEUROLOGY', // Neurology
  'ns office': 'RD_NURSING_SERVICES',  // judgement call // Nursing Services
  'omfs': 'RD_ORAL_AND_MAXILLOFACIAL_SURGERY', // Oral and Maxillofacial Surgery
  'ot': 'RD_OPERATION_THEATRE', // Operation Theatre
  'pathology': 'RD_PATHOLOGY', // Pathology
  'plastic surgery': 'RD_PLASTIC_AND_RECONSTRUCTIVE_SURGERY', // Plastic and Reconstructive Surgery
  'respiratory medicine': 'RD_PULMONOLOGY_RESPIRATORY_MEDICINE', // Pulmonology / Respiratory Medicine
  'skill lab': 'RD_SKILL_LAB', // Skill Lab
  'super speciality': null, // staff picks on first login
  'training and development': 'RD_TRAINING_AND_DEVELOPMENT', // Training and Development
  'ward': 'RD_GENERAL_WARDS', // General Wards
  'ward secretary': 'RD_WARD_SECRETARIAT', // Ward Secretariat
};
