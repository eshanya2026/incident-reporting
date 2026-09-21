/**
 * Hospital Incident Categories & Subcategories Master Data
 * Extracted from docs/Hospital_Incident_Categories_and_Subcategories.md
 */

export interface CategorySeedDef {
  code: string;
  name: string;
  domain: string;
  order: number;
  subcategories: Array<{ code: string; name: string; active: boolean }>;
}

export const HOSPITAL_CATEGORIES: CategorySeedDef[] = [
  {
    "code": "PATIENT_IDENTIFICATION",
    "name": "Patient Identification",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 1,
    "subcategories": [
      {
        "code": "MISSING_OR_INCORRECT_IDENTIFICATION_BAND",
        "name": "Missing or incorrect identification band",
        "active": true
      },
      {
        "code": "WRONG_PATIENT_TREATMENT_OR_PROCEDURE",
        "name": "Wrong-patient treatment or procedure",
        "active": true
      },
      {
        "code": "WRONG_PATIENT_RECORD_SELECTED",
        "name": "Wrong patient record selected",
        "active": true
      },
      {
        "code": "DUPLICATE_PATIENT_REGISTRATION",
        "name": "Duplicate patient registration",
        "active": true
      },
      {
        "code": "INCORRECTLY_MERGED_PATIENT_RECORDS",
        "name": "Incorrectly merged patient records",
        "active": true
      },
      {
        "code": "UNIDENTIFIED_PATIENT",
        "name": "Unidentified patient",
        "active": true
      },
      {
        "code": "PATIENT_IDENTITY_NOT_VERIFIED_BEFORE_CARE",
        "name": "Patient identity not verified before care",
        "active": true
      }
    ]
  },
  {
    "code": "MEDICATION_ERROR",
    "name": "Medication Error",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 2,
    "subcategories": [
      {
        "code": "WRONG_PATIENT",
        "name": "Wrong patient",
        "active": true
      },
      {
        "code": "WRONG_MEDICINE",
        "name": "Wrong medicine",
        "active": true
      },
      {
        "code": "WRONG_DOSE_OR_STRENGTH",
        "name": "Wrong dose or strength",
        "active": true
      },
      {
        "code": "WRONG_ROUTE",
        "name": "Wrong route",
        "active": true
      },
      {
        "code": "WRONG_TIME_OR_FREQUENCY",
        "name": "Wrong time or frequency",
        "active": true
      },
      {
        "code": "OMITTED_OR_MISSED_DOSE",
        "name": "Omitted or missed dose",
        "active": true
      },
      {
        "code": "DUPLICATE_DOSE",
        "name": "Duplicate dose",
        "active": true
      },
      {
        "code": "INCORRECT_INFUSION_RATE",
        "name": "Incorrect infusion rate",
        "active": true
      },
      {
        "code": "PRESCRIBING_ERROR",
        "name": "Prescribing error",
        "active": true
      },
      {
        "code": "TRANSCRIPTION_ERROR",
        "name": "Transcription error",
        "active": true
      },
      {
        "code": "DISPENSING_ERROR",
        "name": "Dispensing error",
        "active": true
      },
      {
        "code": "ADMINISTRATION_ERROR",
        "name": "Administration error",
        "active": true
      },
      {
        "code": "MONITORING_ERROR",
        "name": "Monitoring error",
        "active": true
      },
      {
        "code": "CONTRAINDICATED_MEDICINE",
        "name": "Contraindicated medicine",
        "active": true
      },
      {
        "code": "KNOWN_ALLERGY_OVERLOOKED",
        "name": "Known allergy overlooked",
        "active": true
      },
      {
        "code": "DRUG_INTERACTION_OVERLOOKED",
        "name": "Drug interaction overlooked",
        "active": true
      },
      {
        "code": "EXPIRED_OR_DAMAGED_MEDICINE_USED",
        "name": "Expired or damaged medicine used",
        "active": true
      },
      {
        "code": "LOOK_ALIKE_SOUND_ALIKE_MEDICINE_ERROR",
        "name": "Look-alike/sound-alike medicine error",
        "active": true
      },
      {
        "code": "MEDICATION_RECONCILIATION_FAILURE",
        "name": "Medication reconciliation failure",
        "active": true
      }
    ]
  },
  {
    "code": "ADVERSE_DRUG_REACTION",
    "name": "Adverse Drug Reaction",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 3,
    "subcategories": [
      {
        "code": "ALLERGIC_REACTION",
        "name": "Allergic reaction",
        "active": true
      },
      {
        "code": "ANAPHYLAXIS",
        "name": "Anaphylaxis",
        "active": true
      },
      {
        "code": "SEVERE_SKIN_REACTION",
        "name": "Severe skin reaction",
        "active": true
      },
      {
        "code": "UNEXPECTED_BLEEDING",
        "name": "Unexpected bleeding",
        "active": true
      },
      {
        "code": "EXCESSIVE_SEDATION",
        "name": "Excessive sedation",
        "active": true
      },
      {
        "code": "DRUG_TOXICITY",
        "name": "Drug toxicity",
        "active": true
      },
      {
        "code": "ADVERSE_REACTION_REQUIRING_TREATMENT",
        "name": "Adverse reaction requiring treatment",
        "active": true
      },
      {
        "code": "SUSPECTED_PREVIOUSLY_UNKNOWN_REACTION",
        "name": "Suspected previously unknown reaction",
        "active": true
      }
    ]
  },
  {
    "code": "PATIENT_FALL_AND_ACCIDENTAL_INJURY",
    "name": "Patient Fall and Accidental Injury",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 4,
    "subcategories": [
      {
        "code": "FALL_FROM_BED",
        "name": "Fall from bed",
        "active": true
      },
      {
        "code": "FALL_FROM_WHEELCHAIR_OR_STRETCHER",
        "name": "Fall from wheelchair or stretcher",
        "active": true
      },
      {
        "code": "FALL_IN_TOILET_OR_BATHROOM",
        "name": "Fall in toilet or bathroom",
        "active": true
      },
      {
        "code": "FALL_WHILE_WALKING",
        "name": "Fall while walking",
        "active": true
      },
      {
        "code": "SLIP_OR_TRIP",
        "name": "Slip or trip",
        "active": true
      },
      {
        "code": "FALL_DURING_TRANSFER",
        "name": "Fall during transfer",
        "active": true
      },
      {
        "code": "BED_RAIL_ENTRAPMENT",
        "name": "Bed-rail entrapment",
        "active": true
      },
      {
        "code": "INJURY_DURING_PATIENT_LIFTING_OR_POSITIONING",
        "name": "Injury during patient lifting or positioning",
        "active": true
      },
      {
        "code": "OTHER_ACCIDENTAL_PATIENT_INJURY",
        "name": "Other accidental patient injury",
        "active": true
      }
    ]
  },
  {
    "code": "PRESSURE_INJURY_AND_SKIN_DAMAGE",
    "name": "Pressure Injury and Skin Damage",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 5,
    "subcategories": [
      {
        "code": "HOSPITAL_ACQUIRED_PRESSURE_INJURY",
        "name": "Hospital-acquired pressure injury",
        "active": true
      },
      {
        "code": "WORSENING_OF_EXISTING_PRESSURE_INJURY",
        "name": "Worsening of existing pressure injury",
        "active": true
      },
      {
        "code": "MEDICAL_DEVICE_RELATED_PRESSURE_INJURY",
        "name": "Medical-device-related pressure injury",
        "active": true
      },
      {
        "code": "ADHESIVE_RELATED_SKIN_INJURY",
        "name": "Adhesive-related skin injury",
        "active": true
      },
      {
        "code": "SKIN_TEAR",
        "name": "Skin tear",
        "active": true
      },
      {
        "code": "MOISTURE_ASSOCIATED_SKIN_DAMAGE",
        "name": "Moisture-associated skin damage",
        "active": true
      },
      {
        "code": "BURN_FROM_HEATING_OR_WARMING_DEVICE",
        "name": "Burn from heating or warming device",
        "active": true
      },
      {
        "code": "OTHER_TREATMENT_RELATED_SKIN_DAMAGE",
        "name": "Other treatment-related skin damage",
        "active": true
      }
    ]
  },
  {
    "code": "DIAGNOSIS_AND_ASSESSMENT",
    "name": "Diagnosis and Assessment",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 6,
    "subcategories": [
      {
        "code": "MISSED_DIAGNOSIS",
        "name": "Missed diagnosis",
        "active": true
      },
      {
        "code": "DELAYED_DIAGNOSIS",
        "name": "Delayed diagnosis",
        "active": true
      },
      {
        "code": "WRONG_DIAGNOSIS",
        "name": "Wrong diagnosis",
        "active": true
      },
      {
        "code": "INCOMPLETE_CLINICAL_ASSESSMENT",
        "name": "Incomplete clinical assessment",
        "active": true
      },
      {
        "code": "FAILURE_TO_REVIEW_ABNORMAL_RESULT",
        "name": "Failure to review abnormal result",
        "active": true
      },
      {
        "code": "INCORRECT_INTERPRETATION_OF_RESULT",
        "name": "Incorrect interpretation of result",
        "active": true
      },
      {
        "code": "FAILURE_TO_ORDER_REQUIRED_INVESTIGATION",
        "name": "Failure to order required investigation",
        "active": true
      },
      {
        "code": "DELAY_IN_SPECIALIST_REVIEW",
        "name": "Delay in specialist review",
        "active": true
      },
      {
        "code": "FAILURE_TO_REASSESS_PATIENT",
        "name": "Failure to reassess patient",
        "active": true
      }
    ]
  },
  {
    "code": "DELAYED_OR_OMITTED_CARE",
    "name": "Delayed or Omitted Care",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 7,
    "subcategories": [
      {
        "code": "TREATMENT_OMITTED",
        "name": "Treatment omitted",
        "active": true
      },
      {
        "code": "TREATMENT_DELAYED",
        "name": "Treatment delayed",
        "active": true
      },
      {
        "code": "INVESTIGATION_DELAYED",
        "name": "Investigation delayed",
        "active": true
      },
      {
        "code": "CONSULTATION_DELAYED",
        "name": "Consultation delayed",
        "active": true
      },
      {
        "code": "SURGERY_OR_PROCEDURE_DELAYED",
        "name": "Surgery or procedure delayed",
        "active": true
      },
      {
        "code": "INCORRECT_TRIAGE_PRIORITY",
        "name": "Incorrect triage priority",
        "active": true
      },
      {
        "code": "CARE_DELAYED_DUE_TO_UNAVAILABLE_BED",
        "name": "Care delayed due to unavailable bed",
        "active": true
      },
      {
        "code": "CARE_DELAYED_DUE_TO_UNAVAILABLE_STAFF",
        "name": "Care delayed due to unavailable staff",
        "active": true
      },
      {
        "code": "CARE_DELAYED_DUE_TO_UNAVAILABLE_MEDICINE_EQUI",
        "name": "Care delayed due to unavailable medicine, equipment, or consumable",
        "active": true
      },
      {
        "code": "FAILURE_TO_ESCALATE_CARE",
        "name": "Failure to escalate care",
        "active": true
      }
    ]
  },
  {
    "code": "MONITORING_AND_EMERGENCY_RESPONSE",
    "name": "Monitoring and Emergency Response",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 8,
    "subcategories": [
      {
        "code": "PATIENT_DETERIORATION_NOT_RECOGNISED",
        "name": "Patient deterioration not recognised",
        "active": true
      },
      {
        "code": "REQUIRED_OBSERVATIONS_MISSED",
        "name": "Required observations missed",
        "active": true
      },
      {
        "code": "INCORRECT_OBSERVATION_RECORDED",
        "name": "Incorrect observation recorded",
        "active": true
      },
      {
        "code": "MONITOR_ALARM_IGNORED_OR_DISABLED",
        "name": "Monitor alarm ignored or disabled",
        "active": true
      },
      {
        "code": "ABNORMAL_VITAL_SIGN_NOT_ESCALATED",
        "name": "Abnormal vital sign not escalated",
        "active": true
      },
      {
        "code": "EMERGENCY_CALL_NOT_RECEIVED_OR_DELAYED",
        "name": "Emergency call not received or delayed",
        "active": true
      },
      {
        "code": "CODE_BLUE_RESPONSE_DELAYED",
        "name": "Code Blue response delayed",
        "active": true
      },
      {
        "code": "RESUSCITATION_EQUIPMENT_UNAVAILABLE",
        "name": "Resuscitation equipment unavailable",
        "active": true
      },
      {
        "code": "RESUSCITATION_EQUIPMENT_INCOMPLETE_OR_DEFECTI",
        "name": "Resuscitation equipment incomplete or defective",
        "active": true
      },
      {
        "code": "FAILURE_TO_FOLLOW_EARLY_WARNING_SCORE_PROTOCO",
        "name": "Failure to follow early-warning-score protocol",
        "active": true
      }
    ]
  },
  {
    "code": "SURGERY_AND_INVASIVE_PROCEDURE",
    "name": "Surgery and Invasive Procedure",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 9,
    "subcategories": [
      {
        "code": "WRONG_PATIENT",
        "name": "Wrong patient",
        "active": true
      },
      {
        "code": "WRONG_PROCEDURE",
        "name": "Wrong procedure",
        "active": true
      },
      {
        "code": "WRONG_BODY_SITE_OR_SIDE",
        "name": "Wrong body site or side",
        "active": true
      },
      {
        "code": "RETAINED_SURGICAL_ITEM",
        "name": "Retained surgical item",
        "active": true
      },
      {
        "code": "SURGICAL_COUNT_DISCREPANCY",
        "name": "Surgical count discrepancy",
        "active": true
      },
      {
        "code": "WRONG_IMPLANT_OR_PROSTHESIS",
        "name": "Wrong implant or prosthesis",
        "active": true
      },
      {
        "code": "UNINTENDED_ORGAN_OR_TISSUE_INJURY",
        "name": "Unintended organ or tissue injury",
        "active": true
      },
      {
        "code": "PROCEDURE_PERFORMED_WITHOUT_VALID_CONSENT",
        "name": "Procedure performed without valid consent",
        "active": true
      },
      {
        "code": "UNPLANNED_RETURN_TO_OPERATING_THEATRE",
        "name": "Unplanned return to operating theatre",
        "active": true
      },
      {
        "code": "SURGICAL_SPECIMEN_LOST_OR_MISLABELLED",
        "name": "Surgical specimen lost or mislabelled",
        "active": true
      },
      {
        "code": "SURGICAL_SAFETY_CHECKLIST_INCOMPLETE",
        "name": "Surgical safety checklist incomplete",
        "active": true
      },
      {
        "code": "POST_PROCEDURE_COMPLICATION_REQUIRING_REVIEW",
        "name": "Post-procedure complication requiring review",
        "active": true
      }
    ]
  },
  {
    "code": "ANAESTHESIA_AND_SEDATION",
    "name": "Anaesthesia and Sedation",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 10,
    "subcategories": [
      {
        "code": "ANAESTHETIC_MEDICINE_ERROR",
        "name": "Anaesthetic medicine error",
        "active": true
      },
      {
        "code": "DIFFICULT_OR_FAILED_AIRWAY",
        "name": "Difficult or failed airway",
        "active": true
      },
      {
        "code": "UNPLANNED_INTUBATION",
        "name": "Unplanned intubation",
        "active": true
      },
      {
        "code": "INADEQUATE_MONITORING",
        "name": "Inadequate monitoring",
        "active": true
      },
      {
        "code": "EXCESSIVE_OR_PROLONGED_SEDATION",
        "name": "Excessive or prolonged sedation",
        "active": true
      },
      {
        "code": "AWARENESS_DURING_ANAESTHESIA",
        "name": "Awareness during anaesthesia",
        "active": true
      },
      {
        "code": "DELAYED_RECOGNITION_OF_RESPIRATORY_COMPROMISE",
        "name": "Delayed recognition of respiratory compromise",
        "active": true
      },
      {
        "code": "ANAESTHESIA_EQUIPMENT_FAILURE",
        "name": "Anaesthesia equipment failure",
        "active": true
      },
      {
        "code": "ADVERSE_EVENT_DURING_RECOVERY",
        "name": "Adverse event during recovery",
        "active": true
      },
      {
        "code": "INADEQUATE_PRE_ANAESTHETIC_ASSESSMENT",
        "name": "Inadequate pre-anaesthetic assessment",
        "active": true
      }
    ]
  },
  {
    "code": "BLOOD_AND_BLOOD_PRODUCTS",
    "name": "Blood and Blood Products",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 11,
    "subcategories": [
      {
        "code": "WRONG_PATIENT",
        "name": "Wrong patient",
        "active": true
      },
      {
        "code": "WRONG_BLOOD_COMPONENT",
        "name": "Wrong blood component",
        "active": true
      },
      {
        "code": "COMPATIBILITY_CHECK_FAILURE",
        "name": "Compatibility-check failure",
        "active": true
      },
      {
        "code": "BLOOD_GROUP_MISMATCH",
        "name": "Blood group mismatch",
        "active": true
      },
      {
        "code": "SUSPECTED_TRANSFUSION_REACTION",
        "name": "Suspected transfusion reaction",
        "active": true
      },
      {
        "code": "TRANSFUSION_DELAYED",
        "name": "Transfusion delayed",
        "active": true
      },
      {
        "code": "INCORRECT_TRANSFUSION_RATE",
        "name": "Incorrect transfusion rate",
        "active": true
      },
      {
        "code": "STORAGE_TEMPERATURE_BREACH",
        "name": "Storage-temperature breach",
        "active": true
      },
      {
        "code": "BLOOD_PRODUCT_WASTED_OR_DAMAGED",
        "name": "Blood product wasted or damaged",
        "active": true
      },
      {
        "code": "TRACEABILITY_OR_DOCUMENTATION_FAILURE",
        "name": "Traceability or documentation failure",
        "active": true
      },
      {
        "code": "TRANSFUSION_WITHOUT_VALID_CONSENT",
        "name": "Transfusion without valid consent",
        "active": true
      }
    ]
  },
  {
    "code": "HEALTHCARE_ASSOCIATED_INFECTION",
    "name": "Healthcare-Associated Infection",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 12,
    "subcategories": [
      {
        "code": "SURGICAL_SITE_INFECTION",
        "name": "Surgical-site infection",
        "active": true
      },
      {
        "code": "CATHETER_ASSOCIATED_URINARY_TRACT_INFECTION",
        "name": "Catheter-associated urinary tract infection",
        "active": true
      },
      {
        "code": "CENTRAL_LINE_ASSOCIATED_BLOODSTREAM_INFECTION",
        "name": "Central-line-associated bloodstream infection",
        "active": true
      },
      {
        "code": "VENTILATOR_ASSOCIATED_INFECTION",
        "name": "Ventilator-associated infection",
        "active": true
      },
      {
        "code": "HOSPITAL_ACQUIRED_PNEUMONIA",
        "name": "Hospital-acquired pneumonia",
        "active": true
      },
      {
        "code": "HOSPITAL_ACQUIRED_GASTROINTESTINAL_INFECTION",
        "name": "Hospital-acquired gastrointestinal infection",
        "active": true
      },
      {
        "code": "DEVICE_ASSOCIATED_INFECTION",
        "name": "Device-associated infection",
        "active": true
      },
      {
        "code": "INFECTION_CONTROL_PRECAUTION_BREACH",
        "name": "Infection-control precaution breach",
        "active": true
      },
      {
        "code": "ISOLATION_FAILURE",
        "name": "Isolation failure",
        "active": true
      },
      {
        "code": "SUSPECTED_OUTBREAK_OR_CLUSTER",
        "name": "Suspected outbreak or cluster",
        "active": true
      },
      {
        "code": "EXPOSURE_DUE_TO_INADEQUATE_HAND_HYGIENE",
        "name": "Exposure due to inadequate hand hygiene",
        "active": true
      }
    ]
  },
  {
    "code": "LINES_TUBES_DRAINS_AND_CATHETERS",
    "name": "Lines, Tubes, Drains, and Catheters",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 13,
    "subcategories": [
      {
        "code": "ACCIDENTAL_REMOVAL_OR_DISLODGEMENT",
        "name": "Accidental removal or dislodgement",
        "active": true
      },
      {
        "code": "INCORRECT_PLACEMENT",
        "name": "Incorrect placement",
        "active": true
      },
      {
        "code": "WRONG_CONNECTION",
        "name": "Wrong connection",
        "active": true
      },
      {
        "code": "BLOCKAGE_OR_OCCLUSION",
        "name": "Blockage or occlusion",
        "active": true
      },
      {
        "code": "LEAKAGE_OR_DISCONNECTION",
        "name": "Leakage or disconnection",
        "active": true
      },
      {
        "code": "IV_INFILTRATION_OR_EXTRAVASATION",
        "name": "IV infiltration or extravasation",
        "active": true
      },
      {
        "code": "FEEDING_THROUGH_INCORRECTLY_POSITIONED_TUBE",
        "name": "Feeding through incorrectly positioned tube",
        "active": true
      },
      {
        "code": "DEVICE_ASSOCIATED_INJURY",
        "name": "Device-associated injury",
        "active": true
      },
      {
        "code": "FAILURE_TO_CLAMP_SECURE_OR_LABEL",
        "name": "Failure to clamp, secure, or label",
        "active": true
      },
      {
        "code": "DELAYED_REMOVAL",
        "name": "Delayed removal",
        "active": true
      }
    ]
  },
  {
    "code": "NUTRITION_HYDRATION_AND_FEEDING",
    "name": "Nutrition, Hydration, and Feeding",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 14,
    "subcategories": [
      {
        "code": "WRONG_DIET_SUPPLIED",
        "name": "Wrong diet supplied",
        "active": true
      },
      {
        "code": "FOOD_ALLERGEN_EXPOSURE",
        "name": "Food allergen exposure",
        "active": true
      },
      {
        "code": "MISSED_OR_DELAYED_FEED",
        "name": "Missed or delayed feed",
        "active": true
      },
      {
        "code": "FEEDING_DESPITE_FASTING_INSTRUCTION",
        "name": "Feeding despite fasting instruction",
        "active": true
      },
      {
        "code": "ASPIRATION_DURING_FEEDING",
        "name": "Aspiration during feeding",
        "active": true
      },
      {
        "code": "INCORRECT_ENTERAL_FEED",
        "name": "Incorrect enteral feed",
        "active": true
      },
      {
        "code": "INCORRECT_PARENTERAL_NUTRITION",
        "name": "Incorrect parenteral nutrition",
        "active": true
      },
      {
        "code": "INCORRECT_FLUID_TYPE_OR_VOLUME",
        "name": "Incorrect fluid type or volume",
        "active": true
      },
      {
        "code": "DEHYDRATION_DUE_TO_INADEQUATE_INTAKE",
        "name": "Dehydration due to inadequate intake",
        "active": true
      },
      {
        "code": "FEEDING_TUBE_RELATED_ERROR",
        "name": "Feeding-tube-related error",
        "active": true
      }
    ]
  },
  {
    "code": "HANDOVER_TRANSFER_AND_DISCHARGE",
    "name": "Handover, Transfer, and Discharge",
    "domain": "1. Clinical and Patient-Care Incidents",
    "order": 15,
    "subcategories": [
      {
        "code": "INCOMPLETE_CLINICAL_HANDOVER",
        "name": "Incomplete clinical handover",
        "active": true
      },
      {
        "code": "ALLERGY_OMITTED_DURING_HANDOVER",
        "name": "Allergy omitted during handover",
        "active": true
      },
      {
        "code": "PENDING_RESULT_NOT_COMMUNICATED",
        "name": "Pending result not communicated",
        "active": true
      },
      {
        "code": "INCORRECT_PATIENT_TRANSFERRED",
        "name": "Incorrect patient transferred",
        "active": true
      },
      {
        "code": "TRANSFER_WITHOUT_REQUIRED_OXYGEN_MONITOR_OR_E",
        "name": "Transfer without required oxygen, monitor, or escort",
        "active": true
      },
      {
        "code": "DELAY_IN_PATIENT_TRANSFER",
        "name": "Delay in patient transfer",
        "active": true
      },
      {
        "code": "WRONG_DISCHARGE_MEDICINE",
        "name": "Wrong discharge medicine",
        "active": true
      },
      {
        "code": "INCOMPLETE_DISCHARGE_SUMMARY",
        "name": "Incomplete discharge summary",
        "active": true
      },
      {
        "code": "INADEQUATE_FOLLOW_UP_INSTRUCTIONS",
        "name": "Inadequate follow-up instructions",
        "active": true
      },
      {
        "code": "DISCHARGE_AGAINST_REQUIRED_CLINICAL_PROCESS",
        "name": "Discharge against required clinical process",
        "active": true
      },
      {
        "code": "PATIENT_BELONGINGS_LOST_DURING_TRANSFER",
        "name": "Patient belongings lost during transfer",
        "active": true
      }
    ]
  },
  {
    "code": "LABORATORY_AND_PATHOLOGY",
    "name": "Laboratory and Pathology",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 16,
    "subcategories": [
      {
        "code": "WRONG_PATIENT_SPECIMEN",
        "name": "Wrong-patient specimen",
        "active": true
      },
      {
        "code": "MISSING_OR_INCORRECT_SPECIMEN_LABEL",
        "name": "Missing or incorrect specimen label",
        "active": true
      },
      {
        "code": "INCORRECT_SPECIMEN_CONTAINER",
        "name": "Incorrect specimen container",
        "active": true
      },
      {
        "code": "INSUFFICIENT_OR_UNSUITABLE_SPECIMEN",
        "name": "Insufficient or unsuitable specimen",
        "active": true
      },
      {
        "code": "SPECIMEN_CONTAMINATED",
        "name": "Specimen contaminated",
        "active": true
      },
      {
        "code": "SPECIMEN_LOST_OR_DAMAGED",
        "name": "Specimen lost or damaged",
        "active": true
      },
      {
        "code": "SPECIMEN_TRANSPORT_DELAY",
        "name": "Specimen transport delay",
        "active": true
      },
      {
        "code": "INCORRECT_TEST_PERFORMED",
        "name": "Incorrect test performed",
        "active": true
      },
      {
        "code": "INCORRECT_RESULT_OR_UNIT_REPORTED",
        "name": "Incorrect result or unit reported",
        "active": true
      },
      {
        "code": "RESULT_ASSIGNED_TO_WRONG_PATIENT",
        "name": "Result assigned to wrong patient",
        "active": true
      },
      {
        "code": "CRITICAL_RESULT_NOT_COMMUNICATED",
        "name": "Critical result not communicated",
        "active": true
      },
      {
        "code": "DELAYED_RESULT",
        "name": "Delayed result",
        "active": true
      },
      {
        "code": "QUALITY_CONTROL_FAILURE",
        "name": "Quality-control failure",
        "active": true
      },
      {
        "code": "REAGENT_OR_ANALYSER_FAILURE",
        "name": "Reagent or analyser failure",
        "active": true
      },
      {
        "code": "HISTOPATHOLOGY_SPECIMEN_OR_SLIDE_MISMATCH",
        "name": "Histopathology specimen or slide mismatch",
        "active": true
      }
    ]
  },
  {
    "code": "RADIOLOGY_AND_IMAGING",
    "name": "Radiology and Imaging",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 17,
    "subcategories": [
      {
        "code": "WRONG_PATIENT_SCANNED",
        "name": "Wrong patient scanned",
        "active": true
      },
      {
        "code": "WRONG_BODY_PART_OR_SIDE_SCANNED",
        "name": "Wrong body part or side scanned",
        "active": true
      },
      {
        "code": "WRONG_IMAGING_PROTOCOL",
        "name": "Wrong imaging protocol",
        "active": true
      },
      {
        "code": "UNINTENDED_OR_EXCESSIVE_RADIATION_EXPOSURE",
        "name": "Unintended or excessive radiation exposure",
        "active": true
      },
      {
        "code": "PREGNANCY_SCREENING_FAILURE",
        "name": "Pregnancy screening failure",
        "active": true
      },
      {
        "code": "CONTRAST_REACTION",
        "name": "Contrast reaction",
        "active": true
      },
      {
        "code": "CONTRAST_EXTRAVASATION",
        "name": "Contrast extravasation",
        "active": true
      },
      {
        "code": "RENAL_RISK_ASSESSMENT_FAILURE",
        "name": "Renal-risk assessment failure",
        "active": true
      },
      {
        "code": "MRI_IMPLANT_SCREENING_FAILURE",
        "name": "MRI implant-screening failure",
        "active": true
      },
      {
        "code": "FERROMAGNETIC_OBJECT_IN_MRI_AREA",
        "name": "Ferromagnetic object in MRI area",
        "active": true
      },
      {
        "code": "IMAGING_REPORT_ASSIGNED_TO_WRONG_PATIENT",
        "name": "Imaging report assigned to wrong patient",
        "active": true
      },
      {
        "code": "CRITICAL_IMAGING_FINDING_NOT_COMMUNICATED",
        "name": "Critical imaging finding not communicated",
        "active": true
      },
      {
        "code": "IMAGING_DELAY",
        "name": "Imaging delay",
        "active": true
      },
      {
        "code": "IMAGE_OR_REPORT_LOST",
        "name": "Image or report lost",
        "active": true
      }
    ]
  },
  {
    "code": "MATERNITY_AND_LABOUR_ROOM",
    "name": "Maternity and Labour Room",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 18,
    "subcategories": [
      {
        "code": "MATERNAL_DETERIORATION_NOT_RECOGNISED",
        "name": "Maternal deterioration not recognised",
        "active": true
      },
      {
        "code": "DELAY_IN_RESPONDING_TO_FETAL_DISTRESS",
        "name": "Delay in responding to fetal distress",
        "active": true
      },
      {
        "code": "DELAY_IN_RESPONDING_TO_MATERNAL_BLEEDING",
        "name": "Delay in responding to maternal bleeding",
        "active": true
      },
      {
        "code": "DELAYED_EMERGENCY_DELIVERY",
        "name": "Delayed emergency delivery",
        "active": true
      },
      {
        "code": "LABOUR_MEDICATION_ERROR",
        "name": "Labour medication error",
        "active": true
      },
      {
        "code": "BIRTH_INJURY",
        "name": "Birth injury",
        "active": true
      },
      {
        "code": "POSTPARTUM_HAEMORRHAGE_REQUIRING_REVIEW",
        "name": "Postpartum haemorrhage requiring review",
        "active": true
      },
      {
        "code": "ECLAMPSIA_OR_HYPERTENSION_MANAGEMENT_INCIDENT",
        "name": "Eclampsia or hypertension-management incident",
        "active": true
      },
      {
        "code": "RETAINED_SWAB_OR_INSTRUMENT",
        "name": "Retained swab or instrument",
        "active": true
      },
      {
        "code": "MOTHER_BABY_IDENTIFICATION_MISMATCH",
        "name": "Mother-baby identification mismatch",
        "active": true
      },
      {
        "code": "INCOMPLETE_MATERNAL_OR_FETAL_MONITORING",
        "name": "Incomplete maternal or fetal monitoring",
        "active": true
      },
      {
        "code": "OBSTETRIC_EMERGENCY_ESCALATION_FAILURE",
        "name": "Obstetric emergency escalation failure",
        "active": true
      }
    ]
  },
  {
    "code": "NEONATAL_AND_PAEDIATRIC_CARE",
    "name": "Neonatal and Paediatric Care",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 19,
    "subcategories": [
      {
        "code": "NEWBORN_IDENTIFICATION_MISMATCH",
        "name": "Newborn identification mismatch",
        "active": true
      },
      {
        "code": "NEWBORN_FALL",
        "name": "Newborn fall",
        "active": true
      },
      {
        "code": "INCORRECT_WEIGHT_BASED_DOSE",
        "name": "Incorrect weight-based dose",
        "active": true
      },
      {
        "code": "WRONG_EXPRESSED_BREAST_MILK",
        "name": "Wrong expressed breast milk",
        "active": true
      },
      {
        "code": "FEEDING_ERROR",
        "name": "Feeding error",
        "active": true
      },
      {
        "code": "INCUBATOR_OR_WARMER_MALFUNCTION",
        "name": "Incubator or warmer malfunction",
        "active": true
      },
      {
        "code": "TEMPERATURE_CONTROL_FAILURE",
        "name": "Temperature-control failure",
        "active": true
      },
      {
        "code": "NEONATAL_RESUSCITATION_DELAY",
        "name": "Neonatal resuscitation delay",
        "active": true
      },
      {
        "code": "PAEDIATRIC_DETERIORATION_NOT_RECOGNISED",
        "name": "Paediatric deterioration not recognised",
        "active": true
      },
      {
        "code": "SAFEGUARDING_CONCERN",
        "name": "Safeguarding concern",
        "active": true
      },
      {
        "code": "VACCINATION_ERROR",
        "name": "Vaccination error",
        "active": true
      },
      {
        "code": "NEONATAL_TRANSFER_INCIDENT",
        "name": "Neonatal transfer incident",
        "active": true
      }
    ]
  },
  {
    "code": "ICU_AND_CRITICAL_CARE",
    "name": "ICU and Critical Care",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 20,
    "subcategories": [
      {
        "code": "VENTILATOR_DISCONNECTION",
        "name": "Ventilator disconnection",
        "active": true
      },
      {
        "code": "INCORRECT_VENTILATOR_SETTINGS",
        "name": "Incorrect ventilator settings",
        "active": true
      },
      {
        "code": "UNPLANNED_EXTUBATION",
        "name": "Unplanned extubation",
        "active": true
      },
      {
        "code": "FAILED_OR_DELAYED_INTUBATION",
        "name": "Failed or delayed intubation",
        "active": true
      },
      {
        "code": "INFUSION_INTERRUPTION",
        "name": "Infusion interruption",
        "active": true
      },
      {
        "code": "CRITICAL_ALARM_DISABLED_OR_IGNORED",
        "name": "Critical alarm disabled or ignored",
        "active": true
      },
      {
        "code": "HAEMODYNAMIC_DETERIORATION_NOT_ESCALATED",
        "name": "Haemodynamic deterioration not escalated",
        "active": true
      },
      {
        "code": "CRITICAL_CARE_EQUIPMENT_FAILURE",
        "name": "Critical-care equipment failure",
        "active": true
      },
      {
        "code": "MEDICATION_OR_VASOPRESSOR_ERROR",
        "name": "Medication or vasopressor error",
        "active": true
      },
      {
        "code": "CENTRAL_LINE_OR_INVASIVE_MONITORING_INCIDENT",
        "name": "Central-line or invasive-monitoring incident",
        "active": true
      },
      {
        "code": "DELAYED_ICU_ADMISSION_OR_TRANSFER",
        "name": "Delayed ICU admission or transfer",
        "active": true
      }
    ]
  },
  {
    "code": "DIALYSIS",
    "name": "Dialysis",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 21,
    "subcategories": [
      {
        "code": "WRONG_PATIENT_OR_DIALYSIS_PRESCRIPTION",
        "name": "Wrong patient or dialysis prescription",
        "active": true
      },
      {
        "code": "INCORRECT_TREATMENT_SETTINGS",
        "name": "Incorrect treatment settings",
        "active": true
      },
      {
        "code": "EXCESSIVE_OR_INSUFFICIENT_FLUID_REMOVAL",
        "name": "Excessive or insufficient fluid removal",
        "active": true
      },
      {
        "code": "DIALYSIS_WATER_CONTAMINATION",
        "name": "Dialysis-water contamination",
        "active": true
      },
      {
        "code": "BLOOD_LEAK",
        "name": "Blood leak",
        "active": true
      },
      {
        "code": "AIR_EMBOLISM_RISK_OR_EVENT",
        "name": "Air embolism risk or event",
        "active": true
      },
      {
        "code": "ACCESS_NEEDLE_DISLODGEMENT",
        "name": "Access-needle dislodgement",
        "active": true
      },
      {
        "code": "VASCULAR_ACCESS_INJURY",
        "name": "Vascular-access injury",
        "active": true
      },
      {
        "code": "ANTICOAGULATION_ERROR",
        "name": "Anticoagulation error",
        "active": true
      },
      {
        "code": "DIALYSIS_EQUIPMENT_FAILURE",
        "name": "Dialysis equipment failure",
        "active": true
      },
      {
        "code": "INFECTION_CONTROL_BREACH",
        "name": "Infection-control breach",
        "active": true
      },
      {
        "code": "TREATMENT_INTERRUPTION",
        "name": "Treatment interruption",
        "active": true
      }
    ]
  },
  {
    "code": "ONCOLOGY_AND_RADIOTHERAPY",
    "name": "Oncology and Radiotherapy",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 22,
    "subcategories": [
      {
        "code": "WRONG_CHEMOTHERAPY_PATIENT",
        "name": "Wrong chemotherapy patient",
        "active": true
      },
      {
        "code": "WRONG_REGIMEN_OR_MEDICINE",
        "name": "Wrong regimen or medicine",
        "active": true
      },
      {
        "code": "WRONG_CHEMOTHERAPY_DOSE",
        "name": "Wrong chemotherapy dose",
        "active": true
      },
      {
        "code": "WRONG_ROUTE_OR_SCHEDULE",
        "name": "Wrong route or schedule",
        "active": true
      },
      {
        "code": "CHEMOTHERAPY_EXTRAVASATION",
        "name": "Chemotherapy extravasation",
        "active": true
      },
      {
        "code": "TOXICITY_MONITORING_MISSED",
        "name": "Toxicity monitoring missed",
        "active": true
      },
      {
        "code": "CYTOTOXIC_SPILL_OR_EXPOSURE",
        "name": "Cytotoxic spill or exposure",
        "active": true
      },
      {
        "code": "WRONG_RADIOTHERAPY_PATIENT",
        "name": "Wrong radiotherapy patient",
        "active": true
      },
      {
        "code": "WRONG_RADIOTHERAPY_SITE",
        "name": "Wrong radiotherapy site",
        "active": true
      },
      {
        "code": "WRONG_RADIATION_DOSE_OR_FRACTION",
        "name": "Wrong radiation dose or fraction",
        "active": true
      },
      {
        "code": "TREATMENT_PLANNING_ERROR",
        "name": "Treatment-planning error",
        "active": true
      },
      {
        "code": "ONCOLOGY_TREATMENT_DELAY",
        "name": "Oncology treatment delay",
        "active": true
      }
    ]
  },
  {
    "code": "DENTAL_AND_ORAL_CARE",
    "name": "Dental and Oral Care",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 23,
    "subcategories": [
      {
        "code": "WRONG_PATIENT_DENTAL_PROCEDURE",
        "name": "Wrong-patient dental procedure",
        "active": true
      },
      {
        "code": "WRONG_TOOTH_OR_SITE_TREATED",
        "name": "Wrong tooth or site treated",
        "active": true
      },
      {
        "code": "WRONG_TOOTH_EXTRACTION",
        "name": "Wrong tooth extraction",
        "active": true
      },
      {
        "code": "DENTAL_INSTRUMENT_RETAINED_OR_INGESTED",
        "name": "Dental instrument retained or ingested",
        "active": true
      },
      {
        "code": "ASPIRATION_DURING_DENTAL_PROCEDURE",
        "name": "Aspiration during dental procedure",
        "active": true
      },
      {
        "code": "LOCAL_ANAESTHETIC_ERROR",
        "name": "Local-anaesthetic error",
        "active": true
      },
      {
        "code": "DENTAL_IMPLANT_OR_PROSTHESIS_ERROR",
        "name": "Dental implant or prosthesis error",
        "active": true
      },
      {
        "code": "STERILISATION_BREACH",
        "name": "Sterilisation breach",
        "active": true
      },
      {
        "code": "POST_PROCEDURE_BLEEDING_OR_INJURY_REQUIRING_R",
        "name": "Post-procedure bleeding or injury requiring review",
        "active": true
      }
    ]
  },
  {
    "code": "OPHTHALMOLOGY",
    "name": "Ophthalmology",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 24,
    "subcategories": [
      {
        "code": "WRONG_EYE_OR_SITE",
        "name": "Wrong eye or site",
        "active": true
      },
      {
        "code": "WRONG_INTRAOCULAR_LENS",
        "name": "Wrong intraocular lens",
        "active": true
      },
      {
        "code": "INCORRECT_LENS_POWER",
        "name": "Incorrect lens power",
        "active": true
      },
      {
        "code": "WRONG_MEDICINE_INJECTED_OR_ADMINISTERED",
        "name": "Wrong medicine injected or administered",
        "active": true
      },
      {
        "code": "EYE_SPECIMEN_MISMATCH",
        "name": "Eye specimen mismatch",
        "active": true
      },
      {
        "code": "OPHTHALMIC_EQUIPMENT_FAILURE",
        "name": "Ophthalmic equipment failure",
        "active": true
      },
      {
        "code": "POST_PROCEDURE_VISUAL_COMPLICATION_REQUIRING_",
        "name": "Post-procedure visual complication requiring review",
        "active": true
      }
    ]
  },
  {
    "code": "ENDOSCOPY",
    "name": "Endoscopy",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 25,
    "subcategories": [
      {
        "code": "WRONG_PATIENT_OR_PROCEDURE",
        "name": "Wrong patient or procedure",
        "active": true
      },
      {
        "code": "INADEQUATELY_DISINFECTED_ENDOSCOPE",
        "name": "Inadequately disinfected endoscope",
        "active": true
      },
      {
        "code": "ENDOSCOPE_REPROCESSING_FAILURE",
        "name": "Endoscope reprocessing failure",
        "active": true
      },
      {
        "code": "SEDATION_RELATED_EVENT",
        "name": "Sedation-related event",
        "active": true
      },
      {
        "code": "PERFORATION_OR_BLEEDING_REQUIRING_REVIEW",
        "name": "Perforation or bleeding requiring review",
        "active": true
      },
      {
        "code": "BIOPSY_SPECIMEN_MISMATCH",
        "name": "Biopsy specimen mismatch",
        "active": true
      },
      {
        "code": "EQUIPMENT_FAILURE",
        "name": "Equipment failure",
        "active": true
      }
    ]
  },
  {
    "code": "TRANSPLANT_FERTILITY_AND_OTHER_SPECIALIST_SERVICES",
    "name": "Transplant, Fertility, and Other Specialist Services",
    "domain": "2. Diagnostic and Specialty-Department Incidents",
    "order": 26,
    "subcategories": [
      {
        "code": "DONOR_OR_RECIPIENT_IDENTIFICATION_ERROR",
        "name": "Donor or recipient identification error",
        "active": true
      },
      {
        "code": "ORGAN_OR_TISSUE_MISMATCH",
        "name": "Organ or tissue mismatch",
        "active": true
      },
      {
        "code": "ORGAN_STORAGE_OR_TRANSPORT_FAILURE",
        "name": "Organ-storage or transport failure",
        "active": true
      },
      {
        "code": "FERTILITY_SPECIMEN_MISMATCH",
        "name": "Fertility specimen mismatch",
        "active": true
      },
      {
        "code": "EMBRYO_OR_GAMETE_IDENTIFICATION_ERROR",
        "name": "Embryo or gamete identification error",
        "active": true
      },
      {
        "code": "CHAIN_OF_CUSTODY_FAILURE",
        "name": "Chain-of-custody failure",
        "active": true
      },
      {
        "code": "SPECIALIST_PROCEDURE_OR_DEVICE_INCIDENT",
        "name": "Specialist procedure or device incident",
        "active": true
      }
    ]
  },
  {
    "code": "OCCUPATIONAL_EXPOSURE",
    "name": "Occupational Exposure",
    "domain": "3. Staff, Visitor, Behavioural, and Security Incidents",
    "order": 27,
    "subcategories": [
      {
        "code": "NEEDLESTICK_INJURY",
        "name": "Needlestick injury",
        "active": true
      },
      {
        "code": "SHARPS_INJURY",
        "name": "Sharps injury",
        "active": true
      },
      {
        "code": "BLOOD_OR_BODY_FLUID_SPLASH",
        "name": "Blood or body-fluid splash",
        "active": true
      },
      {
        "code": "UNPROTECTED_INFECTIOUS_EXPOSURE",
        "name": "Unprotected infectious exposure",
        "active": true
      },
      {
        "code": "CHEMICAL_EXPOSURE",
        "name": "Chemical exposure",
        "active": true
      },
      {
        "code": "CYTOTOXIC_DRUG_EXPOSURE_OR_SPILL",
        "name": "Cytotoxic-drug exposure or spill",
        "active": true
      },
      {
        "code": "UNINTENDED_RADIATION_EXPOSURE",
        "name": "Unintended radiation exposure",
        "active": true
      },
      {
        "code": "RESPIRATORY_EXPOSURE",
        "name": "Respiratory exposure",
        "active": true
      },
      {
        "code": "EXPOSURE_DUE_TO_PPE_FAILURE_OR_NON_USE",
        "name": "Exposure due to PPE failure or non-use",
        "active": true
      }
    ]
  },
  {
    "code": "WORKPLACE_INJURY",
    "name": "Workplace Injury",
    "domain": "3. Staff, Visitor, Behavioural, and Security Incidents",
    "order": 28,
    "subcategories": [
      {
        "code": "STAFF_FALL",
        "name": "Staff fall",
        "active": true
      },
      {
        "code": "VISITOR_FALL",
        "name": "Visitor fall",
        "active": true
      },
      {
        "code": "MANUAL_HANDLING_OR_BACK_INJURY",
        "name": "Manual-handling or back injury",
        "active": true
      },
      {
        "code": "BURN_OR_SCALD",
        "name": "Burn or scald",
        "active": true
      },
      {
        "code": "ELECTRIC_SHOCK",
        "name": "Electric shock",
        "active": true
      },
      {
        "code": "INJURY_FROM_EQUIPMENT_OR_MACHINERY",
        "name": "Injury from equipment or machinery",
        "active": true
      },
      {
        "code": "FALLING_OBJECT_INJURY",
        "name": "Falling-object injury",
        "active": true
      },
      {
        "code": "VEHICLE_RELATED_INJURY_ON_HOSPITAL_PREMISES",
        "name": "Vehicle-related injury on hospital premises",
        "active": true
      },
      {
        "code": "ERGONOMIC_OR_REPETITIVE_STRAIN_INJURY",
        "name": "Ergonomic or repetitive-strain injury",
        "active": true
      }
    ]
  },
  {
    "code": "VIOLENCE_ABUSE_AND_HARASSMENT",
    "name": "Violence, Abuse, and Harassment",
    "domain": "3. Staff, Visitor, Behavioural, and Security Incidents",
    "order": 29,
    "subcategories": [
      {
        "code": "PHYSICAL_ASSAULT",
        "name": "Physical assault",
        "active": true
      },
      {
        "code": "VERBAL_ABUSE_OR_THREAT",
        "name": "Verbal abuse or threat",
        "active": true
      },
      {
        "code": "SEXUAL_HARASSMENT",
        "name": "Sexual harassment",
        "active": true
      },
      {
        "code": "BULLYING_OR_INTIMIDATION",
        "name": "Bullying or intimidation",
        "active": true
      },
      {
        "code": "VIOLENCE_BY_PATIENT",
        "name": "Violence by patient",
        "active": true
      },
      {
        "code": "VIOLENCE_BY_ATTENDANT_OR_VISITOR",
        "name": "Violence by attendant or visitor",
        "active": true
      },
      {
        "code": "VIOLENCE_BETWEEN_STAFF_MEMBERS",
        "name": "Violence between staff members",
        "active": true
      },
      {
        "code": "WEAPON_OR_THREATENING_OBJECT_INVOLVED",
        "name": "Weapon or threatening object involved",
        "active": true
      },
      {
        "code": "DOMESTIC_VIOLENCE_CONCERN_IDENTIFIED",
        "name": "Domestic violence concern identified",
        "active": true
      }
    ]
  },
  {
    "code": "SAFEGUARDING_AND_PATIENT_RIGHTS",
    "name": "Safeguarding and Patient Rights",
    "domain": "3. Staff, Visitor, Behavioural, and Security Incidents",
    "order": 30,
    "subcategories": [
      {
        "code": "SUSPECTED_ABUSE",
        "name": "Suspected abuse",
        "active": true
      },
      {
        "code": "SUSPECTED_NEGLECT",
        "name": "Suspected neglect",
        "active": true
      },
      {
        "code": "CHILD_SAFEGUARDING_CONCERN",
        "name": "Child safeguarding concern",
        "active": true
      },
      {
        "code": "ELDER_OR_VULNERABLE_ADULT_SAFEGUARDING_CONCER",
        "name": "Elder or vulnerable-adult safeguarding concern",
        "active": true
      },
      {
        "code": "INAPPROPRIATE_RESTRAINT",
        "name": "Inappropriate restraint",
        "active": true
      },
      {
        "code": "DISCRIMINATION",
        "name": "Discrimination",
        "active": true
      },
      {
        "code": "LOSS_OF_DIGNITY",
        "name": "Loss of dignity",
        "active": true
      },
      {
        "code": "PRIVACY_VIOLATION",
        "name": "Privacy violation",
        "active": true
      },
      {
        "code": "UNAUTHORISED_PHOTOGRAPH_OR_RECORDING",
        "name": "Unauthorised photograph or recording",
        "active": true
      },
      {
        "code": "TREATMENT_WITHOUT_VALID_CONSENT",
        "name": "Treatment without valid consent",
        "active": true
      },
      {
        "code": "PATIENT_RIGHTS_COMPLAINT_INVOLVING_SAFETY",
        "name": "Patient-rights complaint involving safety",
        "active": true
      }
    ]
  },
  {
    "code": "MISSING_PERSON_ABDUCTION_AND_SELF_HARM",
    "name": "Missing Person, Abduction, and Self-Harm",
    "domain": "3. Staff, Visitor, Behavioural, and Security Incidents",
    "order": 31,
    "subcategories": [
      {
        "code": "PATIENT_WANDERING",
        "name": "Patient wandering",
        "active": true
      },
      {
        "code": "PATIENT_MISSING_OR_ABSCONDED",
        "name": "Patient missing or absconded",
        "active": true
      },
      {
        "code": "VULNERABLE_PATIENT_LEAVING_WITHOUT_SUPERVISIO",
        "name": "Vulnerable patient leaving without supervision",
        "active": true
      },
      {
        "code": "INFANT_OR_CHILD_ABDUCTION",
        "name": "Infant or child abduction",
        "active": true
      },
      {
        "code": "SELF_HARM_ATTEMPT",
        "name": "Self-harm attempt",
        "active": true
      },
      {
        "code": "SUSPECTED_SUICIDE_ATTEMPT",
        "name": "Suspected suicide attempt",
        "active": true
      },
      {
        "code": "COMPLETED_SUICIDE",
        "name": "Completed suicide",
        "active": true
      },
      {
        "code": "REQUIRED_OBSERVATION_NOT_MAINTAINED",
        "name": "Required observation not maintained",
        "active": true
      },
      {
        "code": "LIGATURE_OR_ENVIRONMENTAL_SELF_HARM_RISK",
        "name": "Ligature or environmental self-harm risk",
        "active": true
      }
    ]
  },
  {
    "code": "SECURITY_THEFT_AND_PROPERTY_DAMAGE",
    "name": "Security, Theft, and Property Damage",
    "domain": "3. Staff, Visitor, Behavioural, and Security Incidents",
    "order": 32,
    "subcategories": [
      {
        "code": "THEFT_OF_PATIENT_OR_VISITOR_BELONGINGS",
        "name": "Theft of patient or visitor belongings",
        "active": true
      },
      {
        "code": "THEFT_OF_HOSPITAL_PROPERTY",
        "name": "Theft of hospital property",
        "active": true
      },
      {
        "code": "MEDICINE_OR_CONTROLLED_DRUG_DIVERSION",
        "name": "Medicine or controlled-drug diversion",
        "active": true
      },
      {
        "code": "UNAUTHORISED_ENTRY",
        "name": "Unauthorised entry",
        "active": true
      },
      {
        "code": "TAILGATING_OR_ACCESS_CONTROL_BREACH",
        "name": "Tailgating or access-control breach",
        "active": true
      },
      {
        "code": "VANDALISM",
        "name": "Vandalism",
        "active": true
      },
      {
        "code": "PROPERTY_DAMAGE",
        "name": "Property damage",
        "active": true
      },
      {
        "code": "SUSPICIOUS_PACKAGE_OR_OBJECT",
        "name": "Suspicious package or object",
        "active": true
      },
      {
        "code": "SECURITY_RESPONSE_DELAYED",
        "name": "Security response delayed",
        "active": true
      },
      {
        "code": "LOST_ACCESS_CARD_OR_KEY",
        "name": "Lost access card or key",
        "active": true
      }
    ]
  },
  {
    "code": "BIOMEDICAL_EQUIPMENT",
    "name": "Biomedical Equipment",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 33,
    "subcategories": [
      {
        "code": "EQUIPMENT_FAILURE_DURING_USE",
        "name": "Equipment failure during use",
        "active": true
      },
      {
        "code": "INCORRECT_EQUIPMENT_READING",
        "name": "Incorrect equipment reading",
        "active": true
      },
      {
        "code": "CALIBRATION_OVERDUE_OR_FAILED",
        "name": "Calibration overdue or failed",
        "active": true
      },
      {
        "code": "PREVENTIVE_MAINTENANCE_OVERDUE",
        "name": "Preventive maintenance overdue",
        "active": true
      },
      {
        "code": "DAMAGED_CABLE_PLUG_OR_ACCESSORY",
        "name": "Damaged cable, plug, or accessory",
        "active": true
      },
      {
        "code": "EQUIPMENT_UNAVAILABLE_DURING_EMERGENCY",
        "name": "Equipment unavailable during emergency",
        "active": true
      },
      {
        "code": "USER_ERROR_OR_INADEQUATE_TRAINING",
        "name": "User error or inadequate training",
        "active": true
      },
      {
        "code": "DEVICE_SOFTWARE_OR_FIRMWARE_FAILURE",
        "name": "Device software or firmware failure",
        "active": true
      },
      {
        "code": "ALARM_FAILURE",
        "name": "Alarm failure",
        "active": true
      },
      {
        "code": "RECALL_OR_SAFETY_ALERT_NOT_ACTIONED",
        "name": "Recall or safety alert not actioned",
        "active": true
      }
    ]
  },
  {
    "code": "MEDICAL_GASES_AND_SUCTION",
    "name": "Medical Gases and Suction",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 34,
    "subcategories": [
      {
        "code": "OXYGEN_SUPPLY_INTERRUPTION",
        "name": "Oxygen supply interruption",
        "active": true
      },
      {
        "code": "EMPTY_CYLINDER_DURING_CARE_OR_TRANSFER",
        "name": "Empty cylinder during care or transfer",
        "active": true
      },
      {
        "code": "GAS_LEAKAGE",
        "name": "Gas leakage",
        "active": true
      },
      {
        "code": "WRONG_GAS_CONNECTED",
        "name": "Wrong gas connected",
        "active": true
      },
      {
        "code": "CROSS_CONNECTION",
        "name": "Cross-connection",
        "active": true
      },
      {
        "code": "UNSECURED_CYLINDER",
        "name": "Unsecured cylinder",
        "active": true
      },
      {
        "code": "PIPELINE_PRESSURE_FAILURE",
        "name": "Pipeline pressure failure",
        "active": true
      },
      {
        "code": "SUCTION_SYSTEM_FAILURE",
        "name": "Suction-system failure",
        "active": true
      },
      {
        "code": "MEDICAL_GAS_ALARM_FAILURE",
        "name": "Medical-gas alarm failure",
        "active": true
      },
      {
        "code": "CYLINDER_STORAGE_OR_HANDLING_BREACH",
        "name": "Cylinder storage or handling breach",
        "active": true
      }
    ]
  },
  {
    "code": "ELECTRICITY_AND_BACKUP_POWER",
    "name": "Electricity and Backup Power",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 35,
    "subcategories": [
      {
        "code": "MAIN_POWER_FAILURE",
        "name": "Main power failure",
        "active": true
      },
      {
        "code": "GENERATOR_FAILURE",
        "name": "Generator failure",
        "active": true
      },
      {
        "code": "UPS_FAILURE",
        "name": "UPS failure",
        "active": true
      },
      {
        "code": "DELAYED_BACKUP_POWER_TRANSFER",
        "name": "Delayed backup-power transfer",
        "active": true
      },
      {
        "code": "ESSENTIAL_EQUIPMENT_DISCONNECTED",
        "name": "Essential equipment disconnected",
        "active": true
      },
      {
        "code": "OVERLOADED_SOCKET_OR_CIRCUIT",
        "name": "Overloaded socket or circuit",
        "active": true
      },
      {
        "code": "ELECTRICAL_SHORT_CIRCUIT",
        "name": "Electrical short circuit",
        "active": true
      },
      {
        "code": "UNSAFE_EXTENSION_OR_WIRING",
        "name": "Unsafe extension or wiring",
        "active": true
      },
      {
        "code": "CRITICAL_AREA_WITHOUT_BACKUP_SUPPLY",
        "name": "Critical area without backup supply",
        "active": true
      }
    ]
  },
  {
    "code": "FIRE_AND_MAJOR_EMERGENCY",
    "name": "Fire and Major Emergency",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 36,
    "subcategories": [
      {
        "code": "FIRE",
        "name": "Fire",
        "active": true
      },
      {
        "code": "SMOKE_EVENT",
        "name": "Smoke event",
        "active": true
      },
      {
        "code": "EXPLOSION",
        "name": "Explosion",
        "active": true
      },
      {
        "code": "FLOODING",
        "name": "Flooding",
        "active": true
      },
      {
        "code": "STRUCTURAL_DAMAGE_OR_COLLAPSE_RISK",
        "name": "Structural damage or collapse risk",
        "active": true
      },
      {
        "code": "BLOCKED_FIRE_EXIT_OR_EVACUATION_ROUTE",
        "name": "Blocked fire exit or evacuation route",
        "active": true
      },
      {
        "code": "FIRE_ALARM_FAILURE",
        "name": "Fire alarm failure",
        "active": true
      },
      {
        "code": "FIREFIGHTING_EQUIPMENT_UNAVAILABLE_OR_DEFECTI",
        "name": "Firefighting equipment unavailable or defective",
        "active": true
      },
      {
        "code": "EMERGENCY_COMMUNICATION_FAILURE",
        "name": "Emergency communication failure",
        "active": true
      },
      {
        "code": "EVACUATION_OR_DISASTER_RESPONSE_FAILURE",
        "name": "Evacuation or disaster-response failure",
        "active": true
      }
    ]
  },
  {
    "code": "BUILDING_AND_UTILITY_FAILURE",
    "name": "Building and Utility Failure",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 37,
    "subcategories": [
      {
        "code": "LIFT_FAILURE_OR_ENTRAPMENT",
        "name": "Lift failure or entrapment",
        "active": true
      },
      {
        "code": "FALLING_CEILING_OR_STRUCTURAL_MATERIAL",
        "name": "Falling ceiling or structural material",
        "active": true
      },
      {
        "code": "BROKEN_HANDRAIL_FLOOR_DOOR_OR_WINDOW",
        "name": "Broken handrail, floor, door, or window",
        "active": true
      },
      {
        "code": "WATER_SUPPLY_INTERRUPTION",
        "name": "Water-supply interruption",
        "active": true
      },
      {
        "code": "WATER_CONTAMINATION",
        "name": "Water contamination",
        "active": true
      },
      {
        "code": "SEWAGE_OVERFLOW",
        "name": "Sewage overflow",
        "active": true
      },
      {
        "code": "AIR_CONDITIONING_OR_VENTILATION_FAILURE",
        "name": "Air-conditioning or ventilation failure",
        "active": true
      },
      {
        "code": "ISOLATION_ROOM_PRESSURE_FAILURE",
        "name": "Isolation-room pressure failure",
        "active": true
      },
      {
        "code": "EXCESSIVE_TEMPERATURE_OR_HUMIDITY",
        "name": "Excessive temperature or humidity",
        "active": true
      },
      {
        "code": "PLUMBING_OR_DRAINAGE_FAILURE",
        "name": "Plumbing or drainage failure",
        "active": true
      }
    ]
  },
  {
    "code": "STERILISATION_AND_INSTRUMENT_REPROCESSING",
    "name": "Sterilisation and Instrument Reprocessing",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 38,
    "subcategories": [
      {
        "code": "STERILISATION_CYCLE_FAILURE",
        "name": "Sterilisation-cycle failure",
        "active": true
      },
      {
        "code": "BIOLOGICAL_OR_CHEMICAL_INDICATOR_FAILURE",
        "name": "Biological or chemical indicator failure",
        "active": true
      },
      {
        "code": "TORN_WET_OR_DAMAGED_STERILE_PACK",
        "name": "Torn, wet, or damaged sterile pack",
        "active": true
      },
      {
        "code": "CONTAMINATED_INSTRUMENT_SUPPLIED",
        "name": "Contaminated instrument supplied",
        "active": true
      },
      {
        "code": "INSTRUMENT_NOT_CLEANED_ADEQUATELY",
        "name": "Instrument not cleaned adequately",
        "active": true
      },
      {
        "code": "INCORRECT_DISINFECTION_PROCESS",
        "name": "Incorrect disinfection process",
        "active": true
      },
      {
        "code": "MISSING_STERILISATION_RECORD",
        "name": "Missing sterilisation record",
        "active": true
      },
      {
        "code": "STERILE_ITEM_USED_AFTER_EXPIRY",
        "name": "Sterile item used after expiry",
        "active": true
      },
      {
        "code": "TRACEABILITY_FAILURE",
        "name": "Traceability failure",
        "active": true
      },
      {
        "code": "ENDOSCOPE_REPROCESSING_FAILURE",
        "name": "Endoscope-reprocessing failure",
        "active": true
      }
    ]
  },
  {
    "code": "HOUSEKEEPING_LAUNDRY_AND_BIOMEDICAL_WASTE",
    "name": "Housekeeping, Laundry, and Biomedical Waste",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 39,
    "subcategories": [
      {
        "code": "CLINICAL_AREA_NOT_CLEANED_ADEQUATELY",
        "name": "Clinical area not cleaned adequately",
        "active": true
      },
      {
        "code": "BLOOD_OR_BODY_FLUID_SPILL_NOT_MANAGED",
        "name": "Blood or body-fluid spill not managed",
        "active": true
      },
      {
        "code": "CLEAN_AND_CONTAMINATED_LINEN_MIXED",
        "name": "Clean and contaminated linen mixed",
        "active": true
      },
      {
        "code": "SHARPS_PLACED_IN_INCORRECT_WASTE_STREAM",
        "name": "Sharps placed in incorrect waste stream",
        "active": true
      },
      {
        "code": "OVERFILLED_SHARPS_CONTAINER",
        "name": "Overfilled sharps container",
        "active": true
      },
      {
        "code": "INCORRECT_BIOMEDICAL_WASTE_SEGREGATION",
        "name": "Incorrect biomedical-waste segregation",
        "active": true
      },
      {
        "code": "WASTE_COLLECTION_DELAYED",
        "name": "Waste collection delayed",
        "active": true
      },
      {
        "code": "WASTE_STORAGE_OR_TRANSPORT_BREACH",
        "name": "Waste-storage or transport breach",
        "active": true
      },
      {
        "code": "PEST_INFESTATION",
        "name": "Pest infestation",
        "active": true
      },
      {
        "code": "HOUSEKEEPING_CHEMICAL_INCIDENT",
        "name": "Housekeeping chemical incident",
        "active": true
      }
    ]
  },
  {
    "code": "FOOD_AND_CATERING_SAFETY",
    "name": "Food and Catering Safety",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 40,
    "subcategories": [
      {
        "code": "SUSPECTED_FOOD_CONTAMINATION",
        "name": "Suspected food contamination",
        "active": true
      },
      {
        "code": "FOOD_POISONING_CASE_OR_CLUSTER",
        "name": "Food-poisoning case or cluster",
        "active": true
      },
      {
        "code": "FOREIGN_OBJECT_IN_FOOD",
        "name": "Foreign object in food",
        "active": true
      },
      {
        "code": "UNSAFE_FOOD_STORAGE_TEMPERATURE",
        "name": "Unsafe food-storage temperature",
        "active": true
      },
      {
        "code": "EXPIRED_FOOD_USED",
        "name": "Expired food used",
        "active": true
      },
      {
        "code": "ALLERGEN_INFORMATION_MISSING_OR_INCORRECT",
        "name": "Allergen information missing or incorrect",
        "active": true
      },
      {
        "code": "WRONG_THERAPEUTIC_DIET_SUPPLIED",
        "name": "Wrong therapeutic diet supplied",
        "active": true
      },
      {
        "code": "KITCHEN_HYGIENE_FAILURE",
        "name": "Kitchen hygiene failure",
        "active": true
      },
      {
        "code": "DRINKING_WATER_SAFETY_CONCERN",
        "name": "Drinking-water safety concern",
        "active": true
      }
    ]
  },
  {
    "code": "STORES_SUPPLY_CHAIN_AND_COLD_CHAIN",
    "name": "Stores, Supply Chain, and Cold Chain",
    "domain": "4. Equipment, Facilities, and Support-Service Incidents",
    "order": 41,
    "subcategories": [
      {
        "code": "ESSENTIAL_MEDICINE_STOCKOUT",
        "name": "Essential medicine stockout",
        "active": true
      },
      {
        "code": "CONSUMABLE_STOCKOUT",
        "name": "Consumable stockout",
        "active": true
      },
      {
        "code": "EXPIRED_ITEM_ISSUED",
        "name": "Expired item issued",
        "active": true
      },
      {
        "code": "DAMAGED_OR_DEFECTIVE_ITEM_SUPPLIED",
        "name": "Damaged or defective item supplied",
        "active": true
      },
      {
        "code": "WRONG_ITEM_SUPPLIED",
        "name": "Wrong item supplied",
        "active": true
      },
      {
        "code": "REFRIGERATOR_OR_FREEZER_FAILURE",
        "name": "Refrigerator or freezer failure",
        "active": true
      },
      {
        "code": "COLD_CHAIN_TEMPERATURE_EXCURSION",
        "name": "Cold-chain temperature excursion",
        "active": true
      },
      {
        "code": "RECALLED_ITEM_STILL_AVAILABLE_OR_USED",
        "name": "Recalled item still available or used",
        "active": true
      },
      {
        "code": "INVENTORY_DISCREPANCY",
        "name": "Inventory discrepancy",
        "active": true
      },
      {
        "code": "EMERGENCY_SUPPLY_DELAY",
        "name": "Emergency supply delay",
        "active": true
      }
    ]
  },
  {
    "code": "IT_AND_COMMUNICATION_DOWNTIME",
    "name": "IT and Communication Downtime",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 42,
    "subcategories": [
      {
        "code": "HIS_OUTAGE",
        "name": "HIS outage",
        "active": true
      },
      {
        "code": "LIS_OUTAGE",
        "name": "LIS outage",
        "active": true
      },
      {
        "code": "RIS_PACS_OUTAGE",
        "name": "RIS/PACS outage",
        "active": true
      },
      {
        "code": "PHARMACY_SYSTEM_OUTAGE",
        "name": "Pharmacy-system outage",
        "active": true
      },
      {
        "code": "NETWORK_OR_INTERNET_FAILURE",
        "name": "Network or internet failure",
        "active": true
      },
      {
        "code": "SERVER_OR_DATABASE_FAILURE",
        "name": "Server or database failure",
        "active": true
      },
      {
        "code": "ELECTRONIC_PRESCRIPTION_UNAVAILABLE",
        "name": "Electronic-prescription unavailable",
        "active": true
      },
      {
        "code": "TELEPHONE_OR_INTERCOM_FAILURE",
        "name": "Telephone or intercom failure",
        "active": true
      },
      {
        "code": "NURSE_CALL_OR_EMERGENCY_CALL_FAILURE",
        "name": "Nurse-call or emergency-call failure",
        "active": true
      },
      {
        "code": "BACKUP_FAILURE",
        "name": "Backup failure",
        "active": true
      },
      {
        "code": "RECOVERY_OR_DISASTER_RECOVERY_FAILURE",
        "name": "Recovery or disaster-recovery failure",
        "active": true
      }
    ]
  },
  {
    "code": "DATA_AND_SYSTEM_INTEGRATION_ERROR",
    "name": "Data and System-Integration Error",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 43,
    "subcategories": [
      {
        "code": "RESULT_MAPPED_TO_WRONG_PATIENT",
        "name": "Result mapped to wrong patient",
        "active": true
      },
      {
        "code": "INCORRECT_RESULT_OR_UNIT_DISPLAYED",
        "name": "Incorrect result or unit displayed",
        "active": true
      },
      {
        "code": "HIS_LIS_ORDER_MISSING",
        "name": "HIS-LIS order missing",
        "active": true
      },
      {
        "code": "DUPLICATE_ORDER_OR_RESULT",
        "name": "Duplicate order or result",
        "active": true
      },
      {
        "code": "INTERFACE_MESSAGE_DELAYED",
        "name": "Interface message delayed",
        "active": true
      },
      {
        "code": "REPORT_ALTERED_TRUNCATED_OR_LOST",
        "name": "Report altered, truncated, or lost",
        "active": true
      },
      {
        "code": "DEMOGRAPHIC_DATA_MISMATCH",
        "name": "Demographic data mismatch",
        "active": true
      },
      {
        "code": "INCORRECT_MASTER_DATA_MAPPING",
        "name": "Incorrect master-data mapping",
        "active": true
      },
      {
        "code": "DEVICE_INTEGRATION_ERROR",
        "name": "Device-integration error",
        "active": true
      },
      {
        "code": "INCORRECT_AUTOMATED_OR_AI_GENERATED_OUTPUT",
        "name": "Incorrect automated or AI-generated output",
        "active": true
      },
      {
        "code": "DATA_SYNCHRONISATION_FAILURE",
        "name": "Data synchronisation failure",
        "active": true
      }
    ]
  },
  {
    "code": "CYBERSECURITY_AND_CONFIDENTIALITY",
    "name": "Cybersecurity and Confidentiality",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 44,
    "subcategories": [
      {
        "code": "MALWARE_OR_RANSOMWARE",
        "name": "Malware or ransomware",
        "active": true
      },
      {
        "code": "PHISHING_OR_SOCIAL_ENGINEERING_INCIDENT",
        "name": "Phishing or social-engineering incident",
        "active": true
      },
      {
        "code": "COMPROMISED_USER_ACCOUNT",
        "name": "Compromised user account",
        "active": true
      },
      {
        "code": "UNAUTHORISED_SYSTEM_ACCESS",
        "name": "Unauthorised system access",
        "active": true
      },
      {
        "code": "PRIVILEGE_MISUSE",
        "name": "Privilege misuse",
        "active": true
      },
      {
        "code": "LOST_OR_STOLEN_DEVICE",
        "name": "Lost or stolen device",
        "active": true
      },
      {
        "code": "PATIENT_DATA_SENT_TO_WRONG_EMAIL_OR_PHONE_NUM",
        "name": "Patient data sent to wrong email or phone number",
        "active": true
      },
      {
        "code": "UNAUTHORISED_DISCLOSURE",
        "name": "Unauthorised disclosure",
        "active": true
      },
      {
        "code": "INSECURE_DATA_STORAGE_OR_TRANSFER",
        "name": "Insecure data storage or transfer",
        "active": true
      },
      {
        "code": "SUSPICIOUS_NETWORK_ACTIVITY",
        "name": "Suspicious network activity",
        "active": true
      },
      {
        "code": "DATA_DELETION_OR_ALTERATION",
        "name": "Data deletion or alteration",
        "active": true
      },
      {
        "code": "CONFIDENTIAL_PRINTOUT_OR_RECORD_LEFT_UNSECURE",
        "name": "Confidential printout or record left unsecured",
        "active": true
      }
    ]
  },
  {
    "code": "REGISTRATION_MEDICAL_RECORDS_AND_CONSENT",
    "name": "Registration, Medical Records, and Consent",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 45,
    "subcategories": [
      {
        "code": "INCORRECT_PATIENT_DEMOGRAPHIC_DETAILS",
        "name": "Incorrect patient demographic details",
        "active": true
      },
      {
        "code": "DUPLICATE_REGISTRATION",
        "name": "Duplicate registration",
        "active": true
      },
      {
        "code": "WRONG_OR_MISSING_CASE_SHEET",
        "name": "Wrong or missing case sheet",
        "active": true
      },
      {
        "code": "DOCUMENTATION_ENTERED_IN_WRONG_RECORD",
        "name": "Documentation entered in wrong record",
        "active": true
      },
      {
        "code": "WRONG_DISCHARGE_SUMMARY",
        "name": "Wrong discharge summary",
        "active": true
      },
      {
        "code": "MISSING_OR_INCOMPLETE_CLINICAL_DOCUMENTATION",
        "name": "Missing or incomplete clinical documentation",
        "active": true
      },
      {
        "code": "MISSING_INVALID_OR_INCORRECT_CONSENT",
        "name": "Missing, invalid, or incorrect consent",
        "active": true
      },
      {
        "code": "RECORD_UNAVAILABLE_WHEN_NEEDED",
        "name": "Record unavailable when needed",
        "active": true
      },
      {
        "code": "RECORD_FILED_UNDER_WRONG_PATIENT",
        "name": "Record filed under wrong patient",
        "active": true
      },
      {
        "code": "DOCUMENT_RETENTION_OR_DESTRUCTION_FAILURE",
        "name": "Document retention or destruction failure",
        "active": true
      }
    ]
  },
  {
    "code": "BILLING_FINANCIAL_AND_ADMINISTRATIVE_EVENT",
    "name": "Billing, Financial, and Administrative Event",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 46,
    "subcategories": [
      {
        "code": "WRONG_PATIENT_BILLING",
        "name": "Wrong-patient billing",
        "active": true
      },
      {
        "code": "DUPLICATE_BILLING",
        "name": "Duplicate billing",
        "active": true
      },
      {
        "code": "INCORRECT_CHARGE_OR_TARIFF",
        "name": "Incorrect charge or tariff",
        "active": true
      },
      {
        "code": "FRAUDULENT_CLAIM_OR_TRANSACTION",
        "name": "Fraudulent claim or transaction",
        "active": true
      },
      {
        "code": "CASH_DISCREPANCY",
        "name": "Cash discrepancy",
        "active": true
      },
      {
        "code": "UNAUTHORISED_REFUND_OR_WAIVER",
        "name": "Unauthorised refund or waiver",
        "active": true
      },
      {
        "code": "INSURANCE_OR_AUTHORISATION_DELAY_AFFECTING_CA",
        "name": "Insurance or authorisation delay affecting care",
        "active": true
      },
      {
        "code": "ADMISSION_OR_DISCHARGE_ADMINISTRATIVE_ERROR",
        "name": "Admission or discharge administrative error",
        "active": true
      },
      {
        "code": "ADMINISTRATIVE_DELAY_IN_NECESSARY_CARE",
        "name": "Administrative delay in necessary care",
        "active": true
      },
      {
        "code": "PATIENT_PROPERTY_OR_DEPOSIT_DISCREPANCY",
        "name": "Patient property or deposit discrepancy",
        "active": true
      }
    ]
  },
  {
    "code": "STAFFING_SUPERVISION_AND_GOVERNANCE",
    "name": "Staffing, Supervision, and Governance",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 47,
    "subcategories": [
      {
        "code": "UNSAFE_STAFFING_LEVEL",
        "name": "Unsafe staffing level",
        "active": true
      },
      {
        "code": "CRITICAL_AREA_LEFT_UNCOVERED",
        "name": "Critical area left uncovered",
        "active": true
      },
      {
        "code": "SKILL_MIX_DEFICIENCY",
        "name": "Skill-mix deficiency",
        "active": true
      },
      {
        "code": "INADEQUATE_SUPERVISION",
        "name": "Inadequate supervision",
        "active": true
      },
      {
        "code": "STAFF_WORKING_BEYOND_COMPETENCE_OR_AUTHORISAT",
        "name": "Staff working beyond competence or authorisation",
        "active": true
      },
      {
        "code": "EXCESSIVE_DUTY_HOURS_OR_FATIGUE_RISK",
        "name": "Excessive duty hours or fatigue risk",
        "active": true
      },
      {
        "code": "MANDATORY_TRAINING_OVERDUE",
        "name": "Mandatory training overdue",
        "active": true
      },
      {
        "code": "POLICY_OR_PROTOCOL_NOT_FOLLOWED",
        "name": "Policy or protocol not followed",
        "active": true
      },
      {
        "code": "CREDENTIALING_OR_PRIVILEGING_ISSUE",
        "name": "Credentialing or privileging issue",
        "active": true
      },
      {
        "code": "RESEARCH_PROTOCOL_DEVIATION",
        "name": "Research-protocol deviation",
        "active": true
      },
      {
        "code": "CONFLICT_OF_INTEREST_OR_ETHICAL_CONCERN",
        "name": "Conflict of interest or ethical concern",
        "active": true
      }
    ]
  },
  {
    "code": "MORTUARY_AND_DECEASED_PERSON_MANAGEMENT",
    "name": "Mortuary and Deceased-Person Management",
    "domain": "5. IT, Information, Administration, and Governance Incidents",
    "order": 48,
    "subcategories": [
      {
        "code": "INCORRECT_DECEASED_PERSON_IDENTIFICATION",
        "name": "Incorrect deceased-person identification",
        "active": true
      },
      {
        "code": "WRONG_BODY_RELEASED",
        "name": "Wrong body released",
        "active": true
      },
      {
        "code": "MISSING_OR_INCORRECT_IDENTIFICATION_TAG",
        "name": "Missing or incorrect identification tag",
        "active": true
      },
      {
        "code": "MORTUARY_REFRIGERATION_FAILURE",
        "name": "Mortuary refrigeration failure",
        "active": true
      },
      {
        "code": "BODY_STORED_IN_WRONG_LOCATION",
        "name": "Body stored in wrong location",
        "active": true
      },
      {
        "code": "DELAY_IN_RELEASE_OR_TRANSFER",
        "name": "Delay in release or transfer",
        "active": true
      },
      {
        "code": "POST_MORTEM_OR_DOCUMENTATION_ERROR",
        "name": "Post-mortem or documentation error",
        "active": true
      },
      {
        "code": "DECEASED_PERSON_S_BELONGINGS_LOST",
        "name": "Deceased person's belongings lost",
        "active": true
      },
      {
        "code": "INFECTION_CONTROL_BREACH_IN_MORTUARY",
        "name": "Infection-control breach in mortuary",
        "active": true
      },
      {
        "code": "UNAUTHORISED_ACCESS_TO_MORTUARY",
        "name": "Unauthorised access to mortuary",
        "active": true
      }
    ]
  },
  {
    "code": "OTHER",
    "name": "Other Reportable Incident",
    "domain": "Other",
    "order": 49,
    "subcategories": [
      {
        "code": "OTHER_REPORTABLE_EVENT",
        "name": "Other reportable event or concern",
        "active": true
      }
    ]
  }
];
