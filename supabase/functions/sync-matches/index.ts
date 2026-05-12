import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FOOTBALL_API_KEY = Deno.env.get('FOOTBALL_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WC_2026_ID = 2000;

const FLAG_MAP: Record<string, string> = {
  'Mexico': '🇲🇽', 'United States': '🇺🇸', 'Canada': '🇨🇦',
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Uruguay': '🇺🇾',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Venezuela': '🇻🇪', 'Chile': '🇨🇱',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Austria': '🇦🇹',
  'Switzerland': '🇨🇭', 'Turkey': '🇹🇷', 'Denmark': '🇩🇰',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Cameroon': '🇨🇲',
  'Ivory Coast': '🇨🇮', 'Egypt': '🇪🇬', 'Nigeria': '🇳🇬', 'Ghana': '🇬🇭',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺', 'Qatar': '🇶🇦',
  'New Zealand': '🇳🇿', 'Hungary': '🇭🇺', 'Slovakia': '🇸🇰',
};

function getFlag(name: string): string {
  return FLAG_MAP[name] ?? '🏳️';
}

function mapStatus(apiStatus: string): string {
  if (['FINISHED', 'AWARDED'].includes(apiStatus)) return 'finished';
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(apiStatus)) return 'live';
  return 'upcoming';
}

function mapStage(apiStage: string): string {
  const map: Record<string, string> = {
    'GROUP_STAGE': 'group',
    'LAST_32': 'round_of_32',
    'LAST_16': 'round_of_16',
    'QUARTER_FINALS': 'quarterfinal',
    'SEMI_FINALS': 'semifinal',
    'THIRD_PLACE': 'third_place',
    'FINAL': 'final',
  };
  return map[apiStage] ?? 'group';
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${WC_2026_ID}/matches`,
    { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'API fetch failed', status: res.status }), { status: 500 });
  }

  const json = await res.json();
  const apiMatches = json.matches ?? [];
  let updated = 0;
  let inserted = 0;

  for (const m of apiMatches) {
    const record = {
      home_team: m.homeTeam.name,
      away_team: m.awayTeam.name,
      home_flag: getFlag(m.homeTeam.name),
      away_flag: getFlag(m.awayTeam.name),
      match_date: m.utcDate,
      stage: mapStage(m.stage),
      group_name: m.group?.replace('GROUP_', '') ?? null,
      venue: m.venue ?? null,
      status: mapStatus(m.status),
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      api_match_id: String(m.id),
    };

    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .eq('api_match_id', record.api_match_id)
      .single();

    if (existing) {
      await supabase.from('matches').update(record).eq('id', existing.id);
      updated++;
    } else {
      await supabase.from('matches').insert(record);
      inserted++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, inserted, updated, total: apiMatches.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
