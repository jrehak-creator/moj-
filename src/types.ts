export type Source = 'youtube' | 'netflix' | 'disney' | 'upload';
export type Collection = 'Nature & animals' | 'Curious minds' | 'Stories & imagination' | 'Music & movement';
export interface Video {
  id: string;
  url: string;
  source: Source;
  title: string;
  description: string;
  creator: string;
  duration: number | null;
  age: string;
  collection: Collection;
  tags: string[];
  thumbnail: string;
  artwork: string;
  approved: boolean;
  favorite: boolean;
  createdAt: string;
  mediaUrl?: string;
}
export interface Library {
  videos: Video[];
  demo: boolean;
  pinConfigured: boolean;
  parent: boolean;
}
export interface Metadata {
  url: string;
  source: Source;
  title: string;
  description: string;
  creator: string;
  thumbnail: string;
  duration: number | null;
  warning?: string;
}
