export const SOURCING_CHANNELS = [
  "LinkedIn",
  "Indeed",
  "Employee Referral",
  "Headhunter / Agency",
  "Talent Pool Rediscovery",
] as const;

export const APPLIED_CHANNELS = [
  "Job Board / Career Site",
  "Application Form",
  "Walk-in",
] as const;

export type SourcingChannel = string;
