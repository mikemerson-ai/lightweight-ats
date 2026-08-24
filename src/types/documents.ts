export type DocumentStatus =
  | "Pending"
  | "Submitted"
  | "Verified"
  | "Expired"
  | "N/A";

export interface CandidateDocument {
  id: string;
  candidate_id: string;
  document_name: string;
  category: string | null;
  status: DocumentStatus;
  sharepoint_url?: string | null;
  date_issued?: string | null;
  date_expired?: string | null;
  requires_expiration: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
}

export interface StandardComplianceDocument {
  name: string;
  category: string;
  requiresExpiration: boolean;
}

export const STANDARD_COMPLIANCE_DOCUMENTS: StandardComplianceDocument[] = [
  { name: "Driver's License/State ID", category: "Validity of IDs / Licenses", requiresExpiration: true },
  { name: "Professional Licenses (RN/LPN/etc.)", category: "Validity of IDs / Licenses", requiresExpiration: true },
  { name: "TB Test", category: "Medical Clearances", requiresExpiration: true },
  { name: "Physical Exam", category: "Medical Clearances", requiresExpiration: true },
  { name: "Criminal Record Check Renewal (5-yr)", category: "Background Check Renewal", requiresExpiration: true },
  { name: "CPR & First Aid Certification", category: "Training & Certifications", requiresExpiration: true },
  { name: "Application Form", category: "Onboarding Records", requiresExpiration: false },
  { name: "Offer Letter (DocuSign Link)", category: "Onboarding Records", requiresExpiration: false },
  { name: "Employee Handbook", category: "Onboarding Records", requiresExpiration: false },
  { name: "Reference Check", category: "Onboarding Records", requiresExpiration: false },
  { name: "Competency Test", category: "Onboarding Records", requiresExpiration: false },
  { name: "Social Security ID", category: "Compliance/Tax Records", requiresExpiration: false },
  { name: "Form I-9", category: "Compliance/Tax Records", requiresExpiration: false },
  { name: "Form W-4", category: "Compliance/Tax Records", requiresExpiration: false },
  { name: "OIG Check", category: "Security Checks", requiresExpiration: false },
  { name: "SAM Check", category: "Security Checks", requiresExpiration: false },
  { name: "Medicheck", category: "Security Checks", requiresExpiration: false },
  { name: "E-Verify Case Processing", category: "Security Checks", requiresExpiration: false },
  { name: "FBI Background Check", category: "Security Checks", requiresExpiration: false },
];