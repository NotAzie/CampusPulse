import { analyzeComments, analyzeFeedback, type AnalysisOutput } from '../lib/sentiment/analyze';

interface WorkerResult { output?: AnalysisOutput; error?: string }
interface WorkerRequest { text?: string; comments?: string[] }
interface WorkerContext {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResult): void;
}

const context = self as unknown as WorkerContext;
context.onmessage = async (event) => {
  try {
    const output = event.data.comments
      ? await analyzeComments(event.data.comments)
      : await analyzeFeedback(event.data.text ?? '');
    context.postMessage({ output });
  } catch (error) {
    context.postMessage({ error: error instanceof Error ? error.message : 'Unable to analyze this feedback.' });
  }
};

export {};
