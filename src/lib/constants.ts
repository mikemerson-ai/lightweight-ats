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


const DSP_JOB_TITLE_MATCHES = ["direct support professional", "dsp"] as const;
const HHA_JOB_TITLE_MATCHES = ["home health aide", "hha"] as const;

export function getCandidateRole(title: string | null | undefined): "dsp" | "hha" | null {
  const normalized = (title ?? "").trim().toLowerCase();
  if (!normalized) return null;

  const isDsp = DSP_JOB_TITLE_MATCHES.some((match) => {
    if (normalized === match) return true;
    return new RegExp(`(^|[^a-z0-9])${match}([^a-z0-9]|$)`).test(normalized);
  });
  if (isDsp) return "dsp";

  const isHha = HHA_JOB_TITLE_MATCHES.some((match) => {
    if (normalized === match) return true;
    return new RegExp(`(^|[^a-z0-9])${match}([^a-z0-9]|$)`).test(normalized);
  });
  if (isHha) return "hha";

  return null;
}
