export type MatchStatus = 'upcoming' | 'live' | 'finished';

export type Stage =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'third_place'
  | 'final';

export interface Profile {
  id: string;
  name: string;
  is_admin: boolean;
  is_paid: boolean;
  created_at: string;
}

export interface Match {
  id: number;
  home_team: string;
  away_team: string;
  home_flag: string;
  away_flag: string;
  match_date: string;
  stage: Stage;
  group_name?: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  api_match_id?: string;
  venue?: string;
}

export interface Prediction {
  id: number;
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
  points: number;
  created_at: string;
  updated_at: string;
}

export interface PredictionWithMatch extends Prediction {
  match: Match;
}

export interface PodiumPrediction {
  user_id: string;
  champion: string;
  runner_up: string;
  third_place: string;
  top_scorer?: string;
  created_at: string;
  updated_at: string;
}

export interface TournamentResult {
  id: number;
  champion: string | null;
  runner_up: string | null;
  third_place: string | null;
  top_scorer: string | null;
  updated_at: string;
}

export interface GroupPrediction {
  user_id: string;
  group_name: string;
  first_place: string;
  second_place: string;
  created_at: string;
  updated_at: string;
}

export interface GroupResult {
  group_name: string;
  first_place: string | null;
  second_place: string | null;
  updated_at: string;
}

export interface RankingEntry {
  user_id: string;
  name: string;
  is_paid: boolean;
  match_points: number;
  podium_points: number;
  group_points: number;
  scorer_points: number;
  total_points: number;
  predictions_count: number;
}

export interface League {
  id: string;
  name: string;
  code: string;
  description: string | null;
  entry_price: number;
  prize_description: string | null;
  pts_correct_result: number;
  pts_exact_score: number;
  pts_one_team_goals: number;
  pts_goal_diff: number;
  pts_group_advance: number;
  pts_champion: number;
  pts_runner_up: number;
  pts_third_place: number;
  pts_top_scorer: number;
  organizer_commission: number;
  created_by: string;
  created_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  alias: string;
  is_paid: boolean;
  is_admin: boolean;
  joined_at: string;
  profile?: { name: string };
}

export interface LeagueRankingEntry {
  league_id: string;
  league_member_id: string;
  user_id: string;
  name: string;        // alias
  is_paid: boolean;
  is_admin: boolean;
  match_points: number;
  podium_points: number;
  group_points: number;
  scorer_points: number;
  total_points: number;
  predictions_count: number;
}

export interface LeaguePrediction {
  id: string;
  league_id: string;
  league_member_id: string;
  user_id: string;
  match_id: number;
  pred_home: number;
  pred_away: number;
  points: number;
  created_at: string;
  updated_at: string;
}

// Entry = one quiniela (a user can have multiple per league)
export type LeagueEntry = League & {
  member_id: string;
  alias: string;
  is_admin: boolean;
  is_paid: boolean;
};

export interface MatchWithPrediction extends Match {
  my_prediction?: Prediction;
  all_predictions?: (Prediction & { profile: { name: string } })[];
}
