import { updateCandidateStage } from './src/app/actions/candidates';

async function test() {
  try {
    // We need a candidate ID to test. Let's fetch one first.
    const { createClient } = require('@supabase/supabase-js');
    const dotenv = require('dotenv');
    dotenv.config({ path: '.env.local' });
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { data } = await supabase.from('candidates').select('id').limit(1);
    if (!data || data.length === 0) {
      console.log('No candidates found');
      return;
    }
    const candidateId = data[0].id;
    console.log('Testing with candidate ID:', candidateId);
    
    await updateCandidateStage(candidateId, 'rejected', 'Did not meet requirements');
    console.log('Success');
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
