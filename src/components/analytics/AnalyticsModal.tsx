"use client";

import { useState, useEffect } from "react";
import { Job } from "@/app/actions/jobs";
import { getAnalyticsData } from "@/app/actions/analytics";
import { AnalyticsData } from "@/types/analytics";
import { X, BarChart3, Users, CheckCircle2, XCircle, TrendingUp, Activity, FileSignature, AlertTriangle, ShieldCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface AnalyticsModalProps {
  open: boolean;
  onClose: () => void;
  jobs: Job[];
  initialJobId?: string | null;
}

export function AnalyticsModal({ open, onClose, jobs, initialJobId }: AnalyticsModalProps) {
  const [filterJobId, setFilterJobId] = useState<string | "all">(
    initialJobId || "all"
  );
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialJobId when it changes and modal opens
  useEffect(() => {
    if (open) {
      setFilterJobId(initialJobId || "all");
    }
  }, [open, initialJobId]);

  useEffect(() => {
    if (!open) return;
    
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const result = await getAnalyticsData(
          filterJobId === "all" ? undefined : filterJobId
        );
        setData(result);
      } catch (err: any) {
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [open, filterJobId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg">
              <BarChart3 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            </div>
            <h2 className="text-xl font-semibold">Analytics Dashboard</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={filterJobId}
              onChange={(e) => setFilterJobId(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
            >
              <option value="all">All Jobs</option>
              {jobs.map(job => (
                <option key={job.id} value={job.id}>{job.title}</option>
              ))}
            </select>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 dark:border-slate-100"></div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800">
              {error}
            </div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard 
                  title="Total Active" 
                  value={data.overview.totalActive} 
                  icon={<Users className="w-5 h-5" />} 
                />
                <MetricCard 
                  title="Total Hired" 
                  value={data.overview.totalHired} 
                  icon={<CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />} 
                />
                <MetricCard 
                  title="Disqualified" 
                  value={data.overview.totalDisqualified} 
                  icon={<XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />} 
                />
                <MetricCard 
                  title="Offer Acceptance" 
                  value={`${data.overview.offerAcceptanceRate}%`} 
                  icon={<TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />} 
                />
                <MetricCard 
                  title="Offers" 
                  value={
                    <div className="flex items-center gap-1 text-xl sm:text-lg lg:text-xl font-bold">
                      <span className="text-green-600 dark:text-green-400">{data.offersPendingVsSigned.signed}</span>
                      <span className="text-slate-300 dark:text-slate-600 font-normal">/</span>
                      <span className="text-amber-500 dark:text-amber-400">{data.offersPendingVsSigned.pending}</span>
                    </div>
                  } 
                  icon={<FileSignature className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />} 
                />
              </div>

              {/* Compliance Expiration Alerts */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" /> Compliance Alerts
                </h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
                  {data.complianceAlerts.length > 0 ? (
                    <div className="overflow-x-auto max-h-64 overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 font-medium">Candidate</th>
                            <th className="px-6 py-3 font-medium">Document</th>
                            <th className="px-6 py-3 font-medium">Expiration Date</th>
                            <th className="px-6 py-3 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {data.complianceAlerts.map((alert, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="px-6 py-4 font-medium whitespace-nowrap">{alert.candidateName}</td>
                              <td className="px-6 py-4">
                                <div>
                                  <p className="font-medium text-slate-900 dark:text-slate-100">{alert.documentName}</p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">{alert.category}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {new Date(alert.dateExpired).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {alert.isOverdue ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                    Overdue ({Math.abs(alert.daysRemaining)} days)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    Expiring in {alert.daysRemaining} days
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 flex flex-col items-center justify-center text-center">
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-3">
                        <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="text-emerald-800 dark:text-emerald-300 font-medium">All compliance credentials up to date</p>
                      <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70 mt-1">No documents expiring within the next 30 days.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Pipeline Funnel */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5" /> Pipeline Conversion
                  </h3>
                  <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-4">
                    {data.funnel.map((stage) => (
                      <div key={stage.stage} className="space-y-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium capitalize">{stage.stage.replace(/_/g, ' ')}</span>
                          <span className="text-slate-500 dark:text-slate-400">{stage.count} ({stage.percentage}%)</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-slate-600 dark:bg-slate-400 rounded-full transition-all duration-500" 
                            style={{ width: `${Math.max(stage.percentage, stage.count > 0 ? 2 : 0)}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disqualification Reasons */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Top Disqualification Reasons</h3>
                  <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 h-full">
                    {data.disqualificationReasons.length > 0 ? (
                      <div className="space-y-3">
                        {data.disqualificationReasons.slice(0, 5).map((reason, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <span className="font-medium truncate mr-4">{reason.reason}</span>
                            <span className="whitespace-nowrap inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                              {reason.count} ({reason.percentage}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400 text-sm italic">No disqualifications recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sourcing Channel Performance */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Sourcing Performance</h3>
                  <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 h-[300px]">
                    {data.sourcingPerformance.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.sourcingPerformance} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                          <XAxis type="number" />
                          <YAxis dataKey="channel" type="category" width={100} tick={{ fontSize: 12, fill: 'currentColor' }} />
                          <Tooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc' }}
                          />
                          <Bar dataKey="totalCandidates" name="Total Candidates" fill="#0EA5E9" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="hiredCount" name="Hired" fill="#10B981" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 italic">
                        No sourcing data available.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recruiter Activity */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recruiter Activity</h3>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-6 py-3 font-medium">Recruiter</th>
                        <th className="px-6 py-3 font-medium">Candidates Managed</th>
                        <th className="px-6 py-3 font-medium">Evaluations</th>
                        <th className="px-6 py-3 font-medium">Docs Verified</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {data.recruiterActivity.length > 0 ? (
                        data.recruiterActivity.map((activity, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-6 py-4 font-medium">{activity.recruiterName}</td>
                            <td className="px-6 py-4">{activity.candidatesManaged}</td>
                            <td className="px-6 py-4">{activity.evaluationsCount}</td>
                            <td className="px-6 py-4">{activity.documentsVerified}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                            No recent recruiter activity found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        {typeof value === 'string' || typeof value === 'number' ? (
          <p className="text-3xl font-bold">{value}</p>
        ) : (
          value
        )}
      </div>
      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 shrink-0">
        {icon}
      </div>
    </div>
  );
}
