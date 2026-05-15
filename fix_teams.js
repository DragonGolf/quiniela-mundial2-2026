// node fix_teams.js — normalizes team names directly in the database

const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';

const FIXES = [
  ['México',              'Mexico',               '🇲🇽'],
  ['Brasil',              'Brazil',               '🇧🇷'],
  ['España',              'Spain',                '🇪🇸'],
  ['Francia',             'France',               '🇫🇷'],
  ['Alemania',            'Germany',              '🇩🇪'],
  ['Estados Unidos',      'United States',        '🇺🇸'],
  ['Canadá',              'Canada',               '🇨🇦'],
  ['Marruecos',           'Morocco',              '🇲🇦'],
  ['Bosnia-Herzegovina',  'Bosnia and Herzegovina','🇧🇦'],
  ['Congo DR',            'DR Congo',             '🇨🇩'],
  ['Czechia',             'Czech Republic',       '🇨🇿'],
  ['Curaçao',             'Curacao',              '🇨🇼'],
  ['Korea Republic',      'South Korea',          '🇰🇷'],
  ['IR Iran',             'Iran',                 '🇮🇷'],
  ['Cape Verde Islands',  'Cape Verde',           '🇨🇻'],
];

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function patch(filter, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/matches?${filter}`, {
    method: 'PATCH', headers, body: JSON.stringify(body),
  });
  return res.status;
}

async function main() {
  let fixed = 0;
  for (const [old, canonical, flag] of FIXES) {
    const enc = encodeURIComponent(old);
    const [s1, s2] = await Promise.all([
      patch(`home_team=eq.${enc}`, { home_team: canonical, home_flag: flag }),
      patch(`away_team=eq.${enc}`, { away_team: canonical, away_flag: flag }),
    ]);
    if (s1 < 300 && s2 < 300) { console.log(`✅ ${old} → ${canonical}`); fixed++; }
    else console.log(`⚠️  ${old} → status ${s1}/${s2}`);
  }
  console.log(`\n✅ ${fixed} nombres normalizados`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
