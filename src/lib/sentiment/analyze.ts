export type Sentiment = 'Positive' | 'Negative' | 'Neutral';
export type SentimentEngine = 'VADER' | 'VADER + campus cues' | 'TextBlob (local)' | 'Dictionary fallback';

export interface AspectSignal {
  topic: string;
  sentiment: Sentiment;
  score: number;
}

export interface FeedbackEntry {
  id: string;
  originalText: string;
  normalizedText: string;
  sentiment: Sentiment;
  score: number;
  engine: SentimentEngine;
  aspects: AspectSignal[];
}

export interface AnalysisOutput {
  entries: FeedbackEntry[];
  ignoredBlankLines: number;
  uniqueComments: number;
}

type Classification = Pick<FeedbackEntry, 'sentiment' | 'score' | 'engine'>;
type VaderModule = typeof import('vader-sentiment');

export const MAX_COMMENTS = 5000;

const positiveWords = new Map<string, number>([
  ['amazing', 2.7], ['awesome', 2.5], ['best', 2.2], ['brilliant', 2.3], ['clear', 1.0], ['fast', 1.4],
  ['comfortable', 1.6], ['delightful', 2.0], ['easy', 1.0], ['enjoyable', 1.8], ['excellent', 2.6],
  ['excited', 1.8], ['fantastic', 2.7], ['friendly', 1.5], ['good', 1.5], ['great', 2.0],
  ['helpful', 1.7], ['improved', 1.3], ['impressive', 1.8], ['inspiring', 1.8], ['love', 2.2],
  ['loved', 2.2], ['nice', 1.2], ['perfect', 2.5], ['pleasant', 1.4], ['recommend', 1.6],
  ['smooth', 1.2], ['supportive', 1.8], ['useful', 1.5], ['wonderful', 2.4], ['worthwhile', 1.8], ['reliable', 1.5], ['responsive', 1.3],
  ['😊', 1.8], ['😀', 1.8], ['😍', 2.0], ['💚', 1.5], ['👍', 1.8], ['✨', 1.0],
]);

const negativeWords = new Map<string, number>([
  ['annoying', -1.8], ['awful', -2.5], ['bad', -1.7], ['boring', -2.0], ['broken', -2.0],
  ['confusing', -1.7], ['crowded', -1.4], ['difficult', -1.4], ['disappointed', -2.1], ['disappointing', -2.0],
  ['disorganized', -2.0], ['dirty', -1.8], ['expensive', -1.5], ['frustrating', -2.0], ['freezing', -1.8],
  ['hate', -2.4], ['hated', -2.4], ['late', -1.0], ['long', -0.55], ['loud', -1.0], ['missing', -1.2],
  ['noisy', -1.5], ['poor', -1.8], ['problem', -1.2], ['rude', -1.8], ['slow', -1.4], ['stressful', -1.7],
  ['terrible', -2.6], ['uncomfortable', -1.8], ['unhelpful', -1.9], ['useless', -2.0], ['waste', -1.8], ['slowly', -1.3],
  ['worst', -2.6], ['😞', -1.8], ['😢', -1.7], ['😡', -2.0], ['👎', -1.8], ['💔', -1.8],
]);

const negators = new Set(['not', "n't", 'never', 'no', 'hardly', 'without', 'neither', 'nor']);
const intensifiers = new Map([['very', 1.35], ['really', 1.25], ['extremely', 1.6], ['too', 1.25], ['so', 1.2], ['quite', 1.15]]);
const contrastPattern = /\b(but|however|although|yet|though)\b/iu;
const aspectTopics: Array<{ label: string; terms: string[] }> = [
  { label: 'Workshop content', terms: ['workshop', 'lecture', 'course', 'content', 'class', 'teaching', 'session'] },
  { label: 'Campus Wi-Fi', terms: ['wi-fi', 'wifi', 'internet', 'network'] },
  { label: 'Room & facilities', terms: ['room', 'classroom', 'building', 'facility', 'facilities', 'lab', 'laboratory'] },
  { label: 'Food & canteen', terms: ['canteen', 'cafeteria', 'food', 'meal'] },
  { label: 'Queue & service', terms: ['queue', 'wait', 'waiting', 'line'] },
  { label: 'Library', terms: ['library', 'study space'] },
  { label: 'Campus support', terms: ['staff', 'support', 'service', 'advising'] },
];

let vaderModulePromise: Promise<VaderModule> | undefined;
function loadVader(): Promise<VaderModule> {
  vaderModulePromise ??= import('vader-sentiment');
  return vaderModulePromise;
}

