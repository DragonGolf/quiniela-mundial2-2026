import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FOOTBALL_API_KEY = '54eb8cc245c64e2d9d08108cce090806';
const WC_2026_ID = 2000;

const NAME_NORMALIZE: Record<string, string> = {
  'México': 'Mexico', 'Brasil': 'Brazil', 'España': 'Spain', 'Francia': 'France',
  'Alemania': 'Germany', 'Estados Unidos': 'United States', 'Canadá': 'Canada',
  'Marruecos': 'Morocco', 'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'Congo DR': 'DR Congo', 'Czechia': 'Czech Republic', 'Curaçao': 'Curacao',
  'Korea Republic': 'South Korea', 'IR Iran': 'Iran', 'USA': 'United States',
  'Cape Verde Islands': 'Cape Verde',
};

const FLAG_MAP: Record<string, string> = {
  'Mexico': '🇲🇽', 'United States': '🇺🇸', 'Canada': '🇨🇦', 'Panama': '🇵🇦',
  'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳', 'Jamaica': '🇯🇲', 'El Salvador': '🇸🇻',
  'Haiti': '🇭🇹', 'Curacao': '🇨🇼', 'Trinidad and Tobago': '🇹🇹',
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Uruguay': '🇺🇾', 'Colombia': '🇨🇴',
  'Ecuador': '🇪🇨', 'Venezuela': '🇻🇪', 'Chile': '🇨🇱', 'Paraguay': '🇵🇾',
  'Peru': '🇵🇪', 'Bolivia': '🇧🇴',
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Croatia': '🇭🇷',
  'Serbia': '🇷🇸', 'Austria': '🇦🇹', 'Switzerland': '🇨🇭', 'Turkey': '🇹🇷',
  'Denmark': '🇩🇰', 'Hungary': '🇭🇺', 'Slovakia': '🇸🇰', 'Albania': '🇦🇱',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Czech Republic': '🇨🇿',
  'Poland': '🇵🇱', 'Romania': '🇷🇴', 'Ukraine': '🇺🇦', 'Greece': '🇬🇷',
  'Slovenia': '🇸🇮', 'Iceland': '🇮🇸', 'Norway': '🇳🇴', 'Sweden': '🇸🇪',
  'Finland': '🇫🇮', 'Bosnia and Herzegovina': '🇧🇦', 'Montenegro': '🇲🇪',
  'North Macedonia': '🇲🇰', 'Bulgaria': '🇧🇬', 'Georgia': '🇬🇪',
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Cameroon': '🇨🇲',
  "Côte d'Ivoire": '🇨🇮', 'Ivory Coast': '🇨🇮', 'Egypt': '🇪🇬',
  'South Africa': '🇿🇦', 'Nigeria': '🇳🇬', 'Ghana': '🇬🇭',
  'Tunisia': '🇹🇳', 'Algeria': '🇩🇿', 'Mali': '🇲🇱',
  'DR Congo': '🇨🇩', 'Guinea': '🇬🇳', 'Zambia': '🇿🇲', 'Cape Verde': '🇨🇻',
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Iran': '🇮🇷', 'Saudi Arabia': '🇸🇦',
  'Australia': '🇦🇺', 'Qatar': '🇶🇦', 'Uzbekistan': '🇺🇿', 'Jordan': '🇯🇴',
  'Iraq': '🇮🇶', 'UAE': '🇦🇪', 'China': '🇨🇳', 'New Zealand': '🇳🇿',
};

function normalizeName(name: string): string {
  return NAME_NORMALIZE[name] || name;
}

function getFlag(name: string): string {
  return FLAG_MAP[name] || '🏳️';
}

function mapStatus(s: string): string {
  if (['FINISHED', 'AWARDED'].includes(s)) return 'finished';
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(s)) return 'live';
  return 'upcoming';
}

function mapStage(s: string): string {
  const map: Record<string, string> = {
    'GROUP_STAGE': 'group', 'LAST_32': 'round_of_32', 'LAST_16': 'round_of_16',
    'QUARTER_FINALS': 'quarterfinal', 'SEMI_FINALS': 'semifinal',
    'THIRD_PLACE': 'third_place', 'FINAL': 'final',
  };
  return map[s] || 'group';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const res = await fetch(
      `https://api.football-data.org/v4/competitions/${WC_2026_ID}/matches`,
      { headers: { 'X-Auth-Token': FOOTBALL_API_KEY } }
    );

    if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

    const json = await res.json();
    const apiMatches: any[] = json.matches ?? [];

    const { data: existing } = await supabase
      .from('matches')
      .select('id, api_match_id')
      .not('api_match_id', 'is', null);

    const existingMap = new Map((existing ?? []).map((m: any) => [m.api_match_id, m.id]));

    const toInsert: any[] = [];
    const toUpdate: { id: number; record: any }[] = [];

    for (const m of apiMatches) {
      if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
      const homeName = normalizeName(m.homeTeam.name);
      const awayName = normalizeName(m.awayTeam.name);
      const record = {
        home_team: homeName, away_team: awayName,
        home_flag: getFlag(homeName), away_flag: getFlag(awayName),
        match_date: m.utcDate, stage: mapStage(m.stage),
        group_name: m.group?.replace('GROUP_', '') ?? null,
        venue: m.venue ?? null, status: mapStatus(m.status),
        home_score: m.score?.fullTime?.home ?? null,
        away_score: m.score?.fullTime?.away ?? null,
        api_match_id: String(m.id),
      };
      const existingId = existingMap.get(String(m.id));
      if (existingId) toUpdate.push({ id: existingId, record });
      else toInsert.push(record);
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('matches').insert(toInsert);
      if (error) throw new Error(`Insert error: ${error.message}`);
    }
    for (const { id, record } of toUpdate) {
      await supabase.from('matches').update(record).eq('id', id);
    }

    return new Response(
      JSON.stringify({ inserted: toInsert.length, updated: toUpdate.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
