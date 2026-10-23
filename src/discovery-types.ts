export type StreamingSource = 'youtube' | 'netflix' | 'disney' | 'prime' | 'max';
export interface LinkAnalysis {
  source: StreamingSource;
  providerName: string;
  url: string;
  contentId: string;
  kind: 'video' | 'title' | 'movie' | 'series' | 'episode' | 'unknown';
  metadata: {
    status: 'fetched' | 'manual' | 'unavailable';
    title: string;
    description: string;
    creator: string;
    thumbnail: string;
    durationSeconds: number | null;
    originUrl: string | null;
    fetchedAt: string | null;
  };
  integration: {
    providerPlayerApi: boolean;
    inAppPlaybackImplemented: false;
    durationAvailable: boolean;
  };
  warnings: string[];
}
export interface DiscoveryResult {
  id: string;
  source: StreamingSource;
  providerName: string;
  title: string;
  description: string;
  reason: string;
  url: string;
  thumbnail: string;
  durationSeconds: number | null;
  availability: 'not-verified';
  price: null;
  evidence: { title: string; url: string }[];
}
export interface DiscoveryResponse {
  query: string;
  country: string;
  summary: string;
  results: DiscoveryResult[];
  searchedAt: string;
  warnings: string[];
}
export interface DiscoveryConfig {
  configured: boolean;
  model: string;
  services: { id: StreamingSource; name: string }[];
  defaultCountry: string;
}
