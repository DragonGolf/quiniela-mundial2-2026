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

export interface RankingEntry {
  user_id: string;
  name: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  predictions_count: number;
}

export interface MatchWithPrediction extends Match {
  my_prediction?: Prediction;
  all_predictions?: (Prediction & { profile: { name: string } })[];
}
