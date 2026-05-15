// Run this script from terminal: node sync.js
// Syncs all World Cup 2026 matches from football-data.org to Supabase

const SUPABASE_URL = 'https://nagbhtoajhmitbvtkxqb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hZ2JodG9hamhtaXRidnRreHFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODUzNjQzMywiZXhwIjoyMDk0MTEyNDMzfQ.2iquaxJmp9ChTu_txRkrsqmFVJHx5ljw07-T0MYijTU';
const FOOTBALL_API_KEY = '54eb8cc245c64e2d9d08108cce090806';
const WC_2026_ID = 2000;

const FLAG_MAP = {
  // CONCACAF
  'Mexico': '🇲🇽', 'México': '🇲🇽',
  'United States': '🇺🇸', 'USA': '🇺🇸', 'Estados Unidos': '🇺🇸',
  'Canada': '🇨🇦', 'Canadá': '🇨🇦',
  'Panama': '🇵🇦', 'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳',
  'Jamaica': '🇯🇲', 'El Salvador': '🇸🇻', 'Trinidad and Tobago': '🇹🇹',
  'Haiti': '🇭🇹', 'Curaçao': '🇨🇼', 'Curacao': '🇨🇼',
  // CONMEBOL
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Brasil': '🇧🇷',
  'Uruguay': '🇺🇾', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨',
  'Venezuela': '🇻🇪', 'Chile': '🇨🇱', 'Paraguay': '🇵🇾',
  'Peru': '🇵🇪', 'Bolivia': '🇧🇴',
  // UEFA
  'France': '🇫🇷', 'Francia': '🇫🇷',
  'Germany': '🇩🇪', 'Alemania': '🇩🇪',
  'Spain': '🇪🇸', 'España': '🇪🇸',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹', 'Netherlands': '🇳🇱',
  'Belgium': '🇧🇪', 'Croatia': '🇭🇷', 'Serbia': '🇷🇸',
  'Austria': '🇦🇹', 'Switzerland': '🇨🇭', 'Turkey': '🇹🇷',
  'Denmark': '🇩🇰', 'Hungary': '🇭🇺', 'Slovakia': '🇸🇰',
  'Albania': '🇦🇱', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Czech Republic': '🇨🇿', 'Czechia': '🇨🇿',
  'Poland': '🇵🇱', 'Romania': '🇷🇴', 'Ukraine': '🇺🇦', 'Greece': '🇬🇷',
  'Slovenia': '🇸🇮', 'Iceland': '🇮🇸', 'Norway': '🇳🇴', 'Sweden': '🇸🇪',
  'Finland': '🇫🇮', 'Bosnia and Herzegovina': '🇧🇦', 'Bosnia-Herzegovina': '🇧🇦',
  'Montenegro': '🇲🇪', 'North Macedonia': '🇲🇰', 'Bulgaria': '🇧🇬',
  'Georgia': '🇬🇪',
  // CAF
  'Morocco': '🇲🇦', 'Marruecos': '🇲🇦',
  'Senegal': '🇸🇳', 'Cameroon': '🇨🇲',
  "Côte d'Ivoire": '🇨🇮', 'Ivory Coast': '🇨🇮',
  'Egypt': '🇪🇬', 'South Africa': '🇿🇦', 'Nigeria': '🇳🇬',
  'Ghana': '🇬🇭', 'Tunisia': '🇹🇳', 'Algeria': '🇩🇿', 'Mali': '🇲🇱',
  'DR Congo': '🇨🇩', 'Congo DR': '🇨🇩', 'Guinea': '🇬🇳', 'Zambia': '🇿🇲',
  'Cape Verde Islands': '🇨🇻', 'Cape Verde': '🇨🇻',
  // AFC
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Korea Republic': '🇰🇷',
  'Iran': '🇮🇷', 'IR Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺', 'Qatar': '🇶🇦',
  'Uzbekistan': '🇺🇿', 'Jordan': '🇯🇴', 'Iraq': '🇮🇶',
  'Oman': '🇴🇲', 'UAE': '🇦🇪', 'China PR': '🇨🇳', 'China': '🇨🇳',
  'Bahrain': '🇧🇭', 'Kuwait': '🇰🇼', 'Palestine': '🇵🇸',
  // OFC
  'New Zealand': '🇳🇿',
};

