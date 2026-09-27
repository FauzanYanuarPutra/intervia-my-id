import { plainTextToNewsHtml } from '@/lib/newsRichText';
import { normalizeNewsMediaUrl } from '@/lib/newsMediaUrl';

export type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  body: string;
  tags?: string[] | null;
  content_status: string;
  metadata?: Record<string, unknown>;
  cover_image?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionForm = {
  title: string;
  summary: string;
  body: string;
  rich_body: string;
  category: string;
  article_kind: string;
  location: string;
  cover_image: string;
  topics: string;
  source_urls: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function urls(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function topics(value: unknown, category: string, kind: string): string[] {
  const reserved = new Set([
    'news',
    'analysis',
    'press_release',
    category.toLowerCase(),
    kind.toLowerCase(),
  ]);
  return urls(value).filter(topic => !reserved.has(topic.toLowerCase()));
}

export function submissionFormFromItem(item: NewsItem): SubmissionForm {
  const news = record(record(item.metadata).news);
  const category = text(news.category) || 'Ekonomi';
  const kind = text(news.article_kind) || 'news';
  const storedRichBody = text(news.rich_body);

  return {
    title: item.title,
    summary: item.summary || '',
    body: item.body,
    rich_body: storedRichBody || plainTextToNewsHtml(item.body),
    category,
    article_kind: kind,
    location: text(news.location),
    cover_image: normalizeNewsMediaUrl(item.cover_image) || '',
    topics: topics(item.tags, category, kind).join(', '),
    source_urls: urls(news.source_urls).join('\\n'),
  };
}