export function normalizeForAnalysis(text: string): string {
  return text.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function toLabel(score: number, positiveThreshold = 0.05, negativeThreshold = -0.05): Sentiment {
  if (score >= positiveThreshold) return 'Positive';
  if (score <= negativeThreshold) return 'Negative';
  return 'Neutral';
}

function removeNonSentimentIdentifiers(text: string): string {
  return text.replace(/\bblock\s+[a-z]\b/giu, ' ').replace(/\b\d+\b/gu, ' ');
}

function dictionaryPolarity(text: string): number {
  const tokens = text.toLocaleLowerCase().match(/[\p{L}\p{N}'’]+|[😊😀😍💚👍✨😞😢😡👎💔]/gu) ?? [];
  let total = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    let value = positiveWords.get(token) ?? negativeWords.get(token) ?? 0;
    if (!value) continue;
    const previous = tokens.slice(Math.max(0, index - 3), index);
    if (previous.some((word) => negators.has(word))) value *= -0.8;
    const intensifier = previous.map((word) => intensifiers.get(word) ?? 1).reduce((max, item) => Math.max(max, item), 1);
    total += value * intensifier;
  }
  if (text.includes('!')) total *= 1.08;
  return Math.max(-1, Math.min(1, total / (Math.abs(total) + 2.2)));
}

function applyEmojiCues(text: string, score: number): number {
  if (Math.abs(score) >= 0.05) return score;
  const positive = text.match(/[😊😀😍💚👍✨]/gu)?.length ?? 0;
  const negative = text.match(/[😞😢😡👎💔]/gu)?.length ?? 0;
  if (positive > negative) return Math.min(0.65, 0.22 + (positive - negative) * 0.1);
  if (negative > positive) return Math.max(-0.65, -0.22 - (negative - positive) * 0.1);
  return score;
}

async function classifyNormalized(text: string): Promise<Classification> {
  const cleanText = removeNonSentimentIdentifiers(text);
  try {
    const { SentimentIntensityAnalyzer } = await loadVader();
    const rawScore = SentimentIntensityAnalyzer.polarity_scores(cleanText).compound;
    const score = applyEmojiCues(text, rawScore);
    if (Number.isFinite(score)) {
      if (Math.abs(score) < 0.05) {
        const campusCueScore = dictionaryPolarity(cleanText);
        if (Math.abs(campusCueScore) >= 0.08) {
          return { sentiment: toLabel(campusCueScore, 0.08, -0.08), score: campusCueScore, engine: 'VADER + campus cues' };
        }
      }
      return { sentiment: toLabel(score), score, engine: 'VADER' };
    }
  } catch {
    // A missing chunk or incompatible VADER runtime falls through to the next local option.
  }

  try {
    const bridge = (globalThis as typeof globalThis & { campusPulseTextBlob?: { polarity(input: string): number } }).campusPulseTextBlob;
    const score = bridge?.polarity(cleanText);
    if (typeof score === 'number' && Number.isFinite(score)) {
      return { sentiment: toLabel(score, 0.1, -0.1), score: Math.max(-1, Math.min(1, score)), engine: 'TextBlob (local)' };
    }
  } catch {
    // Optional local bridge failed; continue to the deterministic built-in scorer.
  }

  const score = dictionaryPolarity(cleanText);
  return { sentiment: toLabel(score, 0.08, -0.08), score, engine: 'Dictionary fallback' };
}

function topicFor(text: string, fallback: string): string {
  const lowered = text.toLocaleLowerCase();
  return aspectTopics.find((topic) => topic.terms.some((term) => lowered.includes(term)))?.label ?? fallback;
}

function classificationFor(text: string, cache: Map<string, Promise<Classification>>): Promise<Classification> {
  const key = text.toLocaleLowerCase();
  let result = cache.get(key);
  if (!result) {
    result = classifyNormalized(text);
    cache.set(key, result);
  }
  return result;
}

async function extractAspects(text: string, cache: Map<string, Promise<Classification>>): Promise<AspectSignal[]> {
  const match = text.match(contrastPattern);
  if (!match || match.index === undefined) return [];
  const left = text.slice(0, match.index).trim();
  const right = text.slice(match.index + match[0].length).trim();
  if (!left || !right) return [];
  const [first, second] = await Promise.all([classificationFor(left, cache), classificationFor(right, cache)]);
  if (first.sentiment === second.sentiment || first.sentiment === 'Neutral' || second.sentiment === 'Neutral') return [];
  return [
    { topic: topicFor(left, 'First point'), sentiment: first.sentiment, score: first.score },
    { topic: topicFor(right, 'Second point'), sentiment: second.sentiment, score: second.score },
  ];
}

export async function analyzeComments(comments: string[]): Promise<AnalysisOutput> {
  const parsed = comments.map((comment) => {
    const originalText = String(comment).trim();
    return { originalText, normalizedText: normalizeForAnalysis(originalText) };
  }).filter((comment) => comment.normalizedText.length > 0);
  const ignoredBlankLines = comments.length - parsed.length;
  if (parsed.length > MAX_COMMENTS) throw new RangeError(`Please analyze ${MAX_COMMENTS.toLocaleString()} comments or fewer at a time.`);

  const cache = new Map<string, Promise<Classification>>();
  const uniqueKeys = new Set(parsed.map(({ normalizedText }) => normalizedText.toLocaleLowerCase()));
  const entries = await Promise.all(parsed.map(async ({ originalText, normalizedText }, index): Promise<FeedbackEntry> => {
    const result = await classificationFor(normalizedText, cache);
    return {
      id: `comment-${index + 1}`,
      originalText,
      normalizedText,
      ...result,
      aspects: await extractAspects(normalizedText, cache),
    };
  }));
  return { entries, ignoredBlankLines, uniqueComments: uniqueKeys.size };
}

export function analyzeFeedback(input: string): Promise<AnalysisOutput> {
  return analyzeComments(input.split(/\r?\n/u));
}
