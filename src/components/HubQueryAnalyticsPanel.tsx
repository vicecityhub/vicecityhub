import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  fetchHubQueryAnalytics,
  generateHubInsightsReport,
  type AnalyticsAlertItem,
  type HubAnalyticsSnapshot,
  type HubInsightsReport,
} from '../lib/aiSupport';

export function HubQueryAnalyticsPanel() {
  const [snapshot, setSnapshot] = useState<HubAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<HubInsightsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<'all' | 'frustrated'>('all');
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [toastAlerts, setToastAlerts] = useState<AnalyticsAlertItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHubQueryAnalytics();
      setSnapshot(data);
      const incoming = (data.alerts ?? []).filter((a) => !seenRef.current.has(a.id));
      if (incoming.length > 0) {
        for (const a of incoming) seenRef.current.add(a.id);
        setToastAlerts((prev) => [...incoming, ...prev].slice(0, 3));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load AI query analytics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  async function handleGenerateInsights() {
    setInsightsLoading(true);
    setError(null);
    try {
      const report = await generateHubInsightsReport();
      setInsights(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights report.');
    } finally {
      setInsightsLoading(false);
    }
  }

  const alerts = snapshot?.alerts ?? [];
  const hasCritical = alerts.some((a) => a.severity === 'critical');
  const hasAlerts = alerts.length > 0;
  const records = (snapshot?.records ?? []).filter((r) => {
    const sentOk = sentimentFilter === 'all' || r.sentiment === 'frustrated';
    const topicOk = !topicFilter || r.topic_cluster === topicFilter;
    return sentOk && topicOk;
  });

  const topTopics = Object.entries(snapshot?.byTopic ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topPains = Object.entries(snapshot?.painPointsCount ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {toastAlerts.length > 0 && (
        <div
          className="fixed top-20 right-5 z-50 w-[340px] max-w-[calc(100vw-2.5rem)] space-y-2"
          role="status"
          aria-live="polite"
        >
          {toastAlerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3.5 shadow-2xl ${
                a.severity === 'critical'
                  ? 'border-rose-500/70 bg-[#1f0d16]/95 text-rose-100'
                  : 'border-amber-500/70 bg-[#1e170b]/95 text-amber-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {a.type === 'negative_spike' ? (
                    <ShieldAlert size={15} className="mt-0.5 shrink-0 text-rose-400" />
                  ) : (
                    <TrendingUp size={15} className="mt-0.5 shrink-0 text-amber-400" />
                  )}
                  <div className="text-xs space-y-1">
                    <div className="font-bold">{a.title}</div>
                    <p className="opacity-90 leading-snug">{a.message}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (a.type === 'negative_spike') {
                          setTopicFilter(null);
                          setSentimentFilter('frustrated');
                        } else {
                          setSentimentFilter('all');
                          setTopicFilter(a.filterKey);
                        }
                        setToastAlerts((prev) => prev.filter((x) => x.id !== a.id));
                      }}
                      className="underline font-bold"
                    >
                      Filter stream
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToastAlerts((prev) => prev.filter((x) => x.id !== a.id))}
                  aria-label="Dismiss anomaly notification"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anomaly Monitor Banner */}
      <div
        className={`rounded-xl border p-4 ${
          hasCritical
            ? 'border-rose-500/60 bg-rose-950/30'
            : hasAlerts
              ? 'border-amber-500/60 bg-amber-950/25'
              : 'border-white/10 bg-white/5'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-bold text-white">
            {hasCritical ? (
              <ShieldAlert size={16} className="text-rose-400 shrink-0" />
            ) : hasAlerts ? (
              <AlertTriangle size={16} className="text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            )}
            <span>
              {hasCritical
                ? `Critical Query Anomaly Detected (${alerts.length})`
                : hasAlerts
                  ? `Traffic Anomaly Detected (${alerts.length})`
                  : (snapshot?.total ?? 0) < 3
                    ? 'Real-Time Anomaly Monitor Active (awaiting >= 3 logged queries)'
                    : 'Anomaly Monitor: Request stream nominal'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAnalytics}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded border border-white/15 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-200 hover:border-neonCyan hover:text-neonCyan transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleGenerateInsights}
              disabled={insightsLoading || (snapshot?.total ?? 0) === 0}
              className="inline-flex items-center gap-1.5 rounded bg-neonPink/80 hover:bg-neonPink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white disabled:opacity-40 transition-colors"
            >
              {insightsLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Generate UX Report
            </button>
          </div>
        </div>

        {hasAlerts && (
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            {alerts.map((a) => (
              <div key={a.id} className="rounded-lg border border-white/10 bg-black/40 p-3 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className={a.severity === 'critical' ? 'text-rose-300' : 'text-amber-300'}>
                    {a.title}
                  </span>
                  <span className="font-mono text-gray-300">{a.metricValue}</span>
                </div>
                <p className="text-gray-300">{a.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {snapshot?.note && (
        <div className="rounded-lg border border-neonCyan/30 bg-neonCyan/5 p-3 text-xs text-neonCyan">
          {snapshot.note}
        </div>
      )}

      {insights && (
        <div className="glass-card-static p-5 space-y-4">
          <div className="text-xs font-orbitron uppercase tracking-widest text-neonCyan">
            AI UX & Content Insights ({insights.analyzedCount} interactions)
          </div>
          <p className="text-sm text-gray-200">{insights.executiveSummary}</p>
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-2">
              <div className="font-bold text-neonPink uppercase tracking-wider">Top FAQs</div>
              {insights.topFaqs.map((f, i) => (
                <div key={i} className="border-t border-white/10 pt-2">
                  <div className="font-bold text-white">{f.questionPattern}</div>
                  <div className="text-gray-400">{f.hubSection} · {f.frequencyLabel}</div>
                  <p className="text-gray-300 mt-1">{f.recommendedAnswer}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="font-bold text-amber-300 uppercase tracking-wider">Pain Points</div>
              {insights.painPoints.map((p, i) => (
                <div key={i} className="border-t border-white/10 pt-2">
                  <div className="font-bold text-white">{p.issue}</div>
                  <div className="text-gray-400">{p.severity} · {p.affectedSection}</div>
                  <p className="text-gray-300 mt-1">{p.uxFixRecommendation}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="font-bold text-green-400 uppercase tracking-wider">Content Demand</div>
              {insights.interestAreas.map((area, i) => (
                <div key={i} className="border-t border-white/10 pt-2">
                  <div className="font-bold text-white">{area.topic}</div>
                  <div className="text-gray-400">Demand: {area.demandLevel}</div>
                  <p className="text-gray-300 mt-1">{area.contentOpportunity}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card-static p-4">
          <div className="text-xs font-orbitron uppercase tracking-wider text-neonCyan mb-3">
            Top Search & Support Clusters
          </div>
          {topTopics.length === 0 ? (
            <p className="text-xs text-gray-400">Use &ldquo;Ask Hub AI&rdquo; to populate live clusters.</p>
          ) : (
            <ul className="divide-y divide-white/10 text-xs">
              {topTopics.map(([topic, count]) => (
                <li key={topic} className="py-2 flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTopicFilter((prev) => (prev === topic ? null : topic))}
                    className={`text-left ${topicFilter === topic ? 'text-neonCyan font-bold' : 'text-gray-200 hover:text-neonCyan'}`}
                  >
                    {topic}
                  </button>
                  <span className="font-mono text-gray-400">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass-card-static p-4">
          <div className="text-xs font-orbitron uppercase tracking-wider text-amber-300 mb-3">
            Detected Pain Points
          </div>
          {topPains.length === 0 ? (
            <p className="text-xs text-gray-400">No UX blockers detected yet.</p>
          ) : (
            <ul className="divide-y divide-white/10 text-xs">
              {topPains.map(([pain, count]) => (
                <li key={pain} className="py-2 flex justify-between items-center gap-2">
                  <span className="text-amber-200">{pain}</span>
                  <span className="font-mono text-gray-400">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {records.length > 0 && (
        <div className="glass-card-static p-4 overflow-x-auto">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-orbitron uppercase tracking-wider text-white">
              Recent Analyzed Queries ({records.length})
            </div>
            <div className="flex items-center gap-2 text-xs">
              {topicFilter && (
                <button
                  type="button"
                  onClick={() => setTopicFilter(null)}
                  className="text-neonCyan hover:underline"
                >
                  Clear topic: {topicFilter}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSentimentFilter((f) => (f === 'all' ? 'frustrated' : 'all'))}
                className="px-2.5 py-1 rounded border border-white/15 text-gray-200 hover:border-neonPink"
              >
                {sentimentFilter === 'frustrated' ? 'Showing: Frustrated' : 'Filter: Frustrated'}
              </button>
            </div>
          </div>
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 text-gray-400">
              <tr>
                <th className="py-2 pr-3">Query</th>
                <th className="py-2 pr-3">Cluster / Section</th>
                <th className="py-2 pr-3">Sentiment</th>
                <th className="py-2">Pain Point</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {records.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-3 text-gray-200 max-w-xs truncate">{r.query}</td>
                  <td className="py-2 pr-3 text-neonCyan">{r.topic_cluster} · {r.hub_section}</td>
                  <td className="py-2 pr-3 text-gray-300">{r.sentiment}</td>
                  <td className="py-2 text-amber-200">{r.pain_point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default HubQueryAnalyticsPanel;
