'use server';

import mammoth from 'mammoth';
import { parseResumeData, ParsedCandidate, JobContext } from '@/lib/gemini/parser';
import { createClient } from '@/lib/supabase/server';

export interface ParseResumeResult {
  success: boolean;
  data?: ParsedCandidate;
  error?: string;
}

export async function parseResumeAction(formData: FormData): Promise<ParseResumeResult> {
  try {
    const file = formData.get('file');
    const text = formData.get('text');
    const jobId = formData.get('jobId') as string | undefined;

    if (!file && !text) {
      return { success: false, error: 'No resume file or text provided' };
    }

    let jobContext: JobContext | undefined;
    if (jobId) {
      const supabase = await createClient();
      const { data: job, error } = await supabase
        .from('jobs')
        .select('title, description, requirements')
        .eq('id', jobId)
        .single();
        
      if (error || !job || !job.description || job.description.trim().length === 0) {
        return { success: false, error: 'Job context missing or empty. Cannot parse resume without a valid job description.' };
      }

      jobContext = {
        title: job.title,
        description: job.description,
        requirements: job.requirements || '',
      };
    }

    let payload: File | string;

    if (file && file instanceof File && file.size > 0) {
      const fileType = file.type;
      const isDocx = fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.toLowerCase().endsWith('.docx');

      if (isDocx) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await mammoth.extractRawText({ buffer });
        payload = result.value;
      } else {
        payload = file;
      }
    } else if (text && typeof text === 'string') {
      payload = text;
    } else {
      return { success: false, error: 'Invalid payload provided' };
    }

    const parsedData = await parseResumeData(payload, jobContext);

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
