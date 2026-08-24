"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Settings, GripVertical, Check } from "lucide-react";
import { getScorecardTemplate, saveScorecardTemplate } from "@/app/actions/evaluations";
import { type ScorecardTemplate, type ScorecardCriterion } from "@/types/evaluations";

interface ScorecardBuilderModalProps {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
}

const PRESETS = {
  clinical: [
    { id: "clinical_knowledge", name: "Clinical Knowledge & Expertise" },
    { id: "patient_care", name: "Patient Care & Communication" },
    { id: "adaptability", name: "Adaptability & Pressure Management" },
    { id: "compliance", name: "Safety & Compliance Standards" },
  ],
  instructional: [
    { id: "subject_matter", name: "Subject Matter Expertise" },
    { id: "pedagogy", name: "Instructional Design & Pedagogy" },
    { id: "classroom_management", name: "Classroom Management" },
    { id: "communication", name: "Communication & Engagement" },
  ],
};

export function ScorecardBuilderModal({ jobId, open, onClose }: ScorecardBuilderModalProps) {
  const [template, setTemplate] = useState<ScorecardTemplate | null>(null);
  const [templateName, setTemplateName] = useState("Custom Template");
  const [criteria, setCriteria] = useState<ScorecardCriterion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && jobId) {
      loadTemplate();
    }
  }, [open, jobId]);

  async function loadTemplate() {
    if (!jobId) return;
    setLoading(true);
    setError("");
    try {
      const t = await getScorecardTemplate(jobId);
      setTemplate(t);
      setTemplateName(t.template_name || "Custom Template");
      setCriteria(t.criteria || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }

  function addCriterion() {
    const newId = `criterion_${Date.now()}`;
    setCriteria([...criteria, { id: newId, name: "New Criterion" }]);
  }

  function removeCriterion(id: string) {
    setCriteria(criteria.filter((c) => c.id !== id));
  }

  function updateCriterion(id: string, name: string) {
    setCriteria(criteria.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  function applyPreset(presetKey: "clinical" | "instructional") {
    setCriteria(PRESETS[presetKey].map(c => ({ ...c })));
    setTemplateName(
      presetKey === "clinical" ? "Clinical Role Template" : "Instructional Role Template"
    );
  }

  async function handleSave() {
    if (!jobId) return;
    
    if (criteria.length === 0) {
      setError("Please add at least one criterion.");
      return;
    }
    if (criteria.some(c => !c.name.trim())) {
      setError("All criteria must have a name.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await saveScorecardTemplate(jobId, templateName, criteria);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const inputClass = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-primary/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border bg-white shadow-lg flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between bg-primary px-5 py-4 shrink-0 rounded-t-xl">
          <div className="flex items-center gap-2 text-white">
            <Settings className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Scorecard Builder</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="text-white hover:text-white/70"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col gap-6">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Loading template...</div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-primary">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className={inputClass}
                  placeholder="e.g., Standard Developer Scorecard"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-primary">Evaluation Criteria</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyPreset("clinical")}
                      className="text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md"
                    >
                      Clinical Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPreset("instructional")}
                      className="text-xs text-primary hover:underline bg-primary/5 px-2 py-1 rounded-md"
                    >
                      Instructional Preset
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  {criteria.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4 text-center border-2 border-dashed border-slate-200 rounded-md">
                      No criteria added yet.
                    </div>
                  ) : (
                    criteria.map((c, index) => (
                      <div key={c.id} className="flex items-center gap-2 bg-white p-2 rounded-md border border-slate-200 shadow-sm">
                        <GripVertical className="h-4 w-4 text-slate-400 cursor-move shrink-0" />
                        <span className="text-xs font-medium text-slate-400 w-4 text-center shrink-0">{index + 1}</span>
                        <input
                          type="text"
                          value={c.name}
                          onChange={(e) => updateCriterion(c.id, e.target.value)}
                          className="flex-1 rounded-md border-none bg-transparent px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Criterion Name"
                        />
                        <button
                          type="button"
                          onClick={() => removeCriterion(c.id)}
                          className="p-1.5 text-slate-400 hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  onClick={addCriterion}
                  className="flex items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white py-2 text-sm font-medium text-slate-600 hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Criterion
                </button>
              </div>

              {error && <p className="text-sm text-danger">{error}</p>}
            </>
          )}
        </div>

        <div className="shrink-0 flex gap-2 border-t bg-white p-4 rounded-b-xl">
          <button
            type="button"
            className="flex-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : (
              <>
                <Check className="h-4 w-4" /> Save Scorecard
              </>
            )}
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
