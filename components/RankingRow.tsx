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
      <View style={styles.nameCol}>
        <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
          {entry.name}{isMe ? ' (tú)' : ''}
        </Text>
        <Text style={styles.breakdown}>
          {entry.match_points}p
          {(entry.group_points ?? 0) > 0 ? ` +${entry.group_points}g` : ''}
          {(entry.podium_points ?? 0) > 0 ? ` +${entry.podium_points}pod` : ''}
          {(entry.scorer_points ?? 0) > 0 ? ` +${entry.scorer_points}gol` : ''}
        </Text>
      </View>
      <Text style={[styles.points, isMe && styles.pointsMe]}>{entry.total_points} pts</Text>
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
  nameCol: { flex: 1, marginLeft: 8 },
  name: { fontSize: 15, color: Colors.text },
  nameMe: { fontWeight: '700', color: Colors.primary },
  breakdown: { fontSize: 10, color: Colors.textSecondary, marginTop: 1 },
  points: { fontSize: 16, fontWeight: '700', color: Colors.text, minWidth: 54, textAlign: 'right' },
  pointsMe: { color: Colors.primary },
});
