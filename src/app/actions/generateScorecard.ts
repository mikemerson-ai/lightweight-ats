'use server';

import mammoth from 'mammoth';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { evaluateResumeAgainstJD, type ScorecardResult } from '@/lib/gemini/evaluator';

export interface GenerateScorecardResult {
  success: boolean;
  scorecard?: ScorecardResult;
  error?: string;
}

export async function generateCandidateScorecard(formData: FormData): Promise<GenerateScorecardResult> {
  try {
    const candidateId = formData.get('candidateId') as string;
    const file = formData.get('file');
    const directText = formData.get('text') as string | null;

    if (!candidateId) {
      return { success: false, error: 'Candidate ID is required' };
    }

    const supabase = await createClient();

    // 1. Fetch candidate and job details
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('*, jobs(id, title, description, requirements)')
      .eq('id', candidateId)
      .single();

    if (candidateError || !candidate) {
      return { success: false, error: 'Candidate not found' };
    }

    const job = candidate.jobs as { id: string; title: string; description: string; requirements?: string } | null;
    if (!job || !job.description || job.description.trim().length === 0) {
      return {
        success: false,
        error: 'Target job description is missing. A valid job description is required for scorecard evaluation.',
      };
    }

    // 2. Prepare resume payload (File, Direct text, or Profile History fallback)
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
    } else if (directText && directText.trim().length > 0) {
      payload = directText;
    } else {
      // Fallback: Construct candidate profile text from existing DB fields
      let profileText = `Candidate Name: ${candidate.first_name} ${candidate.last_name}\n`;
      if (candidate.email) profileText += `Email: ${candidate.email}\n`;
      if (candidate.phone) profileText += `Phone: ${candidate.phone}\n`;
      if (candidate.years_of_experience) profileText += `Years of Experience: ${candidate.years_of_experience}\n`;
      if (candidate.primary_skills) profileText += `Key Skills: ${candidate.primary_skills}\n`;
      if (candidate.ai_summary) profileText += `Summary Profile: ${candidate.ai_summary}\n`;

      if (candidate.work_experience && Array.isArray(candidate.work_experience) && candidate.work_experience.length > 0) {
        profileText += `\nWork Experience:\n`;
        candidate.work_experience.forEach((exp: { jobTitle?: string; company?: string; dates?: string; summary?: string }) => {
          profileText += `- ${exp.jobTitle || 'Role'} at ${exp.company || 'Company'} (${exp.dates || 'Dates'}): ${exp.summary || ''}\n`;
        });
      }

      if (profileText.trim().length < 40) {
        return {
          success: false,
          error: 'No resume document or profile history available. Please attach a resume file to generate the scorecard.',
        };
      }
      payload = profileText;
    }

    // 3. Execute deep evaluation with Gemini
    const scorecard = await evaluateResumeAgainstJD(payload, {
      title: job.title,
      description: job.description,
      requirements: job.requirements,
    });

    // 4. Map recommendation and aggregate score to evaluations table
    // 0-100 score mapped to 5-star scale for DB compatibility
    const aggregateScore = Math.round((scorecard.fitScore / 20) * 10) / 10;
    
    let dbRecommendation = 'Hold';
    if (scorecard.recommendation === 'STRONG PURSUE') dbRecommendation = 'Strong Hire';
    else if (scorecard.recommendation === 'CONDITIONAL SCREEN') dbRecommendation = 'Hire';
    else if (scorecard.recommendation === 'DO NOT ADVANCE') dbRecommendation = 'Reject';

    // 5. Store evaluation record
    await supabase.from('evaluations').insert({
      candidate_id: candidateId,
      reviewer_name: 'AI Talent Evaluator',
      recommendation: dbRecommendation,
      scores: {
        hard_gates_match: Math.min(5, Math.max(1, Math.round(scorecard.fitScore / 20))),
        experience_impact: Math.min(5, Math.max(1, Math.round(scorecard.fitScore / 20))),
      },
      aggregate_score: aggregateScore,
      notes: scorecard.markdown,
    });

    // 6. Log activity entry
    await supabase.from('activity_logs').insert({
      candidate_id: candidateId,
      activity_type: 'AI Scorecard Generated',
      notes: `Generated deep evaluation scorecard: ${scorecard.recommendation} (${scorecard.fitScore}/100)`,
    });

    revalidatePath('/');

    return {
      success: true,
      scorecard,
    };
  } catch (error: unknown) {
    console.error('Error generating candidate scorecard:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred while generating the scorecard',
    };
  }
}
