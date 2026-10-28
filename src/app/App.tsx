import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, ArrowRight, BarChart3, BookOpen, Check,
  CircleHelp, FileSpreadsheet, FileText, Lightbulb, MessageSquareText, Moon, ShieldCheck,
  Sparkles, Sun, Upload, Users, Wifi, X,
} from 'lucide-react';
import BrandMark from '../components/BrandMark';
import CommentsPanel from '../features/analyzer/CommentsPanel';
import { EntityPanel, InsightSummary } from '../features/insights/InsightPanels';
import type { AnalysisOutput } from '../lib/sentiment/analyze';
import { parseFeedbackCsv, csvEscape, type ParsedFeedbackCsv } from '../lib/feedback/csv';
import { buildAutomaticInsights, campusEntities, topTerms } from '../lib/feedback/insights';
import { calculateStats, overallVerdict, toDistribution } from '../lib/feedback/stats';

const SAMPLE_FEEDBACK = [
  'The workshop was amazing and very helpful.',
  'The session was too long and boring.',
  'The event is on Friday.',
  'Campus Wi-Fi was fast in the library today.',
  'The workshop content was amazing but the room was freezing.',
  'The canteen food is great, though the queue moves slowly.',
  'Our tutor was friendly and explained the project clearly.',
  'Parking is difficult after 9 a.m.',
  'The study space in the library is calm and comfortable.',
  'The projector in Block A is broken again.',
].join('\n');

const MAX_COMMENTS = 5000;
const SentimentChart = lazy(() => import('../components/SentimentChart').then((module) => ({ default: module.SentimentChart })));
const FrequencyBars = lazy(() => import('../components/SentimentChart').then((module) => ({ default: module.FrequencyBars })));
const ZERO_STATS = { total: 0, positive: 0, negative: 0, neutral: 0, positivePercent: 0, negativePercent: 0, neutralPercent: 0 };

function formatDate() {
  return new Intl.DateTimeFormat('en', { weekday: 'short', month: 'long', day: 'numeric' }).format(new Date());
}

function saveFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [feedback, setFeedback] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisOutput | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importError, setImportError] = useState('');
  const [csvData, setCsvData] = useState<ParsedFeedbackCsv | null>(null);
  const [selectedColumn, setSelectedColumn] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem('campuspulse-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const analysisRequestRef = useRef(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('campuspulse-theme', theme); } catch { /* Private browsing can disable storage. */ }
  }, [theme]);

  useEffect(() => () => { workerRef.current?.terminate(); }, []);

  const stats = useMemo(() => analysis ? calculateStats(analysis.entries) : ZERO_STATS, [analysis]);
  const distribution = useMemo(() => toDistribution(stats), [stats]);
  const verdict = useMemo(() => overallVerdict(stats), [stats]);
  const entities = useMemo(() => analysis ? campusEntities(analysis.entries) : [], [analysis]);
  const positiveTerms = useMemo(() => analysis ? topTerms(analysis.entries, 'Positive') : [], [analysis]);
  const negativeTerms = useMemo(() => analysis ? topTerms(analysis.entries, 'Negative') : [], [analysis]);
  const autoInsights = useMemo(() => analysis ? buildAutomaticInsights(analysis.entries) : null, [analysis]);
  const nonblankCount = feedback.split(/\r?\n/u).filter((line) => line.trim()).length;
  const columnOptions = csvData ? (csvData.candidates.length ? csvData.candidates : csvData.headers) : [];

  function runAnalysis(text: string, csvComments?: string[]) {
    const requestId = ++analysisRequestRef.current;
    workerRef.current?.terminate();
    workerRef.current = null;
    setErrorMessage('');
    setInputMessage('');
    if (!text.trim() && !csvComments?.some((comment) => comment.trim())) {
      setAnalysis(null);
      setIsAnalyzing(false);
      setErrorMessage('👋 It looks like there is no feedback here yet. Add student comments above, one per line, and we’ll uncover the signal.');
      return;
    }
    setIsAnalyzing(true);

    const settle = (result?: AnalysisOutput, error?: string) => {
      if (requestId !== analysisRequestRef.current) return;
      workerRef.current?.terminate();
      workerRef.current = null;
      setIsAnalyzing(false);
      if (error) {
        setAnalysis(null);
        setErrorMessage(error);
      } else if (!result?.entries.length) {
        setAnalysis(null);
        setErrorMessage('No comments to analyze. Add student feedback first, one comment per line.');
      } else {
        setAnalysis(result);
        const blanks = result.ignoredBlankLines ? ` · ${result.ignoredBlankLines} blank line${result.ignoredBlankLines === 1 ? '' : 's'} skipped` : '';
        setInputMessage(`${result.entries.length.toLocaleString()} comments analyzed${blanks}.`);
      }
    };

    const fallbackOnMainThread = () => {
      void import('../lib/sentiment/analyze')
        .then(({ analyzeFeedback, analyzeComments }) => csvComments ? analyzeComments(csvComments) : analyzeFeedback(text))
        .then((result) => settle(result))
        .catch((error: unknown) => settle(undefined, error instanceof Error ? error.message : 'We couldn’t analyze that input. Please try again.'));
    };

    try {
      const worker = new Worker(new URL('../workers/analyzer.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent<{ output?: AnalysisOutput; error?: string }>) => settle(event.data.output, event.data.error);
      worker.onerror = () => {
        if (requestId !== analysisRequestRef.current) return;
        worker.terminate();
        workerRef.current = null;
        fallbackOnMainThread();
      };
      worker.postMessage(csvComments ? { comments: csvComments } : { text });
    } catch {
      fallbackOnMainThread();
    }
  }

  function loadCsvColumn(data: ParsedFeedbackCsv, column: string) {
    const comments = data.rows.map((row) => String(row[column] ?? '').trim()).filter(Boolean);
    if (!comments.length) {
      setImportError(`No non-empty feedback was found in “${column}”. Choose another column.`);
      return;
    }
    const text = comments.map((comment) => comment.normalize('NFKC').replace(/\s+/gu, ' ').trim()).join('\n');
    setFeedback(text);
    setSelectedColumn(column);
    setImportError('');
    setImportMessage(`${comments.length.toLocaleString()} comments ready from “${column}”.`);
    setCsvData(data);
    runAnalysis(text, comments);
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setImportError('');
    setImportMessage('Reading your CSV locally…');
    try {
      const parsed = await parseFeedbackCsv(file);
      setCsvData(parsed);
      const choices = parsed.candidates.length ? parsed.candidates : parsed.headers;
      if (choices.length === 1) {
        loadCsvColumn(parsed, choices[0]);
      } else {
        setSelectedColumn(choices[0] ?? '');
        setImportMessage(`Found ${choices.length} possible text columns. Choose the field that contains student feedback.`);
      }
    } catch (error) {
      setCsvData(null);
      setImportMessage('');
      setImportError(error instanceof Error ? error.message : 'We couldn’t read this CSV. Please try another file.');
    }
  }

  function loadSample() {
    setFeedback(SAMPLE_FEEDBACK);
    setImportError('');
    setImportMessage('Sample feedback loaded.');
    setCsvData(null);
    runAnalysis(SAMPLE_FEEDBACK);
  }

  function exportCsv() {
    if (!analysis || !autoInsights) return;
    const rows = [
      ['Record type', 'Item or comment', 'Sentiment or metric', 'Value or count', 'Engine or context', 'Details'],
      ...analysis.entries.map((entry) => ['Comment', entry.originalText, entry.sentiment, entry.score.toFixed(3), entry.engine, entry.aspects.map((aspect) => `${aspect.topic}: ${aspect.sentiment}`).join('; ')]),
      ['Summary', 'Verdict', verdict?.title ?? '', '', '', verdict?.description ?? ''],
      ['Metric', 'Total comments', 'Count', stats.total, '', ''],
      ['Metric', 'Positive', 'Count', stats.positive, 'Percentage', `${stats.positivePercent.toFixed(1)}%`],
      ['Metric', 'Negative', 'Count', stats.negative, 'Percentage', `${stats.negativePercent.toFixed(1)}%`],
      ['Metric', 'Neutral', 'Count', stats.neutral, 'Percentage', `${stats.neutralPercent.toFixed(1)}%`],
      ['Readout', 'Most praised', '', '', '', autoInsights.mostLiked],
      ['Readout', 'Room to improve', '', '', '', autoInsights.mostDisliked],
      ['Readout', 'Recommended next step', '', '', '', autoInsights.priority],
      ...entities.map((entity) => ['Campus entity', entity.name, 'Mentions', entity.mentions, 'Positive / negative / neutral', `${entity.positive} / ${entity.negative} / ${entity.neutral}`]),
      ...positiveTerms.map((term) => ['Keyword', term.term, 'Positive mentions', term.count, '', '']),
      ...negativeTerms.map((term) => ['Keyword', term.term, 'Negative mentions', term.count, '', '']),
    ];
    saveFile('campuspulse-feedback.csv', rows.map((row) => row.map(csvEscape).join(',')).join('\r\n'), 'text/csv');
  }

  function exportJson() {
    if (!analysis || !autoInsights) return;
    saveFile('campuspulse-report.json', JSON.stringify({
      generatedAt: new Date().toISOString(),
      verdict,
      statistics: stats,
      insights: { narrative: autoInsights, campusEntities: entities, positiveTerms, negativeTerms },
      comments: analysis.entries,
    }, null, 2), 'application/json');
  }

  function printReport() {
    window.print();
  }

  function handleInputChange(value: string) {
    analysisRequestRef.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsAnalyzing(false);
    setFeedback(value);
    setErrorMessage('');
    setInputMessage(analysis ? 'Feedback changed — analyze again to refresh the insights.' : '');
    if (!value.trim()) {
      setAnalysis(null);
      setInputMessage('');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand"><BrandMark /></div>
        <div className="workspace-switcher"><span className="workspace-avatar">C</span><span><strong>Campus workspace</strong><small>Local insights</small></span></div>
        <p className="sidebar-section-label">WORKSPACE</p>
        <nav className="sidebar-nav">
          <a className="sidebar-link sidebar-link--active" href="#overview"><BarChart3 size={17} /><span>Overview</span><span className="nav-active-dot" /></a>
          <a className="sidebar-link" href="#analysis-input"><MessageSquareText size={17} /><span>Feedback inbox</span></a>
          <a className="sidebar-link" href="#campus-signals"><Wifi size={17} /><span>Campus signals</span></a>
          <a className="sidebar-link" href="#insights"><Lightbulb size={17} /><span>Insights</span></a>
          <a className="sidebar-link" href="#comments"><BookOpen size={17} /><span>All comments</span></a>
        </nav>
        <div className="sidebar-spacer" />
        <div className="privacy-card"><span className="privacy-icon"><ShieldCheck size={17} /></span><div><strong>Private by design</strong><p>Analysis stays on this device.</p></div><span className="privacy-dot" /></div>
        <div className="sidebar-bottom"><div className="user-avatar">C</div><div className="user-meta"><strong>Campus analyst</strong><span>Offline session</span></div><a className="sidebar-help" href="#about" aria-label="About CampusPulse" title="About CampusPulse"><CircleHelp size={17} /></a></div>
      </aside>

      <div className="main-frame">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-divider">/</span><strong>Overview</strong></div>
          <div className="topbar-actions"><span className="local-status"><i /> Local analysis</span><span className="topbar-divider" /><span className="today-label">{formatDate()}</span><button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button></div>
        </header>

        <main id="overview" className="dashboard-main">
          <section className="page-heading">
            <div>
              <div className="section-kicker"><span className="kicker-line" /> INSIGHT WORKSPACE <span className="kicker-separator">·</span> LIVE VIEW</div>
              <h1>Student voice,<br /><span>made actionable.</span></h1>
              <p className="page-intro">A clearer read on what’s working, what isn’t, and where to focus next.</p>
            </div>
            <div className="page-actions">
              <button className="button button--quiet" type="button" onClick={loadSample}><Sparkles size={16} /> Explore sample</button>
              {analysis && <div className="export-group">
                <button className="button button--outline" type="button" onClick={exportCsv}><FileSpreadsheet size={15} /> Export CSV</button>
                <button className="button button--icon-text" type="button" onClick={exportJson} aria-label="Export JSON" title="Export JSON"><ArrowDownToLine size={16} /></button>
                <button className="button button--icon-text" type="button" onClick={printReport} aria-label="Print report" title="Print report"><FileText size={16} /></button>
              </div>}
            </div>
          </section>

          <section className="hero-grid" aria-label="Feedback analysis workspace">
            <div className="card input-card" id="analysis-input">
              <div className="panel-heading input-heading">
                <div className="input-title-wrap"><span className="input-icon"><MessageSquareText size={18} /></span><div><p className="eyebrow">START WITH THE STUDENT VOICE</p><h2>Bring your feedback</h2></div></div>
                <span className="input-limit">{nonblankCount.toLocaleString()} {nonblankCount === 1 ? 'comment' : 'comments'}</span>
              </div>
              <label className="sr-only" htmlFor="feedback-text">Student feedback, one comment per line</label>
              <textarea
                id="feedback-text"
                className="feedback-textarea"
                value={feedback}
                onChange={(event) => handleInputChange(event.target.value)}
                placeholder={'Paste student comments here…\n\nOne comment per line. Blank lines are skipped.'}
                spellCheck="true"
                aria-describedby="input-guidance"
              />
              <div className="textarea-footer"><span id="input-guidance"><span className="tiny-dot" /> One comment per line <span className="footer-divider">·</span> up to {MAX_COMMENTS.toLocaleString()} at a time</span><span>{feedback.length.toLocaleString()} characters</span></div>
              {(errorMessage || inputMessage) && <p className={`inline-message${errorMessage ? ' inline-message--error' : ''}`} role={errorMessage ? 'alert' : 'status'} aria-live="polite">{errorMessage || inputMessage}</p>}
              <div className="input-actions-row">
                <button className="button button--primary" type="button" onClick={() => runAnalysis(feedback)} disabled={isAnalyzing}>
                  {isAnalyzing ? <span className="button-spinner" aria-hidden="true" /> : <Activity size={16} />}
                  {isAnalyzing ? 'Reading the signal…' : 'Analyze feedback'}
                  {!isAnalyzing && <ArrowRight size={15} />}
                </button>
                <div className={`csv-drop${isDragging ? ' csv-drop--active' : ''}`} onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={(event) => { event.preventDefault(); setIsDragging(false); void handleFile(event.dataTransfer.files[0]); }}>
                  <input ref={fileInputRef} className="visually-hidden" type="file" accept=".csv,text/csv" aria-label="Upload a CSV file" onChange={(event) => { void handleFile(event.target.files?.[0]); event.target.value = ''; }} />
                  <button className="upload-button" type="button" onClick={() => fileInputRef.current?.click()}><Upload size={15} /><span>Drop CSV or browse</span></button>
                </div>
              </div>
              {csvData && columnOptions.length > 1 && <div className="column-picker"><label htmlFor="feedback-column">Feedback column</label><select id="feedback-column" value={selectedColumn} onChange={(event) => setSelectedColumn(event.target.value)}>{columnOptions.map((column) => <option key={column} value={column}>{column}</option>)}</select><button type="button" className="button button--outline button--small" onClick={() => loadCsvColumn(csvData, selectedColumn)}>Use column <ArrowRight size={14} /></button><button className="dismiss-import" type="button" onClick={() => { setCsvData(null); setImportMessage(''); }} aria-label="Dismiss CSV column chooser"><X size={15} /></button></div>}
              {(importMessage || importError) && <p className={`csv-message${importError ? ' csv-message--error' : ''}`} role={importError ? 'alert' : 'status'} aria-live="polite">{importMessage || importError}</p>}
            </div>

            <aside className={`card verdict-card${verdict ? ' verdict-card--ready' : ''}`} aria-live="polite">
              <div className="verdict-topline"><span className="eyebrow">THE BIG PICTURE</span><span className={`signal-pill${verdict ? ' signal-pill--ready' : ''}`}><i /> {verdict ? 'JUST UPDATED' : 'READY WHEN YOU ARE'}</span></div>
              {verdict ? <>
                <span className={`verdict-icon verdict-icon--${verdict.sentiment.toLocaleLowerCase()}`}>{verdict.sentiment === 'Positive' ? '↗' : verdict.sentiment === 'Negative' ? '↘' : verdict.sentiment === 'Neutral' ? '—' : '↗↘'}</span>
                <p className="verdict-caption">OVERALL VERDICT</p>
                <h2>{verdict.title}</h2>
                <p className="verdict-description">{verdict.description}</p>
                <div className="verdict-divider" />
                <div className="verdict-foot"><span><Users size={15} /> {stats.total.toLocaleString()} student voices</span><span className="confidence-chip"><Check size={13} /> Data-led</span></div>
              </> : <>
                <div className="ready-visual" aria-hidden="true"><span className="ready-ring ready-ring--outer" /><span className="ready-ring ready-ring--inner" /><span className="ready-center"><Activity size={22} /></span><i className="ready-point ready-point--one" /><i className="ready-point ready-point--two" /><i className="ready-point ready-point--three" /></div>
                <p className="verdict-caption">A BETTER SIGNAL STARTS HERE</p>
                <h2>Your first read<br />is one click away.</h2>
                <p className="verdict-description">Paste comments or upload a CSV. See clear themes without sending student data anywhere.</p>
                <div className="privacy-note"><ShieldCheck size={15} /> Everything stays in your browser.</div>
              </>}
            </aside>
          </section>

          <section className="metrics-grid" aria-label="Sentiment statistics">
            <article className="metric-card metric-card--total"><div className="metric-top"><span className="metric-label">TOTAL COMMENTS</span><span className="metric-icon metric-icon--ink"><MessageSquareText size={16} /></span></div><div className="metric-value">{stats.total.toLocaleString()}</div><div className="metric-foot"><span>{analysis ? `${analysis.uniqueComments.toLocaleString()} unique comments` : 'Waiting for your first analysis'}</span><span className="metric-trail" /></div></article>
            <article className="metric-card metric-card--positive"><div className="metric-top"><span className="metric-label">POSITIVE</span><span className="metric-icon metric-icon--positive">😊</span></div><div className="metric-value">{stats.positive.toLocaleString()}<small>{stats.positivePercent.toFixed(1)}%</small></div><div className="metric-progress"><span style={{ width: `${stats.positivePercent}%` }} /></div></article>
            <article className="metric-card metric-card--negative"><div className="metric-top"><span className="metric-label">NEGATIVE</span><span className="metric-icon metric-icon--negative">😞</span></div><div className="metric-value">{stats.negative.toLocaleString()}<small>{stats.negativePercent.toFixed(1)}%</small></div><div className="metric-progress"><span style={{ width: `${stats.negativePercent}%` }} /></div></article>
            <article className="metric-card metric-card--neutral"><div className="metric-top"><span className="metric-label">NEUTRAL</span><span className="metric-icon metric-icon--neutral">😐</span></div><div className="metric-value">{stats.neutral.toLocaleString()}<small>{stats.neutralPercent.toFixed(1)}%</small></div><div className="metric-progress"><span style={{ width: `${stats.neutralPercent}%` }} /></div></article>
          </section>

          <section className="analytics-grid" aria-label="Feedback insights">
            <article className="card distribution-card">
              <div className="panel-heading"><div><p className="eyebrow">SENTIMENT AT A GLANCE</p><h2>How the room feels</h2></div><span className="heading-icon"><BarChart3 size={18} /></span></div>
      {analysis ? <Suspense fallback={<div className="chart-empty chart-loading" role="status">Preparing your chart…</div>}><SentimentChart data={distribution} total={stats.total} /></Suspense> : <div className="chart-empty"><div className="empty-orbit"><BarChart3 size={21} /></div><p>Sentiment distribution appears here after your first analysis.</p></div>}
              {analysis && <p className="chart-caption"><span className="caption-line" /> Proportions update with every analysis</p>}
            </article>
            <div className="frequency-stack">
              {analysis ? <Suspense fallback={<div className="frequency-loading" role="status">Loading word patterns…</div>}>
                <FrequencyBars title="What’s going well" subtitle="Most common words in positive comments" items={positiveTerms} tone="positive" />
                <FrequencyBars title="Where it’s harder" subtitle="Most common words in negative comments" items={negativeTerms} tone="negative" />
              </Suspense> : <>
                <section className="frequency-panel frequency-empty"><span className="frequency-mark">↗</span><p className="eyebrow">SIGNAL WORDS</p><h3>What’s going well</h3><p className="panel-subtitle">Positive themes will emerge from student comments.</p></section>
                <section className="frequency-panel frequency-empty frequency-empty--negative"><span className="frequency-mark">↘</span><p className="eyebrow">SIGNAL WORDS</p><h3>Where it’s harder</h3><p className="panel-subtitle">Recurring concerns will appear here.</p></section>
              </>}
            </div>
          </section>

          <section className="lower-grid" aria-label="Campus and narrative insights">
            <EntityPanel entities={entities} />
            {autoInsights ? <InsightSummary insights={autoInsights} /> : <section className="card insight-placeholder" id="insights"><div className="placeholder-icon"><Lightbulb size={19} /></div><p className="eyebrow">A READ ON THE ROOM</p><h2>More than a mood score.</h2><p>We’ll turn the words students use into strengths, recurring issues, and practical next steps.</p><div className="placeholder-link">Derived from your feedback <ArrowRight size={14} /></div></section>}
          </section>

          {analysis ? <CommentsPanel entries={analysis.entries} /> : <section className="card comments-empty" id="comments"><div className="comments-empty-icon"><MessageSquareText size={18} /></div><div><p className="eyebrow">THE VOICE, IN CONTEXT</p><h2>Your comments, with meaning.</h2><p>Each line will get its own sentiment label, score, and—when signals differ—aspect-level clues.</p></div><span className="comments-empty-count">0 responses</span></section>}

          <footer className="dashboard-footer" id="about"><span><BrandMark compact /> <span>Built for clearer campus conversations.</span></span><span><ShieldCheck size={14} /> Private, local, and transparent by design</span></footer>
        </main>
      </div>
    </div>
  );
}
