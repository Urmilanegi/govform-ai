export interface ExtractedProfile {
  // Personal Info
  fullName?: string;
  fatherName?: string;
  motherName?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  religion?: string;
  category?: string; // General/OBC/SC/ST/EWS
  subCategory?: string;
  maritalStatus?: string;

  // Contact
  mobileNumber?: string;
  email?: string;
  permanentAddress?: string;
  correspondenceAddress?: string;
  pinCode?: string;
  state?: string;
  district?: string;

  // ID Documents
  aadhaarNumber?: string;
  aadhaarVid?: string;
  panNumber?: string;

  // Education - 10th
  class10School?: string;
  class10Board?: string;
  class10RollNumber?: string;
  class10Year?: string;
  class10Percentage?: string;
  class10Subjects?: string;

  // Education - 12th
  class12School?: string;
  class12Board?: string;
  class12Year?: string;
  class12Percentage?: string;
  class12Stream?: string;

  // Education - Graduation
  graduationCollege?: string;
  graduationUniversity?: string;
  graduationYear?: string;
  graduationPercentage?: string;
  graduationDegree?: string;
  graduationSubject?: string;
  highestQualification?: string;

  // Post Graduation
  postGraduationDegree?: string;
  postGraduationSubject?: string;
  postGraduationYear?: string;
  postGraduationPercentage?: string;

  // Physical
  height?: string;
  weight?: string;
  eyesight?: string;
  identificationMark?: string;

  // Bank Details
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;

  // Other
  exServiceman?: string;
  pwdCategory?: string;
  domicileState?: string;
}

export interface DocumentUpload {
  id: string;
  name: string;
  type: DocumentType;
  file: File;
  preview?: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  extractedData?: Partial<ExtractedProfile>;
}

export type DocumentType =
  | 'aadhaar'
  | 'pan'
  | 'marksheet_10'
  | 'marksheet_12'
  | 'graduation_certificate'
  | 'photo'
  | 'signature'
  | 'caste_certificate'
  | 'domicile'
  | 'income_certificate'
  | 'other';

export interface ExamForm {
  id: string;
  name: string;
  organization: string;
  sections: FormSection[];
}

export interface FormSection {
  id: string;
  title: string;
  fields: FormField[];
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'textarea' | 'radio';
  options?: string[];
  required: boolean;
  profileKey?: keyof ExtractedProfile;
  value?: string;
  aiNote?: string;
}

export interface FilledForm {
  examId: string;
  examName: string;
  sections: FilledSection[];
  completionPercentage: number;
  missingFields: string[];
}

export interface FilledSection {
  id: string;
  title: string;
  fields: FilledField[];
}

export interface FilledField {
  id: string;
  label: string;
  value: string;
  source: 'ai' | 'manual' | 'empty';
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}
