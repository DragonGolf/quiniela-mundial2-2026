import React from 'react';
import { Platform, Image, Text } from 'react-native';

function emojiToCountryCode(flag: string): string | null {
  if (!flag || flag === '🏳️') return null;
  if (flag.includes('󠁧󠁢󠁥󠁮󠁧')) return 'gb-eng'; // England
  if (flag.includes('󠁧󠁢󠁳󠁣󠁴')) return 'gb-sct'; // Scotland
  if (flag.includes('󠁧󠁢󠁷󠁬󠁳')) return 'gb-wls'; // Wales
  try {
    const chars = [...flag];
    const codes = chars
      .map(c => (c.codePointAt(0) ?? 0) - 0x1F1E6)
      .filter(n => n >= 0 && n < 26);
    if (codes.length !== 2) return null;
    return String.fromCharCode(codes[0] + 65, codes[1] + 65).toLowerCase();
  } catch {
    return null;
  }
}

interface Props {
  flag: string;
  size?: number;
}

export default function FlagImage({ flag, size = 28 }: Props) {
  if (Platform.OS !== 'web') {
    return <Text style={{ fontSize: size }}>{flag}</Text>;
  }

  const code = emojiToCountryCode(flag);
  if (!code) return <Text style={{ fontSize: size }}>🏳️</Text>;

  return (
    <Image
      source={{ uri: `https://flagcdn.com/w40/${code}.png` }}
      style={{ width: size * 1.5, height: size, borderRadius: 2 }}
      resizeMode="contain"
    />
  );
}
