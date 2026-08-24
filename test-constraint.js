const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function run() {
  const res = await fetch(`${url}/rest/v1/candidates?select=id&limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const data = await res.json();
  const id = data[0].id;

  const stagesToTest = ['Rejected', 'disqualified', 'Disqualified', 'Reject'];
  
  for (const stage of stagesToTest) {
    console.log('Testing', stage);
    const updateRes = await fetch(`${url}/rest/v1/candidates?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pipeline_stage: stage })
    });
    if (updateRes.status === 204 || updateRes.status === 200) {
      console.log('SUCCESS! Allowed value:', stage);
      return;
    } else {
      const data = await updateRes.json();
      console.log('Failed:', data.message);
    }
  }
}

run();
