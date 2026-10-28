import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { FeedbackEntry, Sentiment } from '../../lib/sentiment/analyze';

const PAGE_SIZE = 8;
const sentimentMeta: Record<Sentiment, { emoji: string; className: string }> = {
  Positive: { emoji: '😊', className: 'positive' },
  Negative: { emoji: '😞', className: 'negative' },
  Neutral: { emoji: '😐', className: 'neutral' },
};

export default function CommentsPanel({ entries }: { entries: FeedbackEntry[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Sentiment | 'All'>('All');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => entries.filter((entry) =>
    (filter === 'All' || entry.sentiment === filter)
    && entry.originalText.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim())), [entries, filter, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <section className="card comments-card" id="comments" aria-labelledby="comments-title">
      <div className="panel-heading comments-heading">
        <div>
          <p className="eyebrow">THE VOICE, IN CONTEXT</p>
          <h2 id="comments-title">Comment analysis</h2>
          <p className="panel-subtitle">Every response, individually classified.</p>
        </div>
        <span className="result-count">{filtered.length.toLocaleString()} shown</span>
      </div>
      <div className="result-toolbar">
        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search feedback</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search comments…" />
        </label>
        <label className="filter-select">
          <span className="sr-only">Filter by sentiment</span>
          <select value={filter} onChange={(event) => { setFilter(event.target.value as Sentiment | 'All'); setPage(0); }}>
            <option>All</option><option>Positive</option><option>Negative</option><option>Neutral</option>
          </select>
        </label>
      </div>
      <div className="comment-list">
        {rows.length ? rows.map((entry, index) => {
          const meta = sentimentMeta[entry.sentiment];
          return (
            <article className="comment-row" key={entry.id}>
              <span className="comment-index">{(currentPage * PAGE_SIZE + index + 1).toString().padStart(2, '0')}</span>
              <div className="comment-copy">
                <p>“{entry.originalText}”</p>
                <div className="comment-meta">
                  <span className={`sentiment-chip sentiment-chip--${meta.className}`}><span aria-hidden="true">{meta.emoji}</span> {entry.sentiment}</span>
                  <span className="engine-label">{entry.engine}</span>
                  {entry.aspects.map((aspect) => (
                    <span className={`aspect-chip aspect-chip--${aspect.sentiment.toLocaleLowerCase()}`} key={`${aspect.topic}-${aspect.sentiment}`}>
                      {aspect.topic} · {aspect.sentiment.toLowerCase()}
                    </span>
                  ))}
                </div>
              </div>
              <span className={`signal-score signal-score--${meta.className}`} aria-label={`Sentiment score ${entry.score >= 0 ? 'plus' : 'minus'} ${Math.abs(entry.score).toFixed(2)}`}>
                {entry.score >= 0 ? '+' : ''}{entry.score.toFixed(2)}
              </span>
            </article>
          );
        }) : <div className="list-empty"><Search size={20} /><p>No comments match that search.</p></div>}
      </div>
      <div className="print-only-comments" aria-hidden="true">
        {entries.map((entry, index) => {
          const meta = sentimentMeta[entry.sentiment];
          return <article className="print-comment-row" key={`print-${entry.id}`}>
            <span className="print-comment-index">{(index + 1).toString().padStart(2, '0')}</span>
            <div><p>“{entry.originalText}”</p><span className="print-comment-meta">{meta.emoji} {entry.sentiment} · {entry.engine} · Score {entry.score >= 0 ? '+' : ''}{entry.score.toFixed(2)}{entry.aspects.length ? ` · ${entry.aspects.map((aspect) => `${aspect.topic}: ${aspect.sentiment.toLowerCase()}`).join('; ')}` : ''}</span></div>
          </article>;
        })}
      </div>
      <div className="pagination-row">
        <span>Page {currentPage + 1} of {pageCount}</span>
        <div className="pagination-actions">
          <button className="icon-button small" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button>
          <button className="icon-button small" aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button>
        </div>
      </div>
    </section>
  );
}
