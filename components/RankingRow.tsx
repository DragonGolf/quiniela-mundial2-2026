import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { RankingEntry } from '@/lib/types';

interface Props {
  entry: RankingEntry;
  rank: number;
  isMe: boolean;
}

export default function RankingRow({ entry, rank, isMe }: Props) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <View style={styles.rankCell}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rankText}>{rank}</Text>
        )}
      </View>
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {entry.name}
        {isMe && ' (tú)'}
      </Text>
      <View style={styles.stats}>
        <Text style={styles.statSmall}>{entry.exact_scores}✓✓</Text>
        <Text style={styles.statSmall}>{entry.correct_results}✓</Text>
        <Text style={[styles.points, isMe && styles.pointsMe]}>{entry.total_points} pts</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 1,
    borderRadius: 8,
  },
  rowMe: {
    backgroundColor: '#e8f0fe',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  rankCell: { width: 36, alignItems: 'center' },
  medal: { fontSize: 20 },
  rankText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  name: { flex: 1, fontSize: 15, color: Colors.text, marginLeft: 8 },
  nameMe: { fontWeight: '700', color: Colors.primary },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statSmall: { fontSize: 11, color: Colors.textSecondary },
  points: { fontSize: 16, fontWeight: '700', color: Colors.text, minWidth: 60, textAlign: 'right' },
  pointsMe: { color: Colors.primary },
});
