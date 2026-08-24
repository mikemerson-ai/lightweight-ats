"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CandidateDocument, DocumentStatus } from "@/types/documents";

export async function getCandidateDocuments(
  candidateId: string,
): Promise<CandidateDocument[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data as CandidateDocument[]) ?? [];
}

export async function updateDocumentStatus(
  docId: string,
  status: DocumentStatus,
  verifiedBy?: string,
  notes?: string,
): Promise<void> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status };

  if (status === "Verified") {
    updateData.verified_by = verifiedBy ?? null;
    updateData.verified_at = new Date().toISOString();
  }

  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const { error } = await supabase
    .from("candidate_documents")
    .update(updateData)
    .eq("id", docId);

  if (error) {
    throw new Error(error.message);
  }

  const { data: doc, error: fetchError } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("id", docId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const document = doc as CandidateDocument;

  const { error: logError } = await supabase.from("activity_logs").insert({
    candidate_id: document.candidate_id,
    activity_type: "Document Updated",
    notes:
      notes ??
      `"${document.document_name}" status changed to ${status}`,
  });

  if (logError) {
    throw new Error(logError.message);
  }

  revalidatePath("/");
}

export interface UpdateDocumentRecordPayload {
  status?: string;
  sharepointUrl?: string;
  dateIssued?: string;
  dateExpired?: string;
  verifiedBy?: string;
}

export async function updateDocumentRecord(
  docId: string,
  payload: UpdateDocumentRecordPayload,
): Promise<void> {
  const supabase = await createClient();

  const { data: doc, error: fetchError } = await supabase
    .from("candidate_documents")
    .select("*")
    .eq("id", docId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  const document = doc as CandidateDocument | null;

  const resultingStatus =
    payload.status ?? document?.status ?? null;
  const resultingExpiration =
    payload.dateExpired ?? document?.date_expired ?? null;

  if (
    document?.requires_expiration &&
    (resultingStatus === "Submitted" || resultingStatus === "Verified") &&
    !resultingExpiration
  ) {
    throw new Error(
      "An expiration date is required for this document before it can be marked as Submitted or Verified.",
    );
  }

  const updateData: Record<string, unknown> = {};

  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }
  if (payload.sharepointUrl !== undefined) {
    updateData.sharepoint_url = payload.sharepointUrl;
  }
  if (payload.dateIssued !== undefined) {
    updateData.date_issued = payload.dateIssued;
  }
  if (payload.dateExpired !== undefined) {
    updateData.date_expired = payload.dateExpired;
  }
  if (payload.verifiedBy !== undefined) {
    updateData.verified_by = payload.verifiedBy;
  }
  if (resultingStatus === "Verified") {
    updateData.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("candidate_documents")
    .update(updateData)
    .eq("id", docId);

  if (error) {
    throw new Error(error.message);
  }

  const statusNote =
    payload.status !== undefined ? ` - status: ${payload.status}` : "";

  const { error: logError } = await supabase.from("activity_logs").insert({
    candidate_id: document?.candidate_id,
    activity_type: "Document Updated",
    notes: `"${document?.document_name ?? "Document"}" updated${statusNote}`,
  });

  if (logError) {
    throw new Error(logError.message);
  }

  revalidatePath("/");
}

export async function getExpiringDocuments(
  withinDays = 30,
): Promise<CandidateDocument[]> {
  const supabase = await createClient();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + withinDays);

  const { data, error } = await supabase
    .from("candidate_documents")
    .select("*")
    .not("date_expired", "is", null)
    .lte("date_expired", cutoff.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return (data as CandidateDocument[]) ?? [];
}

export async function addDocumentRequirement(
  candidateId: string,
  documentName: string,
  category?: string,
  requiresExpiration: boolean = false,
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.from("candidate_documents").insert({
    candidate_id: candidateId,
    document_name: documentName,
    category: category ?? null,
    status: "Pending",
    requires_expiration: requiresExpiration,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}