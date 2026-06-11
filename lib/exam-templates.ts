import { ExamForm } from '@/types';

export const EXAM_FORMS: ExamForm[] = [
  {
    id: 'ssc-cgl',
    name: 'SSC CGL (Combined Graduate Level)',
    organization: 'Staff Selection Commission',
    sections: [
      {
        id: 'personal',
        title: 'Personal Information',
        fields: [
          { id: 'fullName', label: 'Full Name (as per Aadhaar)', type: 'text', required: true, profileKey: 'fullName' },
          { id: 'fatherName', label: "Father's Name", type: 'text', required: true, profileKey: 'fatherName' },
          { id: 'motherName', label: "Mother's Name", type: 'text', required: true, profileKey: 'motherName' },
          { id: 'dob', label: 'Date of Birth', type: 'date', required: true, profileKey: 'dateOfBirth' },
          { id: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Transgender'], required: true, profileKey: 'gender' },
          { id: 'nationality', label: 'Nationality', type: 'text', required: true, profileKey: 'nationality' },
          { id: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'], required: true, profileKey: 'maritalStatus' },
          { id: 'category', label: 'Category', type: 'select', options: ['General', 'OBC', 'SC', 'ST', 'EWS'], required: true, profileKey: 'category' },
          { id: 'pwdCategory', label: 'PwD Category (if applicable)', type: 'select', options: ['None', 'Visual Impairment', 'Hearing Impairment', 'Locomotor Disability', 'Other'], required: false, profileKey: 'pwdCategory' },
          { id: 'exServiceman', label: 'Ex-Serviceman', type: 'radio', options: ['Yes', 'No'], required: true, profileKey: 'exServiceman' },
        ]
      },
      {
        id: 'contact',
        title: 'Contact Details',
        fields: [
          { id: 'mobile', label: 'Mobile Number', type: 'text', required: true, profileKey: 'mobileNumber' },
          { id: 'email', label: 'Email ID', type: 'text', required: true, profileKey: 'email' },
          { id: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, profileKey: 'permanentAddress' },
          { id: 'correspondenceAddress', label: 'Correspondence Address', type: 'textarea', required: true, profileKey: 'correspondenceAddress' },
          { id: 'state', label: 'State', type: 'text', required: true, profileKey: 'state' },
          { id: 'district', label: 'District', type: 'text', required: true, profileKey: 'district' },
          { id: 'pinCode', label: 'Pin Code', type: 'number', required: true, profileKey: 'pinCode' },
        ]
      },
      {
        id: 'education',
        title: 'Educational Qualifications',
        fields: [
          { id: 'class10Board', label: '10th Board', type: 'text', required: true, profileKey: 'class10Board' },
          { id: 'class10School', label: '10th School Name', type: 'text', required: true, profileKey: 'class10School' },
          { id: 'class10Year', label: '10th Passing Year', type: 'number', required: true, profileKey: 'class10Year' },
          { id: 'class10Percentage', label: '10th Percentage/CGPA', type: 'text', required: true, profileKey: 'class10Percentage' },
          { id: 'class12Board', label: '12th Board', type: 'text', required: false, profileKey: 'class12Board' },
          { id: 'class12Year', label: '12th Passing Year', type: 'number', required: false, profileKey: 'class12Year' },
          { id: 'class12Percentage', label: '12th Percentage/CGPA', type: 'text', required: false, profileKey: 'class12Percentage' },
          { id: 'graduationDegree', label: 'Graduation Degree', type: 'text', required: true, profileKey: 'graduationDegree' },
          { id: 'graduationSubject', label: 'Graduation Subject/Stream', type: 'text', required: true, profileKey: 'graduationSubject' },
          { id: 'graduationUniversity', label: 'University Name', type: 'text', required: true, profileKey: 'graduationUniversity' },
          { id: 'graduationYear', label: 'Graduation Passing Year', type: 'number', required: true, profileKey: 'graduationYear' },
          { id: 'graduationPercentage', label: 'Graduation Percentage/CGPA', type: 'text', required: true, profileKey: 'graduationPercentage' },
        ]
      },
      {
        id: 'identity',
        title: 'Identity Documents',
        fields: [
          { id: 'aadhaar', label: 'Aadhaar Number', type: 'text', required: true, profileKey: 'aadhaarNumber' },
          { id: 'pan', label: 'PAN Number (optional)', type: 'text', required: false, profileKey: 'panNumber' },
        ]
      },
      {
        id: 'bank',
        title: 'Bank Details',
        fields: [
          { id: 'bankName', label: 'Bank Name', type: 'text', required: true, profileKey: 'bankName' },
          { id: 'accountNumber', label: 'Account Number', type: 'text', required: true, profileKey: 'accountNumber' },
          { id: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, profileKey: 'ifscCode' },
        ]
      }
    ]
  },
  {
    id: 'ssc-chsl',
    name: 'SSC CHSL (Combined Higher Secondary Level)',
    organization: 'Staff Selection Commission',
    sections: [
      {
        id: 'personal',
        title: 'Personal Information',
        fields: [
          { id: 'fullName', label: 'Full Name', type: 'text', required: true, profileKey: 'fullName' },
          { id: 'fatherName', label: "Father's Name", type: 'text', required: true, profileKey: 'fatherName' },
          { id: 'motherName', label: "Mother's Name", type: 'text', required: true, profileKey: 'motherName' },
          { id: 'dob', label: 'Date of Birth', type: 'date', required: true, profileKey: 'dateOfBirth' },
          { id: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Transgender'], required: true, profileKey: 'gender' },
          { id: 'category', label: 'Category', type: 'select', options: ['General', 'OBC', 'SC', 'ST', 'EWS'], required: true, profileKey: 'category' },
          { id: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'], required: true, profileKey: 'maritalStatus' },
        ]
      },
      {
        id: 'contact',
        title: 'Contact Details',
        fields: [
          { id: 'mobile', label: 'Mobile Number', type: 'text', required: true, profileKey: 'mobileNumber' },
          { id: 'email', label: 'Email ID', type: 'text', required: true, profileKey: 'email' },
          { id: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, profileKey: 'permanentAddress' },
          { id: 'state', label: 'State', type: 'text', required: true, profileKey: 'state' },
          { id: 'pinCode', label: 'Pin Code', type: 'number', required: true, profileKey: 'pinCode' },
        ]
      },
      {
        id: 'education',
        title: 'Educational Qualifications',
        fields: [
          { id: 'class10Board', label: '10th Board', type: 'text', required: true, profileKey: 'class10Board' },
          { id: 'class10Year', label: '10th Passing Year', type: 'number', required: true, profileKey: 'class10Year' },
          { id: 'class10Percentage', label: '10th Percentage', type: 'text', required: true, profileKey: 'class10Percentage' },
          { id: 'class12Board', label: '12th Board', type: 'text', required: true, profileKey: 'class12Board' },
          { id: 'class12Stream', label: '12th Stream', type: 'text', required: true, profileKey: 'class12Stream' },
          { id: 'class12Year', label: '12th Passing Year', type: 'number', required: true, profileKey: 'class12Year' },
          { id: 'class12Percentage', label: '12th Percentage', type: 'text', required: true, profileKey: 'class12Percentage' },
        ]
      },
      {
        id: 'identity',
        title: 'Identity Documents',
        fields: [
          { id: 'aadhaar', label: 'Aadhaar Number', type: 'text', required: true, profileKey: 'aadhaarNumber' },
        ]
      }
    ]
  },
  {
    id: 'railway-ntpc',
    name: 'RRB NTPC (Non-Technical Popular Categories)',
    organization: 'Railway Recruitment Board',
    sections: [
      {
        id: 'personal',
        title: 'Personal Details',
        fields: [
          { id: 'fullName', label: 'Candidate Name', type: 'text', required: true, profileKey: 'fullName' },
          { id: 'fatherName', label: "Father's Name", type: 'text', required: true, profileKey: 'fatherName' },
          { id: 'motherName', label: "Mother's Name", type: 'text', required: true, profileKey: 'motherName' },
          { id: 'dob', label: 'Date of Birth', type: 'date', required: true, profileKey: 'dateOfBirth' },
          { id: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Transgender'], required: true, profileKey: 'gender' },
          { id: 'category', label: 'Category', type: 'select', options: ['General/UR', 'OBC-NCL', 'SC', 'ST', 'EWS'], required: true, profileKey: 'category' },
          { id: 'nationality', label: 'Nationality', type: 'text', required: true, profileKey: 'nationality' },
          { id: 'domicileState', label: 'Domicile State', type: 'text', required: true, profileKey: 'domicileState' },
        ]
      },
      {
        id: 'contact',
        title: 'Communication Details',
        fields: [
          { id: 'mobile', label: 'Mobile Number', type: 'text', required: true, profileKey: 'mobileNumber' },
          { id: 'email', label: 'Email Address', type: 'text', required: true, profileKey: 'email' },
          { id: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, profileKey: 'permanentAddress' },
          { id: 'state', label: 'State', type: 'text', required: true, profileKey: 'state' },
          { id: 'district', label: 'District', type: 'text', required: true, profileKey: 'district' },
          { id: 'pinCode', label: 'PIN Code', type: 'number', required: true, profileKey: 'pinCode' },
        ]
      },
      {
        id: 'education',
        title: 'Educational Qualifications',
        fields: [
          { id: 'class10Board', label: 'Matric Board', type: 'text', required: true, profileKey: 'class10Board' },
          { id: 'class10Year', label: 'Matric Year of Passing', type: 'number', required: true, profileKey: 'class10Year' },
          { id: 'class10Percentage', label: 'Matric Percentage', type: 'text', required: true, profileKey: 'class10Percentage' },
          { id: 'class12Board', label: '12th Board', type: 'text', required: false, profileKey: 'class12Board' },
          { id: 'class12Year', label: '12th Year of Passing', type: 'number', required: false, profileKey: 'class12Year' },
          { id: 'graduationDegree', label: 'Degree', type: 'text', required: true, profileKey: 'graduationDegree' },
          { id: 'graduationUniversity', label: 'University/College', type: 'text', required: true, profileKey: 'graduationUniversity' },
          { id: 'graduationYear', label: 'Degree Year of Passing', type: 'number', required: true, profileKey: 'graduationYear' },
          { id: 'graduationPercentage', label: 'Degree Percentage', type: 'text', required: true, profileKey: 'graduationPercentage' },
        ]
      },
      {
        id: 'identity',
        title: 'Identity Proof',
        fields: [
          { id: 'aadhaar', label: 'Aadhaar Card Number', type: 'text', required: true, profileKey: 'aadhaarNumber' },
        ]
      }
    ]
  },
  {
    id: 'upsc-cse',
    name: 'UPSC Civil Services (Prelims)',
    organization: 'Union Public Service Commission',
    sections: [
      {
        id: 'personal',
        title: 'Personal Particulars',
        fields: [
          { id: 'fullName', label: 'Name (in full)', type: 'text', required: true, profileKey: 'fullName' },
          { id: 'fatherName', label: "Father's Name", type: 'text', required: true, profileKey: 'fatherName' },
          { id: 'motherName', label: "Mother's Name", type: 'text', required: true, profileKey: 'motherName' },
          { id: 'dob', label: 'Date of Birth', type: 'date', required: true, profileKey: 'dateOfBirth' },
          { id: 'gender', label: 'Sex', type: 'select', options: ['Male', 'Female', 'Third Gender'], required: true, profileKey: 'gender' },
          { id: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Unmarried', 'Married', 'Widowed', 'Divorced', 'Judicially Separated'], required: true, profileKey: 'maritalStatus' },
          { id: 'nationality', label: 'Nationality', type: 'text', required: true, profileKey: 'nationality' },
          { id: 'category', label: 'Community', type: 'select', options: ['General', 'OBC', 'SC', 'ST', 'EWS'], required: true, profileKey: 'category' },
        ]
      },
      {
        id: 'contact',
        title: 'Contact Information',
        fields: [
          { id: 'mobile', label: 'Mobile Number', type: 'text', required: true, profileKey: 'mobileNumber' },
          { id: 'email', label: 'Email ID', type: 'text', required: true, profileKey: 'email' },
          { id: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, profileKey: 'permanentAddress' },
          { id: 'correspondenceAddress', label: 'Correspondence Address', type: 'textarea', required: true, profileKey: 'correspondenceAddress' },
          { id: 'state', label: 'State of Domicile', type: 'text', required: true, profileKey: 'state' },
        ]
      },
      {
        id: 'education',
        title: 'Educational Details',
        fields: [
          { id: 'graduationDegree', label: 'Degree Held', type: 'text', required: true, profileKey: 'graduationDegree' },
          { id: 'graduationSubject', label: 'Subject', type: 'text', required: true, profileKey: 'graduationSubject' },
          { id: 'graduationUniversity', label: 'University/Institution', type: 'text', required: true, profileKey: 'graduationUniversity' },
          { id: 'graduationYear', label: 'Year of Passing', type: 'number', required: true, profileKey: 'graduationYear' },
          { id: 'postGraduationDegree', label: 'Post Graduate Degree (if any)', type: 'text', required: false, profileKey: 'postGraduationDegree' },
          { id: 'postGraduationSubject', label: 'PG Subject', type: 'text', required: false, profileKey: 'postGraduationSubject' },
        ]
      },
      {
        id: 'identity',
        title: 'Identity & Payment',
        fields: [
          { id: 'aadhaar', label: 'Aadhaar Number', type: 'text', required: true, profileKey: 'aadhaarNumber' },
        ]
      }
    ]
  },
  {
    id: 'ibps-po',
    name: 'IBPS PO (Probationary Officer)',
    organization: 'Institute of Banking Personnel Selection',
    sections: [
      {
        id: 'personal',
        title: 'Personal Details',
        fields: [
          { id: 'fullName', label: 'Full Name', type: 'text', required: true, profileKey: 'fullName' },
          { id: 'fatherName', label: "Father's Name", type: 'text', required: true, profileKey: 'fatherName' },
          { id: 'motherName', label: "Mother's Name", type: 'text', required: true, profileKey: 'motherName' },
          { id: 'dob', label: 'Date of Birth', type: 'date', required: true, profileKey: 'dateOfBirth' },
          { id: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], required: true, profileKey: 'gender' },
          { id: 'category', label: 'Category', type: 'select', options: ['General', 'OBC', 'SC', 'ST', 'EWS'], required: true, profileKey: 'category' },
          { id: 'maritalStatus', label: 'Marital Status', type: 'select', options: ['Single', 'Married', 'Divorced', 'Widowed'], required: true, profileKey: 'maritalStatus' },
        ]
      },
      {
        id: 'contact',
        title: 'Address Details',
        fields: [
          { id: 'mobile', label: 'Mobile Number', type: 'text', required: true, profileKey: 'mobileNumber' },
          { id: 'email', label: 'Email ID', type: 'text', required: true, profileKey: 'email' },
          { id: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, profileKey: 'permanentAddress' },
          { id: 'state', label: 'State', type: 'text', required: true, profileKey: 'state' },
          { id: 'pinCode', label: 'Pin Code', type: 'number', required: true, profileKey: 'pinCode' },
        ]
      },
      {
        id: 'education',
        title: 'Educational Qualifications',
        fields: [
          { id: 'graduationDegree', label: 'Degree', type: 'text', required: true, profileKey: 'graduationDegree' },
          { id: 'graduationSubject', label: 'Stream/Subject', type: 'text', required: true, profileKey: 'graduationSubject' },
          { id: 'graduationUniversity', label: 'University', type: 'text', required: true, profileKey: 'graduationUniversity' },
          { id: 'graduationYear', label: 'Year of Passing', type: 'number', required: true, profileKey: 'graduationYear' },
          { id: 'graduationPercentage', label: 'Percentage/CGPA', type: 'text', required: true, profileKey: 'graduationPercentage' },
        ]
      },
      {
        id: 'identity',
        title: 'Identity & Bank Details',
        fields: [
          { id: 'aadhaar', label: 'Aadhaar Number', type: 'text', required: true, profileKey: 'aadhaarNumber' },
          { id: 'pan', label: 'PAN Number', type: 'text', required: false, profileKey: 'panNumber' },
          { id: 'bankName', label: 'Bank Name', type: 'text', required: true, profileKey: 'bankName' },
          { id: 'accountNumber', label: 'Account Number', type: 'text', required: true, profileKey: 'accountNumber' },
          { id: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, profileKey: 'ifscCode' },
        ]
      }
    ]
  }
];
