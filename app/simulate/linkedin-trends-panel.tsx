import type { EngagementSeriesPoint, PerformanceInsight, TopPost } from '@/lib/linkedin-analytics';

type LinkedInTrendsPanelProps = {
  engagementSeries: EngagementSeriesPoint[];
  topPosts: TopPost[];
  insights: PerformanceInsight[];
};

const CHART_WIDTH = 760;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 20, right: 28, bottom: 30, left: 24 };

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return 'n/a';
  }

  return `${value.toFixed(1)}%`;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function createLinePath(
  series: EngagementSeriesPoint[],
  metric: keyof Pick<EngagementSeriesPoint, 'impressions' | 'engagements'>,
  maxValue: number,
) {
  if (series.length === 0 || maxValue <= 0) {
    return '';
  }

  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

  return series
    .map((point, index) => {
      const x = CHART_PADDING.left + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
      const value = point[metric] as number;
      const y = CHART_PADDING.top + (1 - value / maxValue) * plotHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function insightToneClasses(emphasis: PerformanceInsight['emphasis']) {
  if (emphasis === 'positive') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }

  if (emphasis === 'watchout') {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  return 'border-blue-200 bg-blue-50 text-blue-900';
}

export function LinkedInTrendsPanel({ engagementSeries, topPosts, insights }: LinkedInTrendsPanelProps) {
  if (engagementSeries.length === 0 && topPosts.length === 0 && insights.length === 0) {
    return null;
  }

  const totalImpressions = engagementSeries.reduce((sum, point) => sum + point.impressions, 0);
  const totalEngagements = engagementSeries.reduce((sum, point) => sum + point.engagements, 0);
  const averageRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;
  const maxImpressions = Math.max(...engagementSeries.map(point => point.impressions), 0);
  const maxEngagements = Math.max(...engagementSeries.map(point => point.engagements), 0);
  const impressionsPath = createLinePath(engagementSeries, 'impressions', maxImpressions || 1);
  const engagementsPath = createLinePath(engagementSeries, 'engagements', maxEngagements || 1);
  const xAxisLabels = engagementSeries.length > 0
    ? [engagementSeries[0], engagementSeries[Math.floor(engagementSeries.length / 2)], engagementSeries[engagementSeries.length - 1]]
    : [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-slate-400">Phase 1 Trends</div>
          <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">LinkedIn performance snapshot</h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            This dashboard is built from your exported LinkedIn analytics. It tracks daily impressions and engagements, highlights top posts, and turns the pattern into next-post recommendations.
          </p>
        </div>
        <div className="text-sm text-slate-500">
          Tracking {engagementSeries.length || topPosts.length} {engagementSeries.length === 1 || topPosts.length === 1 ? 'record' : 'records'} from your latest export.
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total impressions</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatCompactNumber(totalImpressions)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total engagements</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatCompactNumber(totalEngagements)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average engagement rate</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{formatPercent(averageRate)}</div>
        </div>
      </div>

      {engagementSeries.length > 0 ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-300">Reach curve</div>
              <p className="mt-1 text-sm text-slate-400">Impressions and engagements are overlaid using separate scales so you can compare shape instead of raw magnitude.</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-300">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Impressions peak {formatCompactNumber(maxImpressions)}</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Engagements peak {formatCompactNumber(maxEngagements)}</div>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-[260px] w-full min-w-[680px]">
              {[0.25, 0.5, 0.75, 1].map(step => {
                const y = CHART_PADDING.top + (1 - step) * (CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom);
                return <line key={step} x1={CHART_PADDING.left} y1={y} x2={CHART_WIDTH - CHART_PADDING.right} y2={y} stroke="rgba(148,163,184,0.22)" strokeDasharray="4 6" />;
              })}
              <path d={impressionsPath} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={engagementsPath} fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              {xAxisLabels.map((point, index) => {
                const x = CHART_PADDING.left + (engagementSeries.length === 1 ? (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right) / 2 : (engagementSeries.findIndex(item => item.date === point.date) / (engagementSeries.length - 1)) * (CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right));
                return (
                  <text key={`${point.date}-${index}`} x={x} y={CHART_HEIGHT - 6} textAnchor="middle" fill="rgba(226,232,240,0.9)" fontSize="11">
                    {formatDateLabel(point.date)}
                  </text>
                );
              })}
            </svg>
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900">Top posts</h4>
            <span className="text-xs uppercase tracking-wider text-slate-400">Best recent performers</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {topPosts.length > 0 ? topPosts.map(post => (
              <a
                key={post.url}
                href={post.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 hover:bg-white"
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{post.published_at ? formatDateLabel(post.published_at) : 'LinkedIn post'}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 group-hover:text-[#0A66C2]">Open post</div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400">Impressions</div>
                    <div className="mt-1 font-semibold text-slate-900">{post.impressions !== null ? formatCompactNumber(post.impressions) : 'n/a'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400">Engagements</div>
                    <div className="mt-1 font-semibold text-slate-900">{post.engagements !== null ? formatCompactNumber(post.engagements) : 'n/a'}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wider text-slate-400">Rate</div>
                    <div className="mt-1 font-semibold text-slate-900">{formatPercent(post.engagement_rate)}</div>
                  </div>
                </div>
              </a>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Your current export did not include enough top-post rows to build this section yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-bold text-slate-900">Posting recommendations</h4>
            <span className="text-xs uppercase tracking-wider text-slate-400">Derived from your own history</span>
          </div>
          <div className="mt-4 space-y-4">
            {insights.length > 0 ? insights.map(insight => (
              <div key={insight.title} className={`rounded-2xl border p-4 ${insightToneClasses(insight.emphasis)}`}>
                <div className="text-sm font-semibold">{insight.title}</div>
                <p className="mt-2 text-sm leading-relaxed">{insight.detail}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Import a LinkedIn export with engagement history to generate posting recommendations.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}