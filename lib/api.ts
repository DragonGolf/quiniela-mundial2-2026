import { supabase } from './supabase';
import { Match, MatchWithPrediction, Prediction, RankingEntry } from './types';

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
  const { data, error } = await supabase
    .from('predictions')
    .upsert(
      { user_id: userId, match_id: matchId, pred_home: predHome, pred_away: predAway },
      { onConflict: 'user_id,match_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('standings')
    .select('*')
    .order('total_points', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function triggerMatchSync() {
  const { error } = await supabase.functions.invoke('sync-matches');
  if (error) throw error;
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
