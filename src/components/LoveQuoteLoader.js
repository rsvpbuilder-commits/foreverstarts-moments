import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme, spacing, radius } from '../theme/colors';

const QUOTES = [
  {
    text: 'Every love story is beautiful, but ours is my favorite.'
  },
  {
    text: 'Together is a beautiful place to be.'
  },
  {
    text: 'You are my today and all of my tomorrows.',
    author: 'Leo Christopher'
  },
  {
    text: 'In you, I’ve found the love of my life and my closest friend.'
  },
  {
    text: 'Two hearts in love need no words.'
  },
  {
    text: 'The best thing to hold onto in life is each other.',
    author: 'Audrey Hepburn'
  },
  {
    text: 'Love recognizes no barriers.'
  }
];

const getRandomIndex = (max, exclude) => {
  if (max <= 1) return 0;
  let next = Math.floor(Math.random() * max);
  while (next === exclude) {
    next = Math.floor(Math.random() * max);
  }
  return next;
};

export function LoveQuoteLoader({ visible }) {
  const [quoteIndex, setQuoteIndex] = useState(() =>
    Math.floor(Math.random() * QUOTES.length)
  );

  useEffect(() => {
    if (!visible) return undefined;
    const interval = setInterval(() => {
      setQuoteIndex((prev) => getRandomIndex(QUOTES.length, prev));
    }, 4000);
    return () => clearInterval(interval);
  }, [visible]);

  const quote = useMemo(() => QUOTES[quoteIndex] ?? QUOTES[0], [quoteIndex]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.backdrop} pointerEvents="auto">
      <View style={styles.loaderCard}>
        <Text style={styles.loadingLabel}>Weaving your love stories...</Text>
        <Text style={styles.quote}>{`“${quote.text}”`}</Text>
        {quote.author ? (
          <Text style={styles.author}>— {quote.author}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 24, 40, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  loaderCard: {
    width: '80%',
    maxWidth: 340,
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border
  },
  loadingLabel: {
    color: theme.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center'
  },
  quote: {
    color: theme.textPrimary,
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 26,
    letterSpacing: 0.5,
    textAlign: 'center'
  },
  author: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase'
  }
});
