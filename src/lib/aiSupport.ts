import { SUPABASE_URL } from './SupabaseClient';

export const AI_SUPPORT_ENDPOINT = `${SUPABASE_URL}/functions/v1/ai-support`;

export interface HubSearchMatch {
  type: 'news' | 'catalog' | 'server' | 'faction' | 'job' | 'mod' | 'page';
  id: string;
  title: string;
  subtitle: string;
  url: string;
  meta: string;
  score: number;
}

export interface QueryAnalysisSummary {
  language: string;
  intent: string;
  urgency: string;
  sentiment: string;
  hubSection: string;
  topicCluster: string;
  painPoint: string;
  suggestedAction: string;
  summary: string;
}

export interface HubAIResponse {
  answer: string;
  matches: HubSearchMatch[];
  analysis: QueryAnalysisSummary | null;
  latencyMs: number;
}

export interface AnalyticsAlertItem {
  id: string;
  type: 'negative_spike' | 'topic_surge';
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  metricValue: string;
  affectedSection: string;
  filterKey: string;
  detectedAt: string;
}

export interface HubAnalyticsSnapshot {
  total: number;
  avgLatencyMs: number;
  byTopic: Record<string, number>;
  bySection: Record<string, number>;
  painPointsCount: Record<string, number>;
  alerts: AnalyticsAlertItem[];
  records: Array<{
    id: number;
    created_at: string;
    source: string;
    query: string;
    language: string;
    intent: string;
    urgency: string;
    sentiment: string;
    hub_section: string;
    topic_cluster: string;
    pain_point: string;
    suggested_action: string;
    latency_ms: number;
  }>;
  note?: string;
}

export interface HubInsightsReport {
  generatedAt: string;
  analyzedCount: number;
  executiveSummary: string;
  topFaqs: Array<{
    questionPattern: string;
    frequencyLabel: string;
    hubSection: string;
    recommendedAnswer: string;
  }>;
  painPoints: Array<{
    issue: string;
    severity: string;
    affectedSection: string;
    uxFixRecommendation: string;
  }>;
  interestAreas: Array<{
    topic: string;
    demandLevel: string;
    contentOpportunity: string;
  }>;
}

export interface RecentSearchEntry {
  id: string;
  query: string;
  category: string;
  timestamp: string;
  matchCount: number;
}

const RECENT_SEARCHES_KEY = 'vch_recent_searches_v1';

export function loadRecentSearches(): RecentSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(
  entry: Omit<RecentSearchEntry, 'id' | 'timestamp'>,
  prev: RecentSearchEntry[],
): RecentSearchEntry[] {
  const norm = entry.query.trim().toLowerCase();
  const next: RecentSearchEntry[] = [
    {
      ...entry,
      id: `rs_${Date.now()}`,
      timestamp: new Date().toISOString(),
    },
    ...prev.filter(
      (item) => !(item.query.toLowerCase() === norm && item.category === entry.category),
    ),
  ].slice(0, 8);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage errors */
    }
  }
  return next;
}

export function clearRecentSearches(): RecentSearchEntry[] {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      /* ignore */
    }
  }
  return [];
}

async function callEdge<T>(payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(AI_SUPPORT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `AI support service error (${res.status}).`);
  }
  return data as T;
}

export function askHubAI(params: {
  action: 'search' | 'chat';
  query: string;
  category?: string;
  messages?: Array<{ role: 'user' | 'assistant'; text: string }>;
  pagePath?: string;
}): Promise<HubAIResponse> {
  return callEdge<HubAIResponse>(params);
}

export function fetchHubQueryAnalytics(): Promise<HubAnalyticsSnapshot> {
  return callEdge<HubAnalyticsSnapshot>({ action: 'analytics' });
}

export function generateHubInsightsReport(): Promise<HubInsightsReport> {
  return callEdge<HubInsightsReport>({ action: 'insights' });
}
