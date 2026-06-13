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
  'Cape Verde Islands': 'Cape Verde', 'Türkiye': 'Turkey',
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
      .select('id, api_match_id, status, home_score, away_score')
      .not('api_match_id', 'is', null);

    const existingMap = new Map((existing ?? []).map((m: any) => [m.api_match_id, m]));
    const STATUS_RANK: Record<string, number> = { upcoming: 0, live: 1, finished: 2 };

    const toInsert: any[] = [];
    const toUpdate: { id: number; record: any }[] = [];

    for (const m of apiMatches) {
      if (!m.homeTeam?.name || !m.awayTeam?.name) continue;
      const homeName = normalizeName(m.homeTeam.name);
      const awayName = normalizeName(m.awayTeam.name);
      const apiStatus = mapStatus(m.status);
      const apiHome = m.score?.fullTime?.home ?? null;
      const apiAway = m.score?.fullTime?.away ?? null;

      const prev = existingMap.get(String(m.id));
      if (prev) {
        // UPDATE: nunca borrar un marcador existente ni regresar el estado.
        // Así el admin puede capturar en vivo sin que el cron lo borre;
        // la API toma el control cuando trae datos (en vivo o final).
        const record: any = {
          home_team: homeName, away_team: awayName,
          home_flag: getFlag(homeName), away_flag: getFlag(awayName),
          match_date: m.utcDate, stage: mapStage(m.stage),
          group_name: m.group?.replace('GROUP_', '') ?? null,
          api_match_id: String(m.id),
        };
        // Venue: solo si la API lo trae (no borrar el que pusimos desde ESPN)
        if (m.venue) record.venue = m.venue;
        // Marcador: solo si la API trae datos
        if (apiHome !== null && apiAway !== null) {
          record.home_score = apiHome;
          record.away_score = apiAway;
        }
        // Estado: solo avanzar (upcoming → live → finished), nunca retroceder
        if ((STATUS_RANK[apiStatus] ?? 0) > (STATUS_RANK[prev.status] ?? 0)) {
          record.status = apiStatus;
        } else if (apiStatus === prev.status) {
          record.status = apiStatus; // sin cambio, refresca igual
        }
        toUpdate.push({ id: prev.id, record });
      } else {
        toInsert.push({
          home_team: homeName, away_team: awayName,
          home_flag: getFlag(homeName), away_flag: getFlag(awayName),
          match_date: m.utcDate, stage: mapStage(m.stage),
          group_name: m.group?.replace('GROUP_', '') ?? null,
          venue: m.venue ?? null, status: apiStatus,
          home_score: apiHome, away_score: apiAway,
          api_match_id: String(m.id),
        });
      }
    }

    if (toInsert.length > 0) {
      const { error } = await supabase.from('matches').insert(toInsert);
      if (error) throw new Error(`Insert error: ${error.message}`);
    }
    for (const { id, record } of toUpdate) {
      await supabase.from('matches').update(record).eq('id', id);
    }

    // ── FUENTE EN VIVO: ESPN (gratuita, tiempo real) ──────────────
    // football-data (plan gratis) actualiza horas tarde; ESPN trae el
    // marcador minuto a minuto. ESPN solo puede AVANZAR estado/marcador.
    let liveUpdated = 0;
    try {
      const espnRes = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'
      );
      if (espnRes.ok) {
        const espn = await espnRes.json();
        const events: any[] = espn.events ?? [];

        // Mapa de partidos en BD por nombres normalizados
        const { data: dbMatches } = await supabase
          .from('matches')
          .select('id, home_team, away_team, status, home_score, away_score, venue');
        const byNames = new Map<string, any>();
        for (const dm of dbMatches ?? []) {
          byNames.set(`${dm.home_team}|${dm.away_team}`, dm);
        }

        const mapEspnStatus = (s: string): string => {
          if (/FULL_TIME|FINAL/.test(s)) return 'finished';
          if (/IN_PROGRESS|HALFTIME|FIRST_HALF|SECOND_HALF|EXTRA|PEN/.test(s)) return 'live';
          return 'upcoming';
        };

        for (const ev of events) {
          const comp = ev.competitions?.[0];
          if (!comp) continue;
          const homeC = (comp.competitors ?? []).find((c: any) => c.homeAway === 'home');
          const awayC = (comp.competitors ?? []).find((c: any) => c.homeAway === 'away');
          if (!homeC?.team?.displayName || !awayC?.team?.displayName) continue;

          const hName = normalizeName(homeC.team.displayName);
          const aName = normalizeName(awayC.team.displayName);
          const dbm = byNames.get(`${hName}|${aName}`);
          if (!dbm) continue;

          const eStatus = mapEspnStatus(ev.status?.type?.name ?? '');
          const eHome = homeC.score != null ? parseInt(homeC.score) : null;
          const eAway = awayC.score != null ? parseInt(awayC.score) : null;

          const rec: any = {};
          // Marcador: solo cuando el partido está en juego o terminado
          if (eStatus !== 'upcoming' && eHome !== null && eAway !== null && !isNaN(eHome) && !isNaN(eAway)) {
            if (eHome !== dbm.home_score || eAway !== dbm.away_score) {
              rec.home_score = eHome;
              rec.away_score = eAway;
            }
          }
          // Estado: solo avanzar, nunca retroceder
          if ((STATUS_RANK[eStatus] ?? 0) > (STATUS_RANK[dbm.status] ?? 0)) {
            rec.status = eStatus;
          }
          // Sede (estadio — ciudad): ESPN sí la trae
          const v = comp.venue;
          if (v?.fullName) {
            const city = v.address?.city ? `${v.address.city}${v.address.country ? ', ' + v.address.country : ''}` : '';
            const venueStr = v.fullName + (city ? ' — ' + city : '');
            if (venueStr !== dbm.venue) rec.venue = venueStr;
          }
          if (Object.keys(rec).length > 0) {
            await supabase.from('matches').update(rec).eq('id', dbm.id);
            liveUpdated++;
          }
        }
      }
    } catch (_espnErr) {
      // ESPN es mejora opcional: si falla, el sync base ya corrió bien
    }

    return new Response(
      JSON.stringify({ inserted: toInsert.length, updated: toUpdate.length, live: liveUpdated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
