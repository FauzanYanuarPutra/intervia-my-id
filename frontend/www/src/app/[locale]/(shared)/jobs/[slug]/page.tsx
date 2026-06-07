import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JobDetailClient from './client';
import {
  asString,
  ContentItem,
  extractContentItems,
  formatIDRFromCents,
} from '@/lib/content/catalog';
import {
  formatPriceWithUnit,
  resolveContentPriceUnitLabel,
} from '@/lib/content/priceUnit';

const MARKETPLACE_BASE =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';

type JobDetailView = {
  id: string;
  slug: string;
  title: string;
  company: string;
  companyDescription: string;
  companyWebsite: string;
  companySize: string;
  logo: string;
  location: string;
  type: string;
  salary: string;
  salaryPeriod: 'bulan';
  level: string;
  category: string;
  isRemote: boolean;
  isUrgent: boolean;
  postedAt: string;
  deadline: string;
  description: string[];
  responsibilities: string[];
  requirements: string[];
  benefits: Array<{ icon: string; label: string }>;
};

async function fetchJobContent(slug: string): Promise<ContentItem | null> {
  try {
    const byIdRes = await fetch(
      `${MARKETPLACE_BASE}/v1/content/${encodeURIComponent(slug)}`,
      { cache: 'no-store' },
    );

    if (byIdRes.ok) {
      const byIdData = (await byIdRes
        .json()
        .catch(() => null)) as ContentItem | null;
      if (byIdData?.id) return byIdData;
    }
  } catch {
    // Continue with query fallback.
  }

  try {
    const query = new URLSearchParams({
      type: 'job',
      q: slug,
      limit: '20',
      offset: '0',
    });

    const listRes = await fetch(
      `${MARKETPLACE_BASE}/v1/content?${query.toString()}`,
      {
        cache: 'no-store',
      },
    );
    if (!listRes.ok) return null;

    const payload = await listRes.json().catch(() => []);
    const items = extractContentItems(payload);
    const exactMatch = items.find(
      item => item.slug === slug || String(item.id) === slug,
    );
    return exactMatch || null;
  } catch {
    return null;
  }
}

function splitTextBlock(text?: string): string[] {
  if (!text) return [];
  return text
    .split(/\n+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function mapToJobDetail(
  item: ContentItem,
  locale: 'id' | 'en' = 'id',
): JobDetailView {
  const meta = item.metadata || {};
  const descriptionParts = splitTextBlock(
    item.body || item.summary || asString(meta.description),
  );
  const requirements = splitTextBlock(asString(meta.requirements));
  const responsibilities = splitTextBlock(asString(meta.responsibilities));
  const salary = formatIDRFromCents(item.price_cents);
  const salaryUnitLabel = resolveContentPriceUnitLabel(item, locale);
  const fallbackSalaryLabel = asString(meta.salary_range);

  return {
    id: String(item.id),
    slug: item.slug || String(item.id),
    title: item.title || item.summary || 'Untitled Job',
    company:
      asString(meta.company) ||
      asString(meta.company_name) ||
      asString(meta.organization) ||
      'Unknown Company',
    companyDescription:
      asString(meta.company_description) ||
      asString(meta.about_company) ||
      descriptionParts[0] ||
      '',
    companyWebsite:
      asString(meta.company_website) || asString(meta.website) || '',
    companySize: asString(meta.company_size) || '',
    logo: item.cover_image || asString(meta.logo) || '',
    location: asString(meta.location) || asString(meta.city) || 'Remote',
    type: asString(meta.job_type) || asString(meta.employment_type) || 'Job',
    salary:
      salary !== '-'
        ? formatPriceWithUnit(salary, salaryUnitLabel)
        : fallbackSalaryLabel
          ? formatPriceWithUnit(fallbackSalaryLabel, salaryUnitLabel)
          : 'Negotiable',
    salaryPeriod: 'bulan',
    level: asString(meta.level) || asString(meta.seniority) || 'Any',
    category: asString(item.category) || asString(meta.category) || 'General',
    isRemote:
      asString(meta.location)?.toLowerCase().includes('remote') ||
      asString(meta.work_mode)?.toLowerCase() === 'remote',
    isUrgent: Boolean(meta.is_urgent),
    postedAt: asString(item.created_at) || new Date().toISOString(),
    deadline: asString(meta.deadline) || '',
    description: descriptionParts.length
      ? descriptionParts
      : [item.summary || 'No description'],
    responsibilities,
    requirements,
    benefits: Array.isArray(meta.benefits)
      ? (meta.benefits as Array<string>).map((benefit, index) => ({
          icon: `benefit_${index + 1}`,
          label: benefit,
        }))
      : [],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await fetchJobContent(slug);

  if (!item) {
    return { title: 'Job Not Found | Lajukan' };
  }

  const job = mapToJobDetail(item);
  return {
    title: `${job.title} at ${job.company} | Lajukan`,
    description: `${job.title} - ${job.location}. ${job.salary}.`,
    openGraph: {
      title: `${job.title} - ${job.company}`,
      description: job.companyDescription || job.description[0] || '',
      images: job.logo ? [job.logo] : [],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: job.title,
      description: job.companyDescription || job.description[0] || '',
      images: job.logo ? [job.logo] : [],
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const item = await fetchJobContent(slug);

  if (!item) {
    notFound();
  }

  const job = mapToJobDetail(item, locale === 'en' ? 'en' : 'id');
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: `<p>${job.description.join(' ')}</p>`,
    identifier: {
      '@type': 'PropertyValue',
      name: job.company,
      value: job.id,
    },
    datePosted: job.postedAt,
    employmentType: job.type.toUpperCase().replace(/\s+/g, '_'),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      sameAs: job.companyWebsite || undefined,
      logo: job.logo || undefined,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
        addressCountry: 'ID',
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <JobDetailClient job={job} locale={locale} />
    </>
  );
}
