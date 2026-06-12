import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { execFile } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { promisify } from 'util';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const execFileAsync = promisify(execFile);

function guessMimeTypeFromName(fileName: string) {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName.endsWith('.pdf')) return 'application/pdf';
  if (normalizedName.endsWith('.jpg') || normalizedName.endsWith('.jpeg')) return 'image/jpeg';
  if (normalizedName.endsWith('.png')) return 'image/png';
  if (normalizedName.endsWith('.gif')) return 'image/gif';
  if (normalizedName.endsWith('.webp')) return 'image/webp';
  if (normalizedName.endsWith('.heic')) return 'image/heic';
  if (normalizedName.endsWith('.heif')) return 'image/heif';

  return '';
}

function resolveMimeType(fileName: string, reportedMimeType: string) {
  const guessedMimeType = guessMimeTypeFromName(fileName);

  if (!reportedMimeType) {
    return guessedMimeType;
  }

  const normalizedReportedMimeType = reportedMimeType.toLowerCase();
  if (
    normalizedReportedMimeType === 'application/octet-stream' ||
    normalizedReportedMimeType === 'binary/octet-stream'
  ) {
    return guessedMimeType || normalizedReportedMimeType;
  }

  return normalizedReportedMimeType;
}

// Pure-JS HEIC decode (libheif WASM) — Linux/Render pe bhi chalta hai
async function convertHeicWithLib(bytes: Buffer): Promise<Buffer> {
  // @ts-expect-error — heic-convert has no type declarations
  const heicConvert = (await import('heic-convert')).default;
  const output = await heicConvert({ buffer: bytes, format: 'JPEG', quality: 0.85 });
  return Buffer.from(output);
}

async function convertHeicWithSips(bytes: Buffer, fileName: string) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'govform-heic-'));
  const inputPath = path.join(tempDir, fileName || 'upload.heic');
  const outputPath = path.join(tempDir, 'converted.jpg');

  try {
    await writeFile(inputPath, bytes);
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'jpeg', inputPath, '--out', outputPath]);
    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function errorResponse(error: string, status: number, details?: string) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(details ? { details } : {})
    },
    { status }
  );
}

