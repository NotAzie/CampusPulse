import type { FeedbackEntry, Sentiment } from '../sentiment/analyze';

export interface SentimentStats {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  positivePercent: number;
  negativePercent: number;
  neutralPercent: number;
}

export interface DistributionItem {
  name: Sentiment;
  value: number;
  percentage: number;
  color: string;
  emoji: string;
}

export function calculateStats(entries: FeedbackEntry[]): SentimentStats {
  const positive = entries.filter((entry) => entry.sentiment === 'Positive').length;
  const negative = entries.filter((entry) => entry.sentiment === 'Negative').length;
  const neutral = entries.length - positive - negative;
  const total = entries.length;
  const percent = (count: number) => total === 0 ? 0 : count / total * 100;
  return {
    total,
    positive,
    negative,
    neutral,
    positivePercent: percent(positive),
    negativePercent: percent(negative),
    neutralPercent: percent(neutral),
  };
}

export function toDistribution(stats: SentimentStats): DistributionItem[] {
  return [
    { name: 'Positive', value: stats.positive, percentage: stats.positivePercent, color: '#15845f', emoji: '😊' },
    { name: 'Neutral', value: stats.neutral, percentage: stats.neutralPercent, color: '#87938e', emoji: '😐' },
    { name: 'Negative', value: stats.negative, percentage: stats.negativePercent, color: '#d2695d', emoji: '😞' },
  ];
}

export function overallVerdict(stats: SentimentStats): { title: string; description: string; sentiment: Sentiment | 'Mixed' | 'Balanced' } | null {
  if (!stats.total) return null;
  const shares = [stats.positivePercent, stats.negativePercent, stats.neutralPercent];
  const spread = Math.max(...shares) - Math.min(...shares);
  if (spread <= 12) return { title: 'Balanced Feedback', description: 'Students are sharing a broad mix of perspectives.', sentiment: 'Balanced' };
  if (stats.positivePercent >= 60) return { title: 'Mostly Positive Feedback', description: 'Students are responding well to what they experienced.', sentiment: 'Positive' };
  if (stats.negativePercent >= 60) return { title: 'Mostly Negative Feedback', description: 'A few clear friction points deserve attention.', sentiment: 'Negative' };
  if (stats.neutralPercent >= 60) return { title: 'Mostly Neutral Feedback', description: 'Most comments are informational or measured in tone.', sentiment: 'Neutral' };
  if (stats.positivePercent >= 20 && stats.negativePercent >= 20) {
    return { title: 'Mixed Opinions', description: 'Students are seeing both strengths and opportunities to improve.', sentiment: 'Mixed' };
  }
  const highest = Math.max(...shares);
  if (highest === stats.positivePercent) return { title: 'Mostly Positive Feedback', description: 'Positive experiences are the strongest signal so far.', sentiment: 'Positive' };
  if (highest === stats.negativePercent) return { title: 'Mostly Negative Feedback', description: 'Improvement opportunities are the strongest signal so far.', sentiment: 'Negative' };
  return { title: 'Mostly Neutral Feedback', description: 'Most comments are informational or measured in tone.', sentiment: 'Neutral' };
}
