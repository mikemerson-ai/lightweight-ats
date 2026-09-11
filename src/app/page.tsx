import { getJobs } from "@/app/actions/jobs";
import { DashboardClient } from "@/components/DashboardClient";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ jobId?: string }>;
}) {
  const jobs = await getJobs();
  const params = searchParams ? await searchParams : undefined;
  const initialJobId = typeof params?.jobId === "string" ? params.jobId : null;

  return <DashboardClient initialJobs={jobs} initialJobId={initialJobId} />;
}
