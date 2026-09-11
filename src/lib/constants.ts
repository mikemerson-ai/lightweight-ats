export const APPLIED_CHANNELS = [
  "Job Board / Career Site",
  "Application Form",
  "Walk-in",
] as const;

export const SOURCING_CHANNELS = [
  "Employee Referral",
  "Head Hunter / Agency",
  "Talent Pool Rediscovery",
  "LinkedIn",
  "Indeed",
] as const;

export const BATCH_IMPORT_SOURCING_CHANNELS = [
  "Employee Referral",
  "Head Hunter / Agency",
  "Talent Pool Rediscovery",
] as const;

export const ALL_SOURCING_CHANNELS = [
  ...APPLIED_CHANNELS,
  ...SOURCING_CHANNELS,
] as const;

export type SourcingChannel = string;

export function getSourceTypeForChannel(channel: string): "inbound" | "outbound" {
  if (APPLIED_CHANNELS.includes(channel as any)) {
    return "inbound";
  }
  return "outbound";
}

