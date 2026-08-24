import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function main() {
  const { data, error } = await supabase.from('candidates').select('pipeline_stage');
  if (error) {
    console.error('Error fetching stages:', error);
    return;
  }
  const stages = new Set(data.map(c => c.pipeline_stage));
  console.log('Existing stages in DB:', Array.from(stages));
}

main();
