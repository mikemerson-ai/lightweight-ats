const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function run() {
  // get a candidate
  const res = await fetch(`${url}/rest/v1/candidates?select=id&limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  const id = data[0].id;
  
  // Try to update it
  console.log('Updating candidate', id);
  const updateRes = await fetch(`${url}/rest/v1/candidates?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify({ pipeline_stage: 'rejected' })
  });
  
  console.log('Update Status:', updateRes.status);
  const updateData = await updateRes.json();
  console.log('Update Response:', updateData);
}

run();
