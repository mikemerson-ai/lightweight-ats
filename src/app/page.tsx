import { getJobs } from "@/app/actions/jobs";
import { DashboardClient } from "@/components/DashboardClient";

export default async function Home() {
  const jobs = await getJobs();
  
  return <DashboardClient initialJobs={jobs} />;
}
