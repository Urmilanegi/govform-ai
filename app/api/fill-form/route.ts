import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { EXAM_FORMS } from '@/lib/exam-templates';
import { ExtractedProfile, FilledForm, FilledSection, FilledField } from '@/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { examId, profile }: { examId: string; profile: ExtractedProfile } = body;

    const exam = EXAM_FORMS.find(e => e.id === examId);
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
    }

    const hasProfileData = Object.values(profile || {}).some(value => {
      if (value === null || value === undefined) return false;
      return String(value).trim() !== '';
    });

    if (!hasProfileData) {
      return NextResponse.json(
        { success: false, error: 'Uploaded documents se koi real profile data nahi mila.' },
        { status: 400 }
      );
    }

    // First, do direct mapping from profile
    const directlyMapped: Record<string, string> = {};

    for (const section of exam.sections) {
      for (const field of section.fields) {
        if (field.profileKey && profile[field.profileKey]) {
          directlyMapped[field.id] = String(profile[field.profileKey]);
        }
      }
    }

    // No API key → skip AI, use direct mapping only
    const hasApiKey = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'your_api_key_here';
    if (!hasApiKey) {
      const filledSectionsFallback: FilledSection[] = exam.sections.map(section => ({
        id: section.id,
        title: section.title,
        fields: section.fields.map((field): FilledField => {
          const directValue = directlyMapped[field.id];
          return {
            id: field.id, label: field.label,
            value: directValue || '',
            source: directValue ? 'ai' : 'empty',
            confidence: directValue ? 'high' : 'low',
          };
        })
      }));
      const allF = filledSectionsFallback.flatMap(s => s.fields);
      const filled = allF.filter(f => f.value).length;
      const missing = exam.sections.flatMap(s =>
        s.fields.filter(f => f.required && !directlyMapped[f.id]).map(f => f.label)
      );
      return NextResponse.json({ success: true, filledForm: {
        examId, examName: exam.name,
        sections: filledSectionsFallback,
        completionPercentage: Math.round((filled / allF.length) * 100),
        missingFields: missing,
      }});
    }

    // Use AI to intelligently fill remaining fields and validate
    const formStructure = exam.sections.map(s => ({
      section: s.title,
      fields: s.fields.map(f => ({
        id: f.id,
        label: f.label,
        type: f.type,
        options: f.options,
        required: f.required,
        currentValue: directlyMapped[f.id] || null
      }))
    }));

    const aiPrompt = `You are an expert at filling Indian government job application forms.

Student's extracted profile data:
${JSON.stringify(profile, null, 2)}

Form to fill: ${exam.name} (${exam.organization})

Form structure:
${JSON.stringify(formStructure, null, 2)}

Some fields already have values mapped directly. For remaining fields:
1. Use the profile data intelligently to fill fields
2. For select/radio fields, match the exact option from the provided options list
3. If data is missing or ambiguous, leave the field empty
4. For address fields, format properly
5. For category fields: OBC-NCL = OBC, UR = General

CRITICAL RULES:
- Never invent or guess personal details.
- Never create fake name, parents' names, DOB, phone, email, address, school, college, marks, bank details, ID numbers, category, religion, gender, or marital status.
- Only fill a field when it can be copied or deterministically transformed from the provided profile data.
- If you are not sure, return an empty string and confidence "low".

Return a JSON object where keys are field IDs and values are:
{
  "fieldId": {
    "value": "the filled value or empty string",
    "confidence": "high/medium/low",
    "note": "optional note about how this was filled or if manual verification needed"
  }
}

CRITICAL: Only return the JSON object, no other text.`;

    const aiResponse = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: aiPrompt }]
    });

    const textContent = aiResponse.content.find(b => b.type === 'text');
    let aiMappings: Record<string, { value: string; confidence: string; note?: string }> = {};

    if (textContent && textContent.type === 'text') {
      try {
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          aiMappings = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error('Failed to parse AI response');
      }
    }

    // Build final filled form
    const filledSections: FilledSection[] = exam.sections.map(section => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field): FilledField => {
        const directValue = directlyMapped[field.id];
        const aiMapping = aiMappings[field.id];

        let value = '';
        let source: 'ai' | 'manual' | 'empty' = 'empty';
        let confidence: 'high' | 'medium' | 'low' = 'low';
        let note: string | undefined;

        if (directValue) {
          value = directValue;
          source = 'ai';
          confidence = 'high';
        } else if (aiMapping?.value) {
          value = aiMapping.value;
          source = 'ai';
          confidence = (aiMapping.confidence as 'high' | 'medium' | 'low') || 'medium';
          note = aiMapping.note;
        }

        return { id: field.id, label: field.label, value, source, confidence, note };
      })
    }));

    const allFields = filledSections.flatMap(s => s.fields);
    const filledFields = allFields.filter(f => f.value && f.value.trim() !== '');
    const completionPercentage = Math.round((filledFields.length / allFields.length) * 100);

    const requiredEmptyFields = exam.sections.flatMap(s =>
      s.fields.filter(f => {
        if (!f.required) return false;
        const filled = filledSections
          .find(fs => fs.id === s.id)
          ?.fields.find(ff => ff.id === f.id);
        return !filled?.value || filled.value.trim() === '';
      }).map(f => f.label)
    );

    const filledForm: FilledForm = {
      examId,
      examName: exam.name,
      sections: filledSections,
      completionPercentage,
      missingFields: requiredEmptyFields
    };

    return NextResponse.json({ success: true, filledForm });
  } catch (error) {
    console.error('Fill form error:', error);
    return NextResponse.json(
      { error: 'Failed to fill form', details: String(error) },
      { status: 500 }
    );
  }
}
