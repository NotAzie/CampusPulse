declare module 'vader-sentiment' {
  export interface VaderScores {
    neg: number;
    neu: number;
    pos: number;
    compound: number;
  }

  export const SentimentIntensityAnalyzer: {
    polarity_scores(input: string): VaderScores;
  };
}

interface Window {
  /** Optional same-origin TextBlob bridge for deployments that bundle it locally. */
  campusPulseTextBlob?: {
    polarity(input: string): number;
  };
}
