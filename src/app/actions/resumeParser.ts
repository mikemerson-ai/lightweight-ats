'use server';

import { parseResumeData, ParsedCandidate } from '@/lib/gemini/parser';

export interface ParseResumeResult {
  success: boolean;
  data?: ParsedCandidate;
  error?: string;
}

export async function parseResumeAction(formData: FormData): Promise<ParseResumeResult> {
  try {
    const file = formData.get('file');
    const text = formData.get('text');

    if (!file && !text) {
      return { success: false, error: 'No resume file or text provided' };
    }

    let payload: File | string;

    if (file && file instanceof File && file.size > 0) {
      payload = file;
    } else if (text && typeof text === 'string') {
      payload = text;
    } else {
      return { success: false, error: 'Invalid payload provided' };
    }

    const parsedData = await parseResumeData(payload);

    return {
      success: true,
      data: parsedData
    };
  } catch (error: any) {
    console.error('Error parsing resume:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred while parsing the resume'
    };
  }
}
