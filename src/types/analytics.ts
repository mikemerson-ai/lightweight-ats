export interface PipelineFunnelMetric {
  stage: string;
  count: number;
  percentage: number;
}

export interface DisqualificationReasonMetric {
  reason: string;
  count: number;
  percentage: number;
}

export interface RecruiterMetric {
  recruiterName: string;
  candidatesManaged: number;
  evaluationsCount: number;
  documentsVerified: number;
}

export interface AnalyticsOverview {
  totalActive: number;
  totalHired: number;
  totalDisqualified: number;
  offerAcceptanceRate: number;
  avgDaysInStage: number;
}

export interface SourcingChannelMetric {
  channel: string;
  totalCandidates: number;
  hiredCount: number;
  conversionRate: number;
}

export interface ComplianceAlertItem {
  candidateId: string;
  candidateName: string;
  documentName: string;
  category: string;
  dateExpired: string;
  daysRemaining: number;
  isOverdue: boolean;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  funnel: PipelineFunnelMetric[];
  disqualificationReasons: DisqualificationReasonMetric[];
  recruiterActivity: RecruiterMetric[];
  sourcingPerformance: SourcingChannelMetric[];
  complianceAlerts: ComplianceAlertItem[];
  offersPendingVsSigned: { pending: number; signed: number };
}