// Normalize variant/Spanish names to canonical English
const NAME_NORMALIZE = {
  'México': 'Mexico', 'Brasil': 'Brazil', 'España': 'Spain',
  'Francia': 'France', 'Alemania': 'Germany', 'Estados Unidos': 'United States',
  'Canadá': 'Canada', 'Marruecos': 'Morocco',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Congo DR': 'DR Congo', 'Czechia': 'Czech Republic',
  'Curaçao': 'Curacao', 'Korea Republic': 'South Korea', 'IR Iran': 'Iran',
  'USA': 'United States', 'Cape Verde Islands': 'Cape Verde',
};

function normalizeName(name) { return NAME_NORMALIZE[name] || name; }
function getFlag(name) { return FLAG_MAP[normalizeName(name)] || FLAG_MAP[name] || '🏳️'; }

function mapStatus(s) {
  if (['FINISHED', 'AWARDED'].includes(s)) return 'finished';
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(s)) return 'live';
  return 'upcoming';
}

function mapStage(s) {
  const map = {
    'GROUP_STAGE': 'group', 'LAST_32': 'round_of_32', 'LAST_16': 'round_of_16',
    'QUARTER_FINALS': 'quarterfinal', 'SEMI_FINALS': 'semifinal',
    'THIRD_PLACE': 'third_place', 'FINAL': 'final',
  };
  return map[s] || 'group';
}

async function supabaseRequest(path, method, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${method} ${path} failed: ${res.status} ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log('🔄 Descargando partidos de football-data.org...');

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${WC_2026_ID}/matches`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  const apiMatches = json.matches || [];
  console.log(`✅ ${apiMatches.length} partidos obtenidos de la API`);

  // Get existing matches from Supabase
  const existing = await supabaseRequest('/matches?select=id,api_match_id&api_match_id=not.is.null', 'GET');
  const existingMap = new Map((existing || []).map(m => [m.api_match_id, m.id]));
  console.log(`📋 ${existingMap.size} partidos ya existen en la base de datos`);

  const toInsert = [];
  const toUpdate = [];

  for (const m of apiMatches) {
    // Skip matches where teams are not yet determined
    if (!m.homeTeam.name || !m.awayTeam.name) continue;

    const homeName = normalizeName(m.homeTeam.name);
    const awayName = normalizeName(m.awayTeam.name);
    const record = {
      home_team: homeName,
      away_team: awayName,
      home_flag: getFlag(homeName),
      away_flag: getFlag(awayName),
      match_date: m.utcDate,
      stage: mapStage(m.stage),
      group_name: m.group ? m.group.replace('GROUP_', '') : null,
      venue: m.venue || null,
      status: mapStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      api_match_id: String(m.id),
    };

    const existingId = existingMap.get(String(m.id));
    if (existingId) {
      toUpdate.push({ id: existingId, record });
    } else {
      toInsert.push(record);
    }
  }

  // Bulk insert new matches
  if (toInsert.length > 0) {
    console.log(`➕ Insertando ${toInsert.length} partidos nuevos...`);
    await supabaseRequest('/matches', 'POST', toInsert);
  }

  // Update existing matches
  let updated = 0;
  for (const { id, record } of toUpdate) {
    await supabaseRequest(`/matches?id=eq.${id}`, 'PATCH', record);
    updated++;
    if (updated % 10 === 0) process.stdout.write(`  Actualizado ${updated}/${toUpdate.length}...\r`);
  }

  console.log(`\n✅ ¡Listo! ${toInsert.length} partidos nuevos, ${toUpdate.length} actualizados`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
