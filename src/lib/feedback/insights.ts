import type { FeedbackEntry, Sentiment } from '../sentiment/analyze';

export interface TermFrequency { term: string; count: number }
export interface EntityInsight { name: string; mentions: number; positive: number; negative: number; neutral: number }

const STOP_WORDS = new Set(`a an the and or but if then than so because as at by for from in into of on onto out over to up with about after before between during through under again further once here there when where why how all any both each few more most other some such no nor not only own same too very can will just should now i me my we our you your he she it they them this that these those am is are was were be been being do does did have has had having would could may might must shall block`.split(' '));

const ENTITIES: Array<{ name: string; terms: string[] }> = [
  { name: 'Campus Wi-Fi', terms: ['wi-fi', 'wifi', 'internet', 'network'] },
  { name: 'Canteen & food', terms: ['canteen', 'cafeteria', 'food', 'meal', 'dining'] },
  { name: 'Library', terms: ['library', 'study space'] },
  { name: 'Parking & transit', terms: ['parking', 'bus', 'shuttle', 'transport'] },
  { name: 'Hostel', terms: ['hostel', 'residence hall', 'dorm'] },
  { name: 'Laboratories', terms: ['laboratory', 'laboratories', 'lab', 'labs'] },
  { name: 'Classrooms', terms: ['classroom', 'classrooms', 'lecture hall', 'room'] },
  { name: 'Teaching & workshops', terms: ['workshop', 'lecture', 'course', 'content', 'class', 'teaching', 'session'] },
  { name: 'Student support', terms: ['staff', 'support', 'advising', 'service'] },
  { name: 'Campus spaces', terms: ['block a', 'block b', 'garden', 'campus'] },
  { name: 'Sports & recreation', terms: ['sports', 'gym', 'recreation', 'field'] },
];

export function topTerms(entries: FeedbackEntry[], sentiment: Sentiment, limit = 6): TermFrequency[] {
  const counts = new Map<string, number>();
  entries.filter((entry) => entry.sentiment === sentiment).forEach((entry) => {
    const terms = entry.normalizedText.toLocaleLowerCase().match(/[\p{L}][\p{L}'’-]{2,}/gu) ?? [];
    terms.forEach((term) => {
      const normalized = term.replace(/[’']/gu, '');
      if (STOP_WORDS.has(normalized) || STOP_WORDS.has(term) || normalized.length < 3) return;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
  });
  return [...counts.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term)).slice(0, limit);
}

function sentimentForEntity(entry: FeedbackEntry, entityName: string, matchedText: string): Sentiment {
  const matched = matchedText.toLocaleLowerCase();
  const queueIssue = entityName === 'Canteen & food' ? entry.aspects.find((item) => item.topic === 'Queue & service') : undefined;
  if (queueIssue) return queueIssue.sentiment;
  const aspect = entry.aspects.find((item) => item.topic === entityName || item.topic.toLocaleLowerCase().includes(matched) || matched.includes(item.topic.toLocaleLowerCase()));
  return aspect?.sentiment ?? entry.sentiment;
}

export function campusEntities(entries: FeedbackEntry[]): EntityInsight[] {
  const result: EntityInsight[] = [];
  ENTITIES.forEach((entity) => {
    const insight: EntityInsight = { name: entity.name, mentions: 0, positive: 0, negative: 0, neutral: 0 };
    entries.forEach((entry) => {
      const match = entity.terms.find((term) => entry.normalizedText.toLocaleLowerCase().includes(term));
      if (!match) return;
      insight.mentions += 1;
      const sentiment = sentimentForEntity(entry, entity.name, match);
      if (sentiment === 'Positive') insight.positive += 1;
      else if (sentiment === 'Negative') insight.negative += 1;
      else insight.neutral += 1;
    });
    if (insight.mentions) result.push(insight);
  });
  return result.sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name));
}

export interface AutomaticInsights {
  mostLiked: string;
  mostDisliked: string;
  priority: string;
  strengths: string[];
  improvements: string[];
}

export function buildAutomaticInsights(entries: FeedbackEntry[]): AutomaticInsights {
  const allEntities = campusEntities(entries);
  const positiveEntities = allEntities.filter((entity) => entity.positive).sort((a, b) => b.positive - a.positive || b.positive / b.mentions - a.positive / a.mentions);
  const negativeEntities = allEntities.filter((entity) => entity.negative).sort((a, b) => b.negative - a.negative || b.negative / b.mentions - a.negative / a.mentions);
  const positiveTerms = topTerms(entries, 'Positive', 4);
  const negativeTerms = topTerms(entries, 'Negative', 4);
  const liked = positiveEntities[0]?.name ?? positiveTerms[0]?.term;
  const disliked = negativeEntities[0]?.name ?? negativeTerms[0]?.term;
  const priority = negativeEntities[0]?.name ?? negativeTerms[0]?.term;
  return {
    mostLiked: liked ? `Students most often praise ${liked}.` : 'No positive themes stand out in this set yet.',
    mostDisliked: disliked ? `The clearest friction point is ${disliked}.` : 'No recurring concern stands out in this set yet.',
    priority: priority ? `A useful next step is to review comments about ${priority}.` : 'Add more feedback to surface a clear improvement priority.',
    strengths: positiveEntities.slice(0, 3).map((item) => `${item.name} · ${item.positive} positive mention${item.positive === 1 ? '' : 's'}`)
      .concat(positiveTerms.slice(0, 2).map((item) => `“${item.term}” · ${item.count} mention${item.count === 1 ? '' : 's'}`)).slice(0, 4),
    improvements: negativeEntities.slice(0, 3).map((item) => `${item.name} · ${item.negative} critical mention${item.negative === 1 ? '' : 's'}`)
      .concat(negativeTerms.slice(0, 2).map((item) => `“${item.term}” · ${item.count} mention${item.count === 1 ? '' : 's'}`)).slice(0, 4),
  };
}
