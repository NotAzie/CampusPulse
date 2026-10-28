import { ArrowUpRight, Compass, Lightbulb, ThumbsUp, TriangleAlert } from 'lucide-react';
import type { AutomaticInsights, EntityInsight } from '../../lib/feedback/insights';

export function EntityPanel({ entities }: { entities: EntityInsight[] }) {
  const max = Math.max(1, ...entities.map((entity) => entity.mentions));
  return (
    <section className="card entity-card" id="campus-signals" aria-labelledby="entity-title">
      <div className="panel-heading">
        <div><p className="eyebrow">WHAT KEEPS COMING UP</p><h2 id="entity-title">Campus signals</h2></div>
        <span className="heading-icon"><Compass size={18} /></span>
      </div>
      {entities.length ? <div className="entity-list">
        {entities.slice(0, 6).map((entity) => (
          <div className="entity-row" key={entity.name}>
            <div className="entity-line"><span>{entity.name}</span><strong>{entity.mentions}<small> mentions</small></strong></div>
            <div className="entity-track" aria-label={`${entity.name}: ${entity.positive} positive, ${entity.negative} negative, ${entity.neutral} neutral`}>
              {entity.positive > 0 && <span className="entity-segment entity-segment--positive" style={{ width: `${entity.positive / max * 100}%` }} />}
              {entity.neutral > 0 && <span className="entity-segment entity-segment--neutral" style={{ width: `${entity.neutral / max * 100}%` }} />}
              {entity.negative > 0 && <span className="entity-segment entity-segment--negative" style={{ width: `${entity.negative / max * 100}%` }} />}
            </div>
            <div className="entity-legend"><span className="positive-text">{entity.positive} positive</span><span className="negative-text">{entity.negative} critical</span></div>
          </div>
        ))}
      </div> : <div className="subtle-empty"><span>◌</span><p>Campus topics will surface as students mention them.</p></div>}
      <div className="entity-footnote"><span className="legend-dot" style={{ backgroundColor: '#15845f' }} /> positive <span className="legend-dot" style={{ backgroundColor: '#87938e' }} /> neutral <span className="legend-dot" style={{ backgroundColor: '#d2695d' }} /> negative</div>
    </section>
  );
}

export function InsightSummary({ insights }: { insights: AutomaticInsights }) {
  return (
    <section className="card insight-summary-card" id="insights" aria-labelledby="insights-title">
      <div className="panel-heading">
        <div><p className="eyebrow">A READ ON THE ROOM</p><h2 id="insights-title">What students are saying</h2></div>
        <span className="heading-icon heading-icon--warm"><Lightbulb size={18} /></span>
      </div>
      <div className="insight-quote-grid">
        <article className="insight-quote insight-quote--positive"><span className="quote-icon"><ThumbsUp size={16} /></span><div><span className="eyebrow">WHAT'S WORKING</span><p>{insights.mostLiked}</p></div></article>
        <article className="insight-quote insight-quote--negative"><span className="quote-icon"><TriangleAlert size={16} /></span><div><span className="eyebrow">ROOM TO IMPROVE</span><p>{insights.mostDisliked}</p></div></article>
      </div>
      <div className="action-priority"><span className="priority-icon"><ArrowUpRight size={17} /></span><p><strong>Recommended next step</strong><br />{insights.priority}</p></div>
      <div className="strengths-grid">
        <div><h3>Key strengths</h3>{insights.strengths.length ? <ul>{insights.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mini-empty">No clear strength yet.</p>}</div>
        <div><h3>Improvement signals</h3>{insights.improvements.length ? <ul>{insights.improvements.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mini-empty">No recurring concern yet.</p>}</div>
      </div>
    </section>
  );
}
