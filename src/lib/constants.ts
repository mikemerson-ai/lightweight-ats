export const SOURCING_CHANNELS = [
  "LinkedIn",
  "Indeed",
  "Internal Database",
  "Other",
] as const;

export const APPLIED_CHANNELS = [
  "Company Careers Page",
  "Indeed Apply",
  "LinkedIn Apply",
  "Direct Referral",
  "Other",
] as const;

export type SourcingChannel = string;