function cleanExtractedData(rawData: Record<string, unknown>) {
  const cleaned: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawData)) {
    if (value === null || value === undefined) continue;

    const normalized = String(value).trim();
    if (!normalized) continue;

    const lowered = normalized.toLowerCase();
    if (lowered === 'null' || lowered === 'undefined' || lowered === 'n/a') continue;

    if (key === 'aadhaarNumber') {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length >= 12) {
        cleaned[key] = `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
        continue;
      }
    }

    if (key === 'aadhaarVid') {
      const digits = normalized.replace(/\D/g, '');
      if (digits.length >= 16) {
        cleaned[key] = `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`;
        continue;
      }
    }

    if ((key === 'class10Board' || key === 'class12Board') && /board of secondary education[, ]+(rajasthan|ajmer)/i.test(normalized)) {
      cleaned[key] = 'Board of Secondary Education, Rajasthan';
      continue;
    }

    cleaned[key] = normalized;
  }

  if (!cleaned.correspondenceAddress && cleaned.permanentAddress) {
    cleaned.correspondenceAddress = cleaned.permanentAddress;
  }

  if (!cleaned.highestQualification) {
    if (cleaned.postGraduationDegree || cleaned.postGraduationYear || cleaned.postGraduationPercentage) {
      cleaned.highestQualification = 'Post Graduate';
    } else if (cleaned.graduationDegree || cleaned.graduationYear || cleaned.graduationUniversity) {
      cleaned.highestQualification = 'Graduate';
    } else if (cleaned.class12Year || cleaned.class12Board || cleaned.class12School) {
      cleaned.highestQualification = '12th Pass';
    } else if (cleaned.class10Year || cleaned.class10Board || cleaned.class10School) {
      cleaned.highestQualification = '10th Pass';
    }
  }

  return cleaned;
}

async function normalizeImageForVision(bytes: Buffer, mimeType: string, fileName: string): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const image = sharp(bytes, { failOn: 'none' }).rotate();
    const metadata = await image.metadata();
    // 1568px is the model's effective max — bigger images sirf upload/processing
    // slow karti hain, accuracy same rehti hai. Phone photos (4-8MB) yahan
    // ~200-400KB ban jaati hain = much faster on mobile networks.
    const requiresConversion =
      !SUPPORTED_IMAGE_MIME_TYPES.has(mimeType) ||
      bytes.length > 500 * 1024 ||
      (metadata.width ?? 0) > 1568 ||
      (metadata.height ?? 0) > 1568;

    if (!requiresConversion) {
      return {
        buffer: bytes,
        mimeType
      };
    }

    const normalizedBuffer = await image
      .resize({
        width: 1568,
        height: 1568,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 82,
        mozjpeg: true
      })
      .toBuffer();

    return {
      buffer: normalizedBuffer,
      mimeType: 'image/jpeg'
    };
  } catch (error) {
    const isHeicFile = mimeType === 'image/heic' || mimeType === 'image/heif';
    const jpegName = fileName.replace(/\.(heic|heif)$/i, '.jpg');

    if (isHeicFile) {
      // Pehle pure-JS converter (Linux/Render), phir macOS sips fallback
      try {
        const convertedBuffer = await convertHeicWithLib(bytes);
        return normalizeImageForVision(convertedBuffer, 'image/jpeg', jpegName);
      } catch (libError) {
        console.error('heic-convert failed:', libError);
        if (process.platform === 'darwin') {
          const convertedBuffer = await convertHeicWithSips(bytes, fileName);
          return normalizeImageForVision(convertedBuffer, 'image/jpeg', jpegName);
        }
        throw new Error(
          `iPhone photo "${fileName}" convert nahi ho paayi. Photo ka screenshot leke upload karo, ya iPhone pe Settings > Camera > Formats > "Most Compatible" karke nayi photo lo.`
        );
      }
    }

    throw new Error(`Image "${fileName}" process nahi ho paayi — file corrupt ya unsupported format hai. JPG/PNG try karo.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const documents: { type: string; base64: string; mimeType: string; name: string }[] = [];

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('doc_') && value instanceof File) {
        const docType = key.replace('doc_', '');
        const fileBuffer = Buffer.from(await value.arrayBuffer());
        const detectedMimeType = resolveMimeType(value.name, value.type);

        if (detectedMimeType === 'application/pdf') {
          documents.push({
            type: docType,
            base64: fileBuffer.toString('base64'),
            mimeType: detectedMimeType,
            name: value.name
          });
          continue;
        }

        if (detectedMimeType.startsWith('image/')) {
          const normalizedImage = await normalizeImageForVision(fileBuffer, detectedMimeType, value.name);
          documents.push({
            type: docType,
            base64: normalizedImage.buffer.toString('base64'),
            mimeType: normalizedImage.mimeType,
            name: value.name
          });
          continue;
        }

        return errorResponse(`Unsupported file type: ${value.name}`, 400);
      }
    }

    const hasApiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_api_key_here';
    if (!hasApiKey) {
      return errorResponse('AI document parsing abhi configured nahi hai.', 500);
    }

    if (documents.length === 0) {
      return errorResponse('Koi document upload nahi hua.', 400);
    }

    const contentBlocks: Anthropic.MessageParam['content'] = [];

    contentBlocks.push({
      type: 'text',
      text: `You are an expert at extracting information from Indian government documents.

I will show you documents uploaded by a student for government exam form filling. Extract ALL available information accurately.

Documents being provided: ${documents.map(d => `${d.type} (${d.name})`).join(', ')}

Extract and return a JSON object with these exact fields (use null for missing fields):
{
  "fullName": "",
  "fatherName": "",
  "motherName": "",
  "dateOfBirth": "DD/MM/YYYY format",
  "gender": "Male/Female/Transgender",
  "nationality": "",
  "religion": "",
  "category": "General/OBC/SC/ST/EWS",
  "maritalStatus": "",
  "mobileNumber": "",
  "email": "",
  "permanentAddress": "",
  "correspondenceAddress": "",
  "pinCode": "",
  "state": "",
  "district": "",
  "aadhaarNumber": "12 digit Aadhaar number with spaces like 1234 5678 9012",
  "aadhaarVid": "16 digit VID with spaces like 1234 5678 9012 3456",
  "panNumber": "",
  "class10School": "",
  "class10Board": "",
  "class10RollNumber": "",
  "class10Year": "",
  "class10Percentage": "",
  "class10Subjects": "",
  "class12School": "",
  "class12Board": "",
  "class12Year": "",
  "class12Percentage": "",
  "class12Stream": "",
  "graduationCollege": "",
  "graduationUniversity": "",
  "graduationYear": "",
  "graduationPercentage": "",
  "graduationDegree": "",
  "graduationSubject": "",
  "highestQualification": "",
  "postGraduationDegree": "",
  "postGraduationSubject": "",
  "postGraduationYear": "",
  "postGraduationPercentage": "",
  "bankName": "",
  "accountNumber": "",
  "ifscCode": "",
  "domicileState": "",
  "exServiceman": "Yes/No",
  "pwdCategory": "None or specific category",
  "identificationMark": "",
  "height": "",
  "weight": ""
}

IMPORTANT:
- Return exact Aadhaar number if visible in the document. Do not mask digits.
- Return exact VID if visible in the document.
- Extract 10th roll number / roll code if it is visible on the marksheet.
- highestQualification should be a simple value like "10th Pass", "12th Pass", "Graduate", or "Post Graduate" based on the highest qualification visible.
- Extract EXACT text as shown in documents
- For percentages, include the % symbol
- Dates in DD/MM/YYYY format
- For motherName: Check Aadhaar card carefully. On Aadhaar, the line starting with "C/O" or listing a female name after "Mother:" or "Mata:" or the second guardian name is the mother. Also check marksheets — they often list mother's name separately. If Aadhaar shows "S/O" (son of) or "D/O" (daughter of), that is fatherName. If it shows "W/O" that is husband. Look for any female name listed as guardian/parent.
- Return ONLY the JSON object, no other text`
    });

    for (const doc of documents) {
      if (doc.mimeType.startsWith('image/')) {
        contentBlocks.push({
          type: 'text',
          text: `\n--- Document: ${doc.type.toUpperCase().replace(/_/g, ' ')} ---`
        });
        contentBlocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: doc.mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: doc.base64
          }
        });
      } else if (doc.mimeType === 'application/pdf') {
        contentBlocks.push({
          type: 'text',
          text: `\n--- Document: ${doc.type.toUpperCase().replace(/_/g, ' ')} (PDF) ---`
        });
        contentBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: doc.base64
          }
        } as Anthropic.DocumentBlockParam);
      }
    }

    let response;
    try {
      // Haiku 4.5 — fastest vision model; extraction is a simple structured task,
      // no thinking needed (thinking adds latency)
      response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: contentBlocks }]
      });
    } catch (apiErr) {
      console.error('API call failed while parsing documents:', apiErr);
      return errorResponse(
        'Documents parse nahi ho paaye. Clear image ya readable PDF dobara upload karo.',
        502,
        String(apiErr)
      );
    }

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return errorResponse('AI response se extracted text nahi mila.', 502);
    }

    let extractedData: Record<string, unknown>;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse extracted JSON:', parseError);
      return errorResponse('AI response parse nahi ho paaya.', 502);
    }

    const cleanedExtractedData = cleanExtractedData(extractedData);
    if (Object.keys(cleanedExtractedData).length === 0) {
      return errorResponse(
        'Uploaded documents se usable details extract nahi ho paayi. Clear front-side image ya readable PDF upload karo.',
        422
      );
    }

    return NextResponse.json({
      success: true,
      extractedData: cleanedExtractedData,
      extractedFieldCount: Object.keys(cleanedExtractedData).length
    });
  } catch (error) {
    console.error('Parse error:', error);
    // Real reason user ko dikhao — generic message debugging impossible bana deta hai
    const message = error instanceof Error ? error.message : 'Failed to parse documents';
    return NextResponse.json(
      { success: false, error: message, details: String(error) },
      { status: 500 }
    );
  }
}
