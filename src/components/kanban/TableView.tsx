import { Star, Sparkles, FileText } from "lucide-react";
import { type Candidate } from "@/app/actions/candidates";
import { getCandidateOriginDate } from "./CandidateCard";
import {
  PIPELINE_STAGES,
  getCandidateAiScorecard,
  getRecommendationBadgeStyle,
  formatRecommendationText,
  getFitScoreBadgeStyle,
} from "./KanbanBoard";

export interface TableViewProps {
  candidates: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
  onGenerateScorecard: (candidate: Candidate) => void;
}

export function TableView({ candidates, onSelectCandidate, onGenerateScorecard }: TableViewProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden mt-4 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1140px] table-fixed text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-3.5 py-3.5 w-[135px]">Name</th>
              <th className="px-3.5 py-3.5 w-[130px]">Stage</th>
              <th className="px-3.5 py-3.5 w-[260px]">AI Profile Summary</th>
              <th className="px-3.5 py-3.5 w-[190px]">Three Pillars</th>
              <th className="px-3.5 py-3.5 w-[150px]">Screening Recommendation</th>
              <th className="px-3.5 py-3.5 w-[90px]">Overall Fit Score</th>
              <th className="px-3.5 py-3.5 w-[85px]">Date Applied</th>
              <th className="px-3.5 py-3.5 w-[100px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.length > 0 ? (
              candidates.map((candidate) => {
                const stageObj = PIPELINE_STAGES.find((s) => s.key === candidate.pipeline_stage) || PIPELINE_STAGES[0];
                const aiScorecard = getCandidateAiScorecard(candidate);
                return (
                  <tr key={candidate.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-3.5 font-medium text-slate-900">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate" title={`${candidate.first_name} ${candidate.last_name}`}>
                          {candidate.first_name} {candidate.last_name}
                        </span>
                        {candidate.resume_url && (
                          <a
                            href={candidate.resume_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View Resume (PDF)"
                            className="shrink-0 p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {candidate.linkedin_url && (
                          <a
                            href={candidate.linkedin_url.startsWith("http") ? candidate.linkedin_url : `https://${candidate.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View LinkedIn Profile"
                            className="shrink-0 p-0.5 rounded text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 transition-colors"
                          >
                            <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0-.02-3.28 1.64 1.64 0 0 0 .02 3.28m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                            </svg>
                          </a>
                        )}
                        {candidate.dnh_flag && (
                          <span className="shrink-0 rounded-sm bg-red-100 px-1 py-0.5 text-[9px] font-bold text-red-700 uppercase leading-none border border-red-200" title="Do Not Hire">
                            DNH
                          </span>
                        )}
                        {candidate.pending_resume && (
                          <span className="shrink-0 rounded-sm bg-amber-50 px-1 py-0.5 text-[9px] font-medium text-amber-700 uppercase leading-none border border-amber-200" title="Pending Resume">
                            PR
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                        <span className={`h-1.5 w-1.5 rounded-full ${stageObj.accent}`}></span>
                        {stageObj.title}
                      </span>
                    </td>
                    <td className="px-3.5 py-3.5">
                      {candidate.fit_rating != null || candidate.ai_summary ? (
                        <div className="space-y-1.5">
                          {candidate.fit_rating != null && (
                            <div className="flex items-center gap-1.5">
                              <div className="flex items-center">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3.5 w-3.5 ${
                                      i < candidate.fit_rating!
                                        ? "fill-amber-400 text-amber-400"
                                        : "fill-slate-100 text-slate-300"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-semibold text-slate-700">
                                {candidate.fit_rating}/5
                              </span>
                            </div>
                          )}
                          {candidate.ai_summary ? (
                            <p
                              className="text-xs text-slate-600 line-clamp-3 leading-relaxed"
                              title={candidate.ai_summary}
                            >
                              {candidate.ai_summary}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No summary available</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      {candidate.sub_scores ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-sm"
                            title="Functional Experience"
                          >
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Exp:</span>
                            <strong>{candidate.sub_scores.functionalExperience != null ? `${candidate.sub_scores.functionalExperience}/5` : "-"}</strong>
                          </span>
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-sm"
                            title="Required Credentials"
                          >
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Creds:</span>
                            <strong>{candidate.sub_scores.requiredCredentials != null ? `${candidate.sub_scores.requiredCredentials}/5` : "-"}</strong>
                          </span>
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 border border-slate-200 shadow-sm"
                            title="Role-Specific Skills"
                          >
                            <span className="text-[10px] text-slate-400 font-semibold uppercase">Skills:</span>
                            <strong>{candidate.sub_scores.roleSpecificSkills != null ? `${candidate.sub_scores.roleSpecificSkills}/5` : "-"}</strong>
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      {aiScorecard?.recommendation ? (
                        <button
                          type="button"
                          onClick={() => onGenerateScorecard(candidate)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all hover:shadow-sm cursor-pointer ${getRecommendationBadgeStyle(
                            aiScorecard.recommendation
                          )}`}
                          title="Click to view AI evaluation scorecard"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{formatRecommendationText(aiScorecard.recommendation)}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onGenerateScorecard(candidate)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-400 hover:text-primary hover:border-primary transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Generate AI Evaluation"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Run Eval</span>
                        </button>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      {aiScorecard?.fitScore != null ? (
                        <button
                          type="button"
                          onClick={() => onGenerateScorecard(candidate)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-bold shadow-sm transition-all hover:shadow-md cursor-pointer ${getFitScoreBadgeStyle(
                            aiScorecard.fitScore
                          )}`}
                          title="Click to view AI evaluation scorecard"
                        >
                          <span className="text-xs font-bold">{aiScorecard.fitScore}</span>
                          <span className="text-[10px] font-medium opacity-60">/ 100</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onGenerateScorecard(candidate)}
                          className="inline-flex items-center justify-center px-2.5 py-1 rounded-md border border-dashed border-slate-300 text-slate-400 hover:text-primary hover:border-primary transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Generate AI Evaluation"
                        >
                          <span className="text-xs font-bold">-</span>
                        </button>
                      )}
                    </td>
                    <td className="px-3.5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                      {(() => {
                        const originInfo = getCandidateOriginDate(candidate);
                        return originInfo.date ? (
                          <span title={`${originInfo.label}: ${originInfo.date}`}>
                            {originInfo.date}
                          </span>
                        ) : (
                          "-"
                        );
                      })()}
                    </td>
                    <td className="px-3.5 py-3.5 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => onSelectCandidate(candidate)}
                        className="text-primary hover:underline font-medium text-xs sm:text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                  No candidates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
