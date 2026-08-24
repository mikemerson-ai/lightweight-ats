import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.from('candidates').select('id, dnh_flag, dnh_reason, dnh_date, dnh_recruiter').limit(1);
  console.log('Result:', { data, error });
}

main();
