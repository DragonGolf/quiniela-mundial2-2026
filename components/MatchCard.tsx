import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, StatusLabels, StageLabels } from '@/constants/Colors';
import { MatchWithPrediction } from '@/lib/types';
import FlagImage from './FlagImage';

interface Props {
  match: MatchWithPrediction;
  onPress: () => void;
  onViewPredictions?: () => void;
  notInLeague?: boolean; // partido anterior al arranque de la liga (no cuenta)
}

function getCardBg(match: MatchWithPrediction): string {
  const hasPred = !!match.my_prediction;
  const pts = match.my_prediction?.points;
  if (match.status === 'finished' && hasPred) {
    return (pts ?? 0) > 0 ? '#e8f5e9' : '#ffebee'; // strong green or red
  }
  if (hasPred) return '#f1f8e9'; // soft green — prediction filled
  if (match.status === 'upcoming') return '#fce4ec'; // pink — not filled
  return '#ffffff';
}

function isWithin1Hour(match: MatchWithPrediction): boolean {
  if (match.status !== 'upcoming') return false;
  const minsUntil = (new Date(match.match_date).getTime() - Date.now()) / 60000;
  return minsUntil < 15;
}

export default function MatchCard({ match, onPress, onViewPredictions, notInLeague }: Props) {
  const isUpcoming = match.status === 'upcoming';
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const hasPrediction = !!match.my_prediction;
  const isLocked = isWithin1Hour(match);

  function getPoints() {
    if (!hasPrediction || isUpcoming) return null;
    return match.my_prediction!.points;
  }

  const points = getPoints();

  return (
    <TouchableOpacity
      style={[styles.card, isLive && styles.cardLive, { backgroundColor: getCardBg(match) }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Status badge */}
      <View style={styles.header}>
        <Text style={styles.stage}>
          {match.group_name ? `Grupo ${match.group_name}` : StageLabels[match.stage]}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onViewPredictions && (
            <TouchableOpacity
              onPress={onViewPredictions}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.viewBtn}
            >
              <Text style={styles.viewBtnText}>👁 Ver</Text>
            </TouchableOpacity>
          )}
          <View style={[styles.badge, isLive && styles.badgeLive, isFinished && styles.badgeFinished]}>
            <Text style={[styles.badgeText, isLive && styles.badgeTextLive]}>
              {isLive ? '● ' : ''}{StatusLabels[match.status]}
            </Text>
          </View>
        </View>
      </View>

      {/* Teams and score */}
      <View style={styles.teamsRow}>
        <View style={styles.team}>
          <FlagImage flag={match.home_flag} size={28} />
          <Text style={styles.teamName} numberOfLines={2}>{match.home_team}</Text>
        </View>

        <View style={styles.scoreBlock}>
          {isUpcoming ? (
            <Text style={styles.vs}>VS</Text>
          ) : (
            <Text style={styles.score}>
              {match.home_score ?? '-'} - {match.away_score ?? '-'}
            </Text>
          )}
          <Text style={styles.time}>
            {isUpcoming
              ? new Date(match.match_date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
              : ''}
          </Text>
        </View>

        <View style={[styles.team, styles.teamRight]}>
          <FlagImage flag={match.away_flag} size={28} />
          <Text style={styles.teamName} numberOfLines={2}>{match.away_team}</Text>
        </View>
      </View>

      {/* Venue */}
      {match.venue ? (
        <Text style={styles.venue} numberOfLines={1}>📍 {match.venue}</Text>
      ) : null}

      {/* Prediction row */}
      <View style={styles.predictionRow}>
        {notInLeague ? (
          <Text style={styles.notInLeague}>🏁 No cuenta para tu liga (anterior al arranque)</Text>
        ) : hasPrediction ? (
          <>
            <Text style={styles.predLabel}>
              Mi predicción: {match.my_prediction!.pred_home} - {match.my_prediction!.pred_away}
            </Text>
            {points !== null && (
              <View style={[styles.pointsBadge,
                points >= 7 && styles.pointsExact,
                points >= 3 && points < 7 && styles.pointsCorrect,
                points > 0 && points < 3 && styles.pointsPartial,
                points === 0 && styles.pointsWrong,
              ]}>
                <Text style={styles.pointsText}>
                  {points >= 7 ? '🎯 ' : points >= 3 ? '✓ ' : ''}{points} pt{points === 1 ? '' : 's'}
                </Text>
              </View>
            )}
          </>
        ) : isUpcoming && !isLocked ? (
          <Text style={styles.noPrediction}>Toca para poner tu predicción →</Text>
        ) : isUpcoming && isLocked ? (
          <Text style={styles.lockedLabel}>🔒 Cerrado (menos de 15 min) · Sin predicción</Text>
        ) : (
          <Text style={[styles.noPrediction, { color: Colors.accent }]}>Sin predicción</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLive: { borderLeftWidth: 3, borderLeftColor: Colors.live },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  stage: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
    backgroundColor: '#eef0f8',
  },
  badgeLive: { backgroundColor: '#ffe5e5' },
  badgeFinished: { backgroundColor: '#f0f0f0' },
  badgeText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  viewBtn: {
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  viewBtnText: { fontSize: 11, fontWeight: '700', color: Colors.white },
  badgeTextLive: { color: Colors.live },
  teamsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  venue: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center', marginBottom: 8 },
  team: { flex: 1, alignItems: 'center', gap: 4 },
  teamRight: { alignItems: 'center' },
  flag: { fontSize: 28 },
  teamName: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  scoreBlock: { flex: 1, alignItems: 'center' },
  vs: { fontSize: 18, fontWeight: '700', color: Colors.textSecondary },
  score: { fontSize: 24, fontWeight: '800', color: Colors.text },
  time: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  predictionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  predLabel: { fontSize: 13, color: Colors.textSecondary },
  noPrediction: { fontSize: 13, color: Colors.primary, fontStyle: 'italic' },
  lockedLabel: { fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' },
  notInLeague: { fontSize: 12, color: '#0d47a1', fontStyle: 'italic', fontWeight: '600' },
  pointsBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pointsExact: { backgroundColor: '#e8f8ee' },
  pointsCorrect: { backgroundColor: '#fef9e7' },
  pointsPartial: { backgroundColor: '#fff3cd' },
  pointsWrong: { backgroundColor: '#f5f5f5' },
  pointsText: { fontSize: 12, fontWeight: '700', color: Colors.text },
});
