"use server";

import { createClient } from "@/lib/supabase/server";

import type {
  AnalyticsData,
  AnalyticsOverview,
  DisqualificationReasonMetric,
  PipelineFunnelMetric,
  RecruiterMetric,
} from "@/types/analytics";

interface CandidateRow {
  id: string;
  pipeline_stage: string;
  status_tag: string;
  disqualification_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  source_channel?: string | null;
}

interface ActivityLogRow {
  candidate_id?: string | null;
  author_name?: string | null;
  activity_type?: string | null;
  notes?: string | null;
}

interface EvaluationRow {
  id: string;
  reviewer_name: string | null;
}

interface CandidateDocumentRow {
  id: string;
  candidate_id: string;
  verified_by?: string | null;
}

export async function getAnalyticsData(
  jobId?: string,
): Promise<AnalyticsData> {
  const supabase = await createClient();

  let candidatesQuery = supabase
    .from("candidates")
    .select("id, pipeline_stage, created_at, updated_at, disqualification_reason, source_channel");

  if (jobId) {
    candidatesQuery = candidatesQuery.eq("job_id", jobId);
  }

  const { data: candidates, error: candidatesError } = await candidatesQuery;

  if (candidatesError) {
    throw new Error(candidatesError.message);
  }

  const rows = (candidates as CandidateRow[]) ?? [];

  const total = rows.length;
  const terminalStages = new Set(["hired", "disqualified"]);
  const activeCandidates = rows.filter(
    (candidate) => !terminalStages.has(candidate.pipeline_stage),
  );

  const totalActive = activeCandidates.length;
  const totalHired = rows.filter(
    (candidate) => candidate.pipeline_stage === "hired",
  ).length;
  const totalDisqualified = rows.filter(
    (candidate) => candidate.pipeline_stage === "disqualified",
  ).length;

  const funnelStages = [
    "new_application",
    "screening",
    "interview",
    "completing_requirements",
    "offer",
    "background_checks",
    "hired",
    "disqualified",
  ];

  const stageCounts = rows.reduce<Record<string, number>>((acc, candidate) => {
    const stage = candidate.pipeline_stage || "unknown";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  const funnel: PipelineFunnelMetric[] = funnelStages.map((stage) => {
    const count = stageCounts[stage] || 0;
      return {
        stage,
        count,
        percentage:
          total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    });

  const offers =
    (stageCounts.offer || 0) + (stageCounts.background_checks || 0) + totalHired;
  const offerAcceptanceRate =
    offers > 0
      ? Math.round((totalHired / offers) * 1000) / 10
      : 0;

  const now = Date.now();
  const totalDaysInStage = activeCandidates.reduce((sum, candidate) => {
    const updatedAt = candidate.updated_at
      ? new Date(candidate.updated_at).getTime()
      : new Date(candidate.created_at ?? new Date().toISOString()).getTime();
    return sum + Math.max(0, (now - updatedAt) / (1000 * 60 * 60 * 24));
  }, 0);
  const avgDaysInStage =
    activeCandidates.length > 0
      ? Math.round((totalDaysInStage / activeCandidates.length) * 10) / 10
      : 0;

  const overview: AnalyticsOverview = {
    totalActive,
    totalHired,
    totalDisqualified,
    offerAcceptanceRate,
    avgDaysInStage,
  };

  const disqualificationReasons =
    extractDisqualificationReasons(rows, total);

  const recruiterActivity = await buildRecruiterActivity(
    jobId,
    rows.length,
  );

  const channelStats: Record<string, { total: number; hired: number }> = {};
  for (const candidate of rows) {
    let channel = candidate.source_channel || "Other";
    if (channel === "LinkedIn Recruiter" || channel === "LinkedIn InMail") channel = "LinkedIn";
    if (channel === "Indeed Resume Database" || channel === "Indeed Resume") channel = "Indeed";
    
    if (!channelStats[channel]) {
      channelStats[channel] = { total: 0, hired: 0 };
    }
    channelStats[channel].total++;
    if (candidate.pipeline_stage === "hired") {
      channelStats[channel].hired++;
    }
  }

  const sourcingPerformance: any[] = Object.entries(channelStats)
    .map(([channel, stats]) => ({
      channel,
      totalCandidates: stats.total,
      hiredCount: stats.hired,
      conversionRate: stats.total > 0 ? Math.round((stats.hired / stats.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.totalCandidates - a.totalCandidates);

  let docsQuery = supabase
    .from("candidate_documents")
    .select(`
      id,
      candidate_id,
      document_name,
      category,
      date_expired,
      status,
      requires_expiration,
      candidates!inner (
        first_name,
        last_name,
        job_id
      )
    `);

  if (jobId) {
    docsQuery = docsQuery.eq("candidates.job_id", jobId);
  }

  const { data: allDocs, error: docsError } = await docsQuery;
  if (docsError) throw new Error(docsError.message);

  const docs = (allDocs || []) as any[];

  let pendingOffers = 0;
  let signedOffers = 0;
  
  const complianceAlerts: any[] = [];
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const doc of docs) {
    if (doc.document_name === "Offer Letter (DocuSign Link)") {
      if (doc.status === "Verified") {
        signedOffers++;
      } else if (doc.status === "Pending" || doc.status === "Submitted") {
        pendingOffers++;
      }
    }

    if (doc.requires_expiration && doc.date_expired) {
      const expDate = new Date(doc.date_expired).getTime();
      const diffMs = expDate - nowMs;
      
      if (diffMs <= thirtyDaysMs) {
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        complianceAlerts.push({
          candidateId: doc.candidate_id,
          candidateName: `${doc.candidates.first_name} ${doc.candidates.last_name}`,
          documentName: doc.document_name,
          category: doc.category || "Uncategorized",
          dateExpired: doc.date_expired,
          daysRemaining: daysRemaining,
          isOverdue: daysRemaining < 0
        });
      }
    }
  }

  complianceAlerts.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    overview,
    funnel,
    disqualificationReasons,
    recruiterActivity,
    sourcingPerformance,
    complianceAlerts,
    offersPendingVsSigned: {
      pending: pendingOffers,
      signed: signedOffers
    }
  };
}

function extractDisqualificationReasons(
  candidates: CandidateRow[],
  total: number,
): DisqualificationReasonMetric[] {
  const reasons: Record<string, number> = {};

  for (const candidate of candidates) {
    if (candidate.pipeline_stage === "disqualified") {
      const reason = candidate.disqualification_reason
        ? candidate.disqualification_reason
        : "No reason provided";
      reasons[reason] = (reasons[reason] || 0) + 1;
    }
  }

  const entries = Object.entries(reasons).sort(
    (a, b) => b[1] - a[1],
  );

  return entries.map(([reason, count]) => ({
    reason,
    count,
    percentage:
      total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
  }));
}

async function buildRecruiterActivity(
  jobId: string | undefined,
  totalCandidates: number,
): Promise<RecruiterMetric[]> {
  const supabase = await createClient();

  const activityQuery = supabase
    .from("activity_logs")
    .select("author_name, candidate_id, activity_type, notes")
    .not("author_name", "is", null);

  const { data: activity, error: activityError } = await activityQuery;
  if (activityError) {
    throw new Error(activityError.message);
  }
  const activityRows = (activity as ActivityLogRow[]) ?? [];

  let evaluations: EvaluationRow[] = [];
  let documents: CandidateDocumentRow[] = [];

  if (jobId) {
    const { data: jobCandidateData, error: jobCandidateError } = await supabase
      .from("candidates")
      .select("id")
      .eq("job_id", jobId);
    if (jobCandidateError) {
      throw new Error(jobCandidateError.message);
    }
    const candidateIds = (jobCandidateData as { id: string }[]).map(
      (candidate) => candidate.id,
    );

    if (candidateIds.length > 0) {
      const { data: evaluationData, error: evaluationError } = await supabase
        .from("evaluations")
        .select("id, reviewer_name")
        .in("candidate_id", candidateIds);
      if (evaluationError) {
        throw new Error(evaluationError.message);
      }
      evaluations = (evaluationData as EvaluationRow[]) ?? [];

      const { data: documentData, error: documentError } = await supabase
        .from("candidate_documents")
        .select("id, candidate_id, verified_by")
        .in("candidate_id", candidateIds)
        .eq("status", "verified");
      if (documentError) {
        throw new Error(documentError.message);
      }
      documents = (documentData as CandidateDocumentRow[]) ?? [];
    }
  } else {
    const { data: evaluationData, error: evaluationError } = await supabase
      .from("evaluations")
      .select("id, reviewer_name");
    if (evaluationError) {
      throw new Error(evaluationError.message);
    }
    evaluations = (evaluationData as EvaluationRow[]) ?? [];

    const { data: documentData, error: documentError } = await supabase
      .from("candidate_documents")
      .select("id, candidate_id, verified_by")
      .eq("status", "verified");
    if (documentError) {
      throw new Error(documentError.message);
    }
    documents = (documentData as CandidateDocumentRow[]) ?? [];
  }

  const managedBy: Record<string, Set<string>> = {};
  for (const entry of activityRows) {
    const name = entry.author_name || "Unknown Recruiter";
    if (!managedBy[name]) {
      managedBy[name] = new Set();
    }
    if (entry.candidate_id) {
      managedBy[name].add(entry.candidate_id);
    }
  }

  const evaluationsByRecruiter: Record<string, number> = {};
  for (const evaluation of evaluations) {
    const name = evaluation.reviewer_name || "Unknown Recruiter";
    evaluationsByRecruiter[name] = (evaluationsByRecruiter[name] || 0) + 1;
  }

  const documentsByRecruiter: Record<string, number> = {};
  for (const document of documents) {
    const name = document.verified_by || "Unknown Recruiter";
    documentsByRecruiter[name] = (documentsByRecruiter[name] || 0) + 1;
  }

  const recruiterNames = new Set<string>([
    ...Object.keys(managedBy),
    ...Object.keys(evaluationsByRecruiter),
    ...Object.keys(documentsByRecruiter),
  ]);

  if (recruiterNames.size === 0 && totalCandidates > 0) {
    return [];
  }

  return Array.from(recruiterNames)
    .sort()
    .map((recruiterName) => ({
      recruiterName,
      candidatesManaged: managedBy[recruiterName]?.size || 0,
      evaluationsCount: evaluationsByRecruiter[recruiterName] || 0,
      documentsVerified: documentsByRecruiter[recruiterName] || 0,
    }));
}