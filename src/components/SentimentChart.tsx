import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DistributionItem } from '../lib/feedback/stats';

interface SentimentChartProps {
  data: DistributionItem[];
  total: number;
}

export function SentimentChart({ data, total }: SentimentChartProps) {
  const visible = data.filter((item) => item.value > 0);
  return (
    <div className="distribution-visual">
      <div className="donut-wrap" role="img" aria-label={`Sentiment distribution across ${total} comments`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={visible} dataKey="value" nameKey="name" innerRadius={62} outerRadius={82} paddingAngle={3} stroke="none" isAnimationActive={false}>
              {visible.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ border: '1px solid #e4eae6', borderRadius: 12, boxShadow: '0 12px 30px rgba(18, 46, 35, .12)', fontSize: 12 }}
              formatter={(value, name) => [`${value} comments`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center" aria-hidden="true">
          <strong>{total.toLocaleString()}</strong>
          <span>responses</span>
        </div>
      </div>
      <div className="chart-legend" aria-label="Sentiment breakdown">
        {data.map((item) => (
          <div className="legend-row" key={item.name}>
            <span className="legend-dot" style={{ backgroundColor: item.color }} aria-hidden="true" />
            <span className="legend-name">{item.emoji} {item.name}</span>
            <span className="legend-value">{item.value.toLocaleString()}</span>
            <span className="legend-percent">{item.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface FrequencyBarsProps {
  title: string;
  subtitle: string;
  items: Array<{ term: string; count: number }>;
  tone: 'positive' | 'negative';
}

export function FrequencyBars({ title, subtitle, items, tone }: FrequencyBarsProps) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className={`frequency-panel frequency-panel--${tone}`}>
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="eyebrow">SIGNAL WORDS</p>
          <h3>{title}</h3>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
        <span className="frequency-mark" aria-hidden="true">{tone === 'positive' ? '↗' : '↘'}</span>
      </div>
      {items.length ? (
        <div className="frequency-list">
          {items.map((item) => (
            <div className="frequency-row" key={item.term}>
              <div className="frequency-label"><span>{item.term}</span><strong>{item.count}</strong></div>
              <div className="frequency-track" aria-label={`${item.term}: ${item.count} occurrences`}>
                <span style={{ width: `${Math.max(8, item.count / max * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mini-empty">Add a few more comments to reveal recurring words.</p>
      )}
    </section>
  );
}
