import { supabase } from './supabase';
import { Match, MatchWithPrediction, Prediction, PodiumPrediction, TournamentResult, GroupPrediction, GroupResult, RankingEntry, Profile, League, LeagueEntry, LeagueMember, LeagueRankingEntry, LeaguePrediction } from './types';

export async function getMatches(userId: string): Promise<MatchWithPrediction[]> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });

  if (error) throw error;

  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userId);

  const predMap = new Map((predictions || []).map((p: Prediction) => [p.match_id, p]));

  return (matches || []).map((match: Match) => ({
    ...match,
    my_prediction: predMap.get(match.id),
  }));
}

export async function getMatchWithAllPredictions(matchId: number, status: string) {
  const { data: match, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error) throw error;

  if (status !== 'upcoming') {
    const { data: predictions } = await supabase
      .from('predictions')
      .select('*, profile:profiles(name)')
      .eq('match_id', matchId);
    return { ...match, all_predictions: predictions || [] };
  }

  return match;
}

export async function savePrediction(
  userId: string,
  matchId: number,
  predHome: number,
  predAway: number
): Promise<Prediction> {
  // Try INSERT first, then UPDATE if conflict
  const { data: inserted, error: insertError } = await supabase
    .from('predictions')
    .insert({ user_id: userId, match_id: matchId, pred_home: predHome, pred_away: predAway })
    .select()
    .single();

  if (!insertError) return inserted;

  // If duplicate key error (code 23505), update instead
  if (insertError.code === '23505') {
    const { data: updated, error: updateError } = await supabase
      .from('predictions')
      .update({ pred_home: predHome, pred_away: predAway, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('match_id', matchId)
      .select()
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  throw insertError;
}

export async function getRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('standings')
    .select('*')
    .eq('is_paid', true)
    .order('total_points', { ascending: false });

  if (error) throw error;
  return data || [];
}

const FOOTBALL_API_KEY = process.env.EXPO_PUBLIC_FOOTBALL_API_KEY!;
const WC_2026_ID = 2000;

const FLAG_MAP: Record<string, string> = {
  // CONCACAF
  'Mexico': '🇲🇽', 'United States': '🇺🇸', 'Canada': '🇨🇦',
  'Panama': '🇵🇦', 'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳',
  'Jamaica': '🇯🇲', 'El Salvador': '🇸🇻', 'Trinidad and Tobago': '🇹🇹',
  // CONMEBOL
  'Argentina': '🇦🇷', 'Brazil': '🇧🇷', 'Uruguay': '🇺🇾',
  'Colombia': '🇨🇴', 'Ecuador': '🇪🇨', 'Venezuela': '🇻🇪',
  'Chile': '🇨🇱', 'Paraguay': '🇵🇾', 'Peru': '🇵🇪', 'Bolivia': '🇧🇴',
  // UEFA
  'France': '🇫🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'Portugal': '🇵🇹', 'Netherlands': '🇳🇱', 'Belgium': '🇧🇪',
  'Croatia': '🇭🇷', 'Serbia': '🇷🇸', 'Austria': '🇦🇹',
  'Switzerland': '🇨🇭', 'Turkey': '🇹🇷', 'Denmark': '🇩🇰',
  'Hungary': '🇭🇺', 'Slovakia': '🇸🇰', 'Albania': '🇦🇱',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Czech Republic': '🇨🇿',
  'Poland': '🇵🇱', 'Romania': '🇷🇴', 'Ukraine': '🇺🇦', 'Greece': '🇬🇷',
  'Slovenia': '🇸🇮', 'Iceland': '🇮🇸', 'Norway': '🇳🇴', 'Sweden': '🇸🇪',
  'Finland': '🇫🇮', 'Bosnia and Herzegovina': '🇧🇦', 'Montenegro': '🇲🇪',
  'North Macedonia': '🇲🇰', 'Bulgaria': '🇧🇬', 'Georgia': '🇬🇪',
  // CAF
  'Morocco': '🇲🇦', 'Senegal': '🇸🇳', 'Cameroon': '🇨🇲',
  "Côte d'Ivoire": '🇨🇮', 'Ivory Coast': '🇨🇮', 'Egypt': '🇪🇬',
  'South Africa': '🇿🇦', 'Nigeria': '🇳🇬', 'Ghana': '🇬🇭',
  'Tunisia': '🇹🇳', 'Algeria': '🇩🇿', 'Mali': '🇲🇱',
  'DR Congo': '🇨🇩', 'Guinea': '🇬🇳', 'Zambia': '🇿🇲',
  // AFC
  'Japan': '🇯🇵', 'South Korea': '🇰🇷', 'Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦', 'Australia': '🇦🇺', 'Qatar': '🇶🇦',
  'Uzbekistan': '🇺🇿', 'Jordan': '🇯🇴', 'Iraq': '🇮🇶',
  'Oman': '🇴🇲', 'UAE': '🇦🇪', 'China PR': '🇨🇳', 'China': '🇨🇳',
  'Bahrain': '🇧🇭', 'Kuwait': '🇰🇼', 'Palestine': '🇵🇸',
  // OFC
  'New Zealand': '🇳🇿',
};

function getFlag(name: string) { return FLAG_MAP[name] ?? '🏳️'; }

function mapStatus(s: string) {
  if (['FINISHED', 'AWARDED'].includes(s)) return 'finished';
  if (['IN_PLAY', 'PAUSED', 'HALFTIME'].includes(s)) return 'live';
  return 'upcoming';
}

function mapStage(s: string) {
  const map: Record<string, string> = {
    'GROUP_STAGE': 'group', 'LAST_32': 'round_of_32', 'LAST_16': 'round_of_16',
    'QUARTER_FINALS': 'quarterfinal', 'SEMI_FINALS': 'semifinal',
    'THIRD_PLACE': 'third_place', 'FINAL': 'final',
  };
  return map[s] ?? 'group';
}

export async function triggerMatchSync(): Promise<{ inserted: number; updated: number }> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(
    `${supabaseUrl}/functions/v1/sync-matches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sync error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function getPodiumPrediction(userId: string): Promise<PodiumPrediction | null> {
  const { data } = await supabase
    .from('podium_predictions')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function savePodiumPrediction(
  userId: string,
  champion: string,
  runner_up: string,
  third_place: string,
  top_scorer?: string
): Promise<PodiumPrediction> {
  const { data, error } = await supabase
    .from('podium_predictions')
    .upsert({ user_id: userId, champion, runner_up, third_place, top_scorer: top_scorer ?? null, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getTournamentResults(): Promise<TournamentResult | null> {
  const { data } = await supabase
    .from('tournament_results')
    .select('*')
    .eq('id', 1)
    .single();
  return data;
}

export async function saveTournamentResults(
  champion: string | null,
  runner_up: string | null,
  third_place: string | null,
  top_scorer?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('tournament_results')
    .update({ champion, runner_up, third_place, top_scorer: top_scorer ?? null, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
}

export async function getGroupTeams(): Promise<Record<string, { team: string; flag: string }[]>> {
  const { data } = await supabase
    .from('matches')
    .select('group_name, home_team, away_team, home_flag, away_flag')
    .eq('stage', 'group')
    .not('group_name', 'is', null);

  if (!data) return {};
  const groups: Record<string, Map<string, string>> = {};
  for (const m of data) {
    if (!m.group_name) continue;
    if (!groups[m.group_name]) groups[m.group_name] = new Map();
    groups[m.group_name].set(m.home_team, m.home_flag);
    groups[m.group_name].set(m.away_team, m.away_flag);
  }
  return Object.fromEntries(
    Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, Array.from(v.entries()).map(([team, flag]) => ({ team, flag })).sort((a, b) => a.team.localeCompare(b.team))])
  );
}

export async function getGroupPredictions(userId: string): Promise<GroupPrediction[]> {
  const { data } = await supabase
    .from('group_predictions')
    .select('*')
    .eq('user_id', userId);
  return data || [];
}

export async function saveGroupPrediction(
  userId: string,
  groupName: string,
  firstPlace: string,
  secondPlace: string
): Promise<void> {
  const { error } = await supabase
    .from('group_predictions')
    .upsert({ user_id: userId, group_name: groupName, first_place: firstPlace, second_place: secondPlace, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getGroupResults(): Promise<GroupResult[]> {
  const { data } = await supabase.from('group_results').select('*');
  return data || [];
}

export async function saveGroupResult(
  groupName: string,
  firstPlace: string | null,
  secondPlace: string | null
): Promise<void> {
  const { error } = await supabase
    .from('group_results')
    .upsert({ group_name: groupName, first_place: firstPlace, second_place: secondPlace, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function setUserPaid(userId: string, isPaid: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_user_paid', { target_user_id: userId, paid: isPaid });
  if (error) throw error;
}

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error) throw error;
  return data || [];
}

export async function getAllTeams(): Promise<string[]> {
  const { data } = await supabase
    .from('matches')
    .select('home_team, away_team')
    .eq('stage', 'group');
  if (!data) return [];
  const teams = new Set<string>();
  data.forEach((m: { home_team: string; away_team: string }) => {
    teams.add(m.home_team);
    teams.add(m.away_team);
  });
  return Array.from(teams).sort();
}

export async function adminUpdateMatch(
  matchId: number,
  homeScore: number,
  awayScore: number,
  status: 'upcoming' | 'live' | 'finished'
) {
  const { error } = await supabase
    .from('matches')
    .update({ home_score: homeScore, away_score: awayScore, status })
    .eq('id', matchId);

  if (error) throw error;
}

// ============================================================
// LEAGUES API
// ============================================================

export async function createLeague(
  name: string, code: string, description: string,
  entryPrice: number, prizeDescription: string
): Promise<League> {
  const { data, error } = await supabase.rpc('create_league', {
    p_name: name, p_code: code.toUpperCase(),
    p_description: description || null,
    p_entry_price: entryPrice,
    p_prize_description: prizeDescription || null,
  });
  if (error) throw error;
  return data;
}

export async function joinLeague(code: string, alias?: string): Promise<League> {
  const { data, error } = await supabase.rpc('join_league', {
    p_code: code.toUpperCase(),
    p_alias: alias || null,
  });
  if (error) throw error;
  return data;
}

export async function addLeagueEntry(leagueId: string, alias: string): Promise<{ id: string; alias: string }> {
  const { data, error } = await supabase.rpc('add_league_entry', {
    p_league_id: leagueId,
    p_alias: alias,
  });
  if (error) throw error;
  return data;
}

// Returns one row per entry (user can have multiple per league)
export async function getMyLeagues(userId: string): Promise<LeagueEntry[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('id, alias, is_admin, is_paid, league:leagues(*)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((d: any) => ({
    ...d.league,
    member_id: d.id,
    alias: d.alias || d.league?.name || 'Jugador',
    is_admin: d.is_admin,
    is_paid: d.is_paid,
  }));
}

// Get matches with predictions for a specific entry (league_member_id)
export async function getLeagueMatchesForMember(memberId: string): Promise<MatchWithPrediction[]> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });
  if (error) throw error;

  const { data: preds } = await supabase
    .from('league_predictions')
    .select('*')
    .eq('league_member_id', memberId);

  const predMap = new Map((preds || []).map((p: any) => [p.match_id, p]));
  return (matches || []).map((m: Match) => ({ ...m, my_prediction: predMap.get(m.id) }));
}

// Save prediction for a specific entry
export async function saveLeaguePredictionForMember(
  memberId: string,
  matchId: number,
  predHome: number,
  predAway: number
): Promise<LeaguePrediction> {
  const { data: inserted, error: insertErr } = await supabase
    .from('league_predictions')
    .insert({ league_member_id: memberId, match_id: matchId, pred_home: predHome, pred_away: predAway, points: 0 })
    .select()
    .single();
  if (!insertErr) return inserted;

  if (insertErr.code === '23505') {
    const { data: updated, error: updateErr } = await supabase
      .from('league_predictions')
      .update({ pred_home: predHome, pred_away: predAway, updated_at: new Date().toISOString() })
      .eq('league_member_id', memberId)
      .eq('match_id', matchId)
      .select()
      .single();
    if (updateErr) throw updateErr;
    return updated;
  }
  throw insertErr;
}

export async function getLeague(leagueId: string): Promise<League> {
  const { data, error } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
  if (error) throw error;
  return data;
}

export async function updateLeagueRules(leagueId: string, rules: Partial<League>): Promise<void> {
  const { error } = await supabase.from('leagues').update({ ...rules, updated_at: new Date().toISOString() }).eq('id', leagueId);
  if (error) throw error;
}

export async function getLeagueMembers(leagueId: string): Promise<(LeagueMember & { profile: { name: string } })[]> {
  const { data, error } = await supabase
    .from('league_members')
    .select('*, profile:profiles(name)')
    .eq('league_id', leagueId);
  if (error) throw error;
  return data || [];
}

export async function setLeagueMemberPaid(leagueId: string, userId: string, paid: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_league_member_paid', {
    p_league_id: leagueId, p_user_id: userId, p_paid: paid,
  });
  if (error) throw error;
}

export async function setLeagueMemberPaidById(memberId: string, paid: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_member_paid', {
    p_member_id: memberId,
    p_paid: paid,
  });
  if (error) throw error;
}

export async function moveLeagueEntry(memberId: string, newLeagueId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_move_member_to_league', {
    p_member_id: memberId,
    p_new_league_id: newLeagueId,
  });
  if (error) throw error;
}

export async function getAllLeagues(): Promise<{ id: string; name: string; code: string }[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, code')
    .order('name');
  if (error) throw error;
  return data || [];
}

// ── Per-member group predictions ──────────────────────────────────
export async function getMemberGroupPredictions(memberId: string): Promise<GroupPrediction[]> {
  const { data } = await supabase
    .from('member_group_predictions')
    .select('group_name, first_place, second_place, updated_at')
    .eq('league_member_id', memberId);
  // Return in GroupPrediction shape (user_id not needed for display)
  return (data || []).map((d: any) => ({
    user_id: '', group_name: d.group_name,
    first_place: d.first_place, second_place: d.second_place,
    created_at: d.updated_at, updated_at: d.updated_at,
  }));
}

export async function saveMemberGroupPrediction(
  memberId: string, groupName: string, firstPlace: string, secondPlace: string
): Promise<void> {
  const { error } = await supabase
    .from('member_group_predictions')
    .upsert({ league_member_id: memberId, group_name: groupName, first_place: firstPlace, second_place: secondPlace, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── Per-member podium predictions ─────────────────────────────────
export async function getMemberPodiumPrediction(memberId: string): Promise<PodiumPrediction | null> {
  const { data } = await supabase
    .from('member_podium_predictions')
    .select('champion, runner_up, third_place, top_scorer, updated_at')
    .eq('league_member_id', memberId)
    .single();
  if (!data) return null;
  return { user_id: '', champion: data.champion, runner_up: data.runner_up, third_place: data.third_place, top_scorer: data.top_scorer, created_at: data.updated_at, updated_at: data.updated_at };
}

export async function saveMemberPodiumPrediction(
  memberId: string, champion: string, runner_up: string, third_place: string, top_scorer?: string
): Promise<PodiumPrediction> {
  const { data, error } = await supabase
    .from('member_podium_predictions')
    .upsert({ league_member_id: memberId, champion, runner_up, third_place, top_scorer: top_scorer ?? null, updated_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return { user_id: '', champion: data.champion, runner_up: data.runner_up, third_place: data.third_place, top_scorer: data.top_scorer, created_at: data.updated_at, updated_at: data.updated_at };
}

export async function renameLeagueEntry(memberId: string, alias: string): Promise<void> {
  const { error } = await supabase
    .from('league_members')
    .update({ alias: alias.trim() })
    .eq('id', memberId);
  if (error) throw error;
}

export async function deleteLeagueEntry(memberId: string): Promise<void> {
  // Usa RPC SECURITY DEFINER para bypassear RLS (admin puede borrar entradas de otros)
  const { error } = await supabase.rpc('admin_delete_member', { p_member_id: memberId });
  if (error) throw error;
}

export async function setLeagueMemberAdmin(leagueId: string, userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await supabase
    .from('league_members')
    .update({ is_admin: isAdmin })
    .eq('league_id', leagueId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getLeagueRanking(leagueId: string): Promise<LeagueRankingEntry[]> {
  const { data, error } = await supabase
    .from('league_standings')
    .select('*')
    .eq('league_id', leagueId)
    .eq('is_paid', true)
    .order('total_points', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getLeagueMatches(userId: string, leagueId: string): Promise<MatchWithPrediction[]> {
  const { data: matches, error } = await supabase
    .from('matches')
    .select('*')
    .order('match_date', { ascending: true });
  if (error) throw error;

  const { data: predictions } = await supabase
    .from('league_predictions')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

  const predMap = new Map((predictions || []).map((p: LeaguePrediction) => [p.match_id, p]));
  return (matches || []).map((match: Match) => ({ ...match, my_prediction: predMap.get(match.id) as any }));
}

export async function saveLeaguePrediction(
  userId: string, leagueId: string, matchId: number,
  predHome: number, predAway: number
): Promise<void> {
  const { error } = await supabase
    .from('league_predictions')
    .upsert({ user_id: userId, league_id: leagueId, match_id: matchId, pred_home: predHome, pred_away: predAway, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function copyPredictionsToLeague(
  userId: string, fromLeagueId: string, toLeagueId: string
): Promise<number> {
  const { data: source } = await supabase
    .from('league_predictions')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', fromLeagueId);
  if (!source || source.length === 0) return 0;

  const copies = source.map((p: LeaguePrediction) => ({
    user_id: userId, league_id: toLeagueId,
    match_id: p.match_id, pred_home: p.pred_home, pred_away: p.pred_away, points: 0,
  }));

  const { error } = await supabase.from('league_predictions').upsert(copies);
  if (error) throw error;
  return copies.length;
}

export async function getLeaguePodiumPrediction(userId: string, leagueId: string) {
  const { data } = await supabase
    .from('league_podium_predictions')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .single();
  return data;
}

export async function saveLeaguePodiumPrediction(
  userId: string, leagueId: string,
  champion: string, runner_up: string, third_place: string, top_scorer?: string
): Promise<void> {
  const { error } = await supabase
    .from('league_podium_predictions')
    .upsert({ user_id: userId, league_id: leagueId, champion, runner_up, third_place, top_scorer: top_scorer ?? null, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getLeagueGroupPredictions(userId: string, leagueId: string) {
  const { data } = await supabase
    .from('league_group_predictions')
    .select('*')
    .eq('user_id', userId)
    .eq('league_id', leagueId);
  return data || [];
}

export async function saveLeagueGroupPrediction(
  userId: string, leagueId: string,
  groupName: string, firstPlace: string, secondPlace: string
): Promise<void> {
  const { error } = await supabase
    .from('league_group_predictions')
    .upsert({ user_id: userId, league_id: leagueId, group_name: groupName, first_place: firstPlace, second_place: secondPlace, updated_at: new Date().toISOString() });
  if (error) throw error;
}
