// Deletes the 6 duplicate match records (IDs 1-6) from the first sync
const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';

async function main() {
  // First verify what we're about to delete
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=in.(1,2,3,4,5,6)&select=id,home_team,away_team,group_name`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  const toDelete = await checkRes.json();
  console.log('Records to delete:');
  toDelete.forEach(m => console.log(`  id=${m.id}: ${m.home_team} vs ${m.away_team} (Group ${m.group_name})`));

  // Delete them
  const delRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=in.(1,2,3,4,5,6)`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=representation',
    },
  });

  if (!delRes.ok) {
    const text = await delRes.text();
    console.error('Delete failed:', delRes.status, text);
    return;
  }

  console.log(`\nDeleted ${toDelete.length} duplicate records.`);

  // Verify group counts
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/matches?stage=eq.group&select=group_name&order=group_name`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  const remaining = await verifyRes.json();
  const counts = {};
  remaining.forEach(m => { counts[m.group_name] = (counts[m.group_name] || 0) + 1; });
  console.log('\nGroup match counts after fix:');
  Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)).forEach(([g, c]) => {
    console.log(`  Group ${g}: ${c} matches ${c === 6 ? '✓' : '⚠️ WRONG'}`);
  });
}

main().catch(console.error);
