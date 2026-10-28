import { describe, expect, it, vi } from 'vitest';
import { analyzeComments, analyzeFeedback } from '../sentiment/analyze';
import { SentimentIntensityAnalyzer } from 'vader-sentiment';
import { calculateStats, overallVerdict } from './stats';
import { detectFeedbackColumns, parseFeedbackCsv } from './csv';
import { campusEntities, topTerms } from './insights';

const classify = async (comment: string) => (await analyzeFeedback(comment)).entries[0]?.sentiment;

describe('CampusPulse sentiment analysis', () => {
  it('classifies the required examples deterministically', async () => {
    expect(await classify('The workshop was amazing and very helpful')).toBe('Positive');
    expect(await classify('The session was too long and boring')).toBe('Negative');
    expect(await classify('The event is on Friday')).toBe('Neutral');
    expect(await classify('The campus Wi-Fi is fast')).toBe('Positive');
  });

  it('ignores blank lines, trims text, and reuses duplicate predictions without dropping rows', async () => {
    const result = await analyzeFeedback('  The library is wonderful  \n\nThe library is wonderful\n  The event is on Friday ');
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0].originalText).toBe('The library is wonderful');
    expect(result.entries[0].id).not.toBe(result.entries[1].id);
    expect(result.entries[0].sentiment).toBe(result.entries[1].sentiment);
    expect(result.uniqueComments).toBe(2);
    expect(result.ignoredBlankLines).toBe(1);
  });

  it('finds opposing aspects in a contrastive comment and attributes them to the campus entity', async () => {
    const result = await analyzeFeedback('The workshop content was amazing but the room was freezing.');
    expect(result.entries[0].aspects.map((aspect) => aspect.sentiment)).toEqual(['Positive', 'Negative']);
    const room = campusEntities(result.entries).find((entity) => entity.name === 'Classrooms');
    expect(room?.negative).toBe(1);

    const queueFeedback = await analyzeFeedback('The canteen food is great, though the queue moves slowly.');
    expect(queueFeedback.entries[0].aspects.map((aspect) => aspect.topic)).toEqual(['Food & canteen', 'Queue & service']);
    expect(campusEntities(queueFeedback.entries).find((entity) => entity.name === 'Canteen & food')?.negative).toBe(1);
  });

  it('counts Unicode emoji signals and treats neutral text safely', async () => {
    expect(await classify('😊😊')).toBe('Positive');
    expect(await classify('Friday, 12:30 — Block A')).toBe('Neutral');
    expect((await analyzeFeedback(' \n  ')).entries).toHaveLength(0);
  });

  it('falls back to the built-in word list when VADER scoring fails', async () => {
    const scorer = vi.spyOn(SentimentIntensityAnalyzer, 'polarity_scores').mockImplementation(() => { throw new Error('VADER unavailable'); });
    try {
      const entry = (await analyzeFeedback('The workshop was amazing and helpful')).entries[0];
      expect(entry.sentiment).toBe('Positive');
      expect(entry.engine).toBe('Dictionary fallback');
    } finally {
      scorer.mockRestore();
    }
  });

  it('uses an installed local TextBlob adapter before the dictionary fallback', async () => {
    const scope = globalThis as typeof globalThis & { campusPulseTextBlob?: { polarity(input: string): number } };
    const previous = scope.campusPulseTextBlob;
    const scorer = vi.spyOn(SentimentIntensityAnalyzer, 'polarity_scores').mockImplementation(() => { throw new Error('VADER unavailable'); });
    scope.campusPulseTextBlob = { polarity: () => -0.6 };
    try {
      const entry = (await analyzeFeedback('The workshop felt complicated')).entries[0];
      expect(entry.sentiment).toBe('Negative');
      expect(entry.engine).toBe('TextBlob (local)');
    } finally {
      scorer.mockRestore();
      if (previous) scope.campusPulseTextBlob = previous;
      else delete scope.campusPulseTextBlob;
    }
  });

  it('handles a larger batch without dropping comments', async () => {
    const result = await analyzeFeedback(Array.from({ length: 400 }, (_, index) => `The event ${index} is on Friday`).join('\n'));
    expect(result.entries).toHaveLength(400);
    expect(result.entries.every((entry) => entry.sentiment === 'Neutral')).toBe(true);
  });

  it('handles long Unicode and mixed-language text without throwing', async () => {
    const longComment = `${'学生 feedback '.repeat(400)}El taller fue helpful 😊`;
    const result = await analyzeFeedback(longComment);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].originalText.length).toBe(longComment.length);
    expect(['Positive', 'Negative', 'Neutral']).toContain(result.entries[0].sentiment);
  });

  it('preserves a CSV row containing a quoted newline as one analyzed comment', async () => {
    const file = new File(['feedback\n"Great workshop,\nvery helpful"'], 'multiline.csv', { type: 'text/csv' });
    const parsed = await parseFeedbackCsv(file);
    expect(parsed.rows).toHaveLength(1);
    const result = await analyzeComments([parsed.rows[0].feedback]);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].originalText).toBe('Great workshop,\nvery helpful');
    expect(result.entries[0].normalizedText).toBe('Great workshop, very helpful');
  });

  it('calculates all percentages from the analyzed total', async () => {
    const entries = (await analyzeFeedback('amazing\nboring\nFriday')).entries;
    const stats = calculateStats(entries);
    expect(stats.total).toBe(3);
    expect(stats.positive + stats.negative + stats.neutral).toBe(stats.total);
    expect(stats.positivePercent).toBeCloseTo(100 / 3);
    expect(stats.negativePercent).toBeCloseTo(100 / 3);
    expect(stats.neutralPercent).toBeCloseTo(100 / 3);
    expect(overallVerdict(stats)?.title).toBe('Balanced Feedback');
  });

  it('detects likely feedback columns and filters common words from term insights', async () => {
    const rows = [
      { event_id: '1001', student_feedback: 'The workshop was really helpful' },
      { event_id: '1002', student_feedback: 'The helpful tutor explained it clearly' },
    ];
    expect(detectFeedbackColumns(['event_id', 'student_feedback'], rows)).toEqual(['student_feedback']);
    const positive = (await analyzeFeedback('The workshop was really helpful\nThe helpful tutor explained it clearly')).entries;
    expect(topTerms(positive, 'Positive').some((item) => item.term === 'the')).toBe(false);
    expect(topTerms(positive, 'Positive').some((item) => item.term === 'helpful')).toBe(true);
  });

  it('parses one-column and standard CSVs and gives a friendly error for an empty file', async () => {
    const singleColumn = await parseFeedbackCsv(new File(['feedback\nGreat workshop\nWi-Fi is slow'], 'one-column.csv', { type: 'text/csv' }));
    expect(singleColumn.headers).toEqual(['feedback']);
    expect(singleColumn.rows).toHaveLength(2);
    expect(singleColumn.candidates).toEqual(['feedback']);

    const file = new File(['submitted_at,student_feedback,department\n2026-10-25,Wi-Fi is fast,Engineering\n2026-10-26,Library is quiet,Science'], 'feedback.csv', { type: 'text/csv' });
    const parsed = await parseFeedbackCsv(file);
    expect(parsed.headers).toEqual(['submitted_at', 'student_feedback', 'department']);
    expect(parsed.candidates).toEqual(['student_feedback']);
    expect(parsed.rows).toHaveLength(2);
    await expect(parseFeedbackCsv(new File([], 'empty.csv', { type: 'text/csv' }))).rejects.toThrow('CSV file is empty');
  });
});
