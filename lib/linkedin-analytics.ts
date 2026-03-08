import * as XLSX from 'xlsx';

type AggregatedEntry = {
  label: string;
  weight: number;
};

type DetectedColumns = {
  industry?: string;
  seniority?: string;
  jobFunction?: string;
  companySize?: string;
  location?: string;
  title?: string;
  weight?: string;
};

type SpreadsheetRow = Record<string, unknown>;

export type AudienceProfile = {
  source_file_name: string;
  source_sheet_name: string;
  total_rows: number;
  raw_columns: string[];
  top_industries: AggregatedEntry[];
  top_seniority: AggregatedEntry[];
  top_job_functions: AggregatedEntry[];
  top_company_sizes: AggregatedEntry[];
  top_locations: AggregatedEntry[];
  audience_biases: string[];
  summary: string;
};

export type EngagementSeriesPoint = {
  date: string;
  impressions: number;
  engagements: number;
  engagement_rate: number;
};

export type TopPost = {
  url: string;
  published_at: string;
  impressions: number | null;
  engagements: number | null;
  engagement_rate: number | null;
};

export type PerformanceInsight = {
  title: string;
  detail: string;
  emphasis: 'positive' | 'watchout' | 'tip';
};

export type LinkedInAnalyticsSnapshot = {
  audienceProfile: AudienceProfile;
  engagementSeries: EngagementSeriesPoint[];
  topPosts: TopPost[];
  performanceInsights: PerformanceInsight[];
};

type DerivedAudienceProfile = Omit<AudienceProfile, 'source_file_name' | 'audience_biases' | 'summary'>;

type ParsedSheet = {
  sheetName: string;
  rows: SpreadsheetRow[];
  headers: string[];
  gridRows: unknown[][];
};

const HEADER_ALIASES: Record<keyof Omit<DetectedColumns, 'weight'>, RegExp[]> = {
  industry: [/industry/i, /sector/i],
  seniority: [/seniority/i, /experience level/i, /job seniority/i, /level/i],
  jobFunction: [/job function/i, /function/i, /department/i, /occupation/i, /role type/i],
  companySize: [/company size/i, /organization size/i, /headcount/i, /employee count/i],
  location: [/location/i, /country/i, /region/i, /market/i],
  title: [/job title/i, /title/i, /role/i],
};

const WEIGHT_HEADER_PATTERNS = [/count/i, /followers/i, /audience/i, /members?/i, /value/i, /percentage/i, /percent/i, /pct/i, /share/i, /total/i];

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function detectColumns(headers: string[]): DetectedColumns {
  const detected: DetectedColumns = {};

  for (const header of headers) {
    if (!detected.weight && WEIGHT_HEADER_PATTERNS.some(pattern => pattern.test(header))) {
      detected.weight = header;
    }

    for (const [key, patterns] of Object.entries(HEADER_ALIASES) as Array<[keyof Omit<DetectedColumns, 'weight'>, RegExp[]]>) {
      if (!detected[key] && patterns.some(pattern => pattern.test(header))) {
        detected[key] = header;
      }
    }
  }

  return detected;
}

function parseNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return NaN;
  }

  if (value.trim() === '< 1%') {
    return 0.5;
  }

  const cleaned = value.replace(/,/g, '').replace(/%/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roundMetric(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function formatDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return new Date(parsed.y, parsed.m - 1, parsed.d);
    }
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readCell(row: SpreadsheetRow, column?: string) {
  if (!column) {
    return '';
  }

  const value = row[column];
  return typeof value === 'string' ? normalizeWhitespace(value) : String(value ?? '').trim();
}

function getRowWeight(row: SpreadsheetRow, detected: DetectedColumns) {
  const explicitWeight = parseNumericValue(detected.weight ? row[detected.weight] : undefined);
  if (Number.isFinite(explicitWeight) && explicitWeight > 0) {
    return explicitWeight;
  }

  for (const [header, value] of Object.entries(row)) {
    if (!WEIGHT_HEADER_PATTERNS.some(pattern => pattern.test(header))) {
      continue;
    }

    const parsed = parseNumericValue(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 1;
}

function accumulate(map: Map<string, AggregatedEntry>, label: string, weight: number) {
  const normalizedLabel = normalizeWhitespace(label);
  if (!normalizedLabel) {
    return;
  }

  const existing = map.get(normalizedLabel.toLowerCase());
  if (existing) {
    existing.weight += weight;
    return;
  }

  map.set(normalizedLabel.toLowerCase(), {
    label: normalizedLabel,
    weight,
  });
}

function toTopEntries(map: Map<string, AggregatedEntry>, limit = 4) {
  return Array.from(map.values())
    .sort((left, right) => right.weight - left.weight)
    .slice(0, limit)
    .map(entry => ({
      label: entry.label,
      weight: Math.round(entry.weight * 100) / 100,
    }));
}

function deriveJobFunctionFromTitle(title: string) {
  const normalized = title.toLowerCase();

  if (/data|analytics|bi\b|machine learning|ml|ai|research/i.test(normalized)) {
    return 'Data & AI';
  }

  if (/software|frontend|front-end|backend|back-end|fullstack|full-stack|engineer|developer|sre|devops|platform/i.test(normalized)) {
    return 'Engineering';
  }

  if (/product manager|product owner|product lead/i.test(normalized)) {
    return 'Product';
  }

  if (/designer|ux|ui|visual design|product design/i.test(normalized)) {
    return 'Design';
  }

  if (/recruit|talent|hr|people ops/i.test(normalized)) {
    return 'Talent & HR';
  }

  if (/founder|ceo|cto|coo|president|head of|vp|director|manager|lead/i.test(normalized)) {
    return 'Leadership';
  }

  if (/marketing|sales|growth|business development|account/i.test(normalized)) {
    return 'Go-to-market';
  }

  if (/student|assistant|intern|teaching assistant|research assistant/i.test(normalized)) {
    return 'Early career';
  }

  return 'Cross-functional';
}

function readAllSheetsFromWorkbook(workbook: XLSX.WorkBook) {
  return workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, { defval: '' });
    const gridRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
    const headers = rows[0] ? Object.keys(rows[0]).map(normalizeWhitespace) : [];

    return {
      sheetName,
      rows,
      headers,
      gridRows,
    } satisfies ParsedSheet;
  }).filter(sheet => sheet.rows.length > 0);
}

function getDemographicsSheetScore(sheet: ParsedSheet) {
  let score = 0;
  const sheetName = sheet.sheetName.toLowerCase();
  const headers = sheet.headers.map(header => header.toLowerCase());

  if (sheetName.includes('demographic')) score += 10;
  if (headers.includes('top demographics')) score += 5;
  if (headers.includes('value')) score += 2;
  if (headers.includes('percentage')) score += 2;

  return score;
}

function getEngagementSheetScore(sheet: ParsedSheet) {
  let score = 0;
  const sheetName = sheet.sheetName.toLowerCase();
  const headers = sheet.headers.map(header => header.toLowerCase());

  if (sheetName.includes('engagement')) score += 8;
  if (headers.includes('date')) score += 3;
  if (headers.includes('impressions')) score += 3;
  if (headers.includes('engagements')) score += 3;

  return score;
}

function getTopPostsSheetScore(sheet: ParsedSheet) {
  let score = 0;
  const sheetName = sheet.sheetName.toLowerCase();
  const flatCells = sheet.gridRows
    .slice(0, 5)
    .flat()
    .map(cell => normalizeWhitespace(String(cell ?? '')).toLowerCase())
    .filter(Boolean);

  if (sheetName.includes('top')) score += 6;
  if (sheetName.includes('post')) score += 6;
  if (flatCells.includes('post url')) score += 4;
  if (flatCells.includes('impressions')) score += 2;
  if (flatCells.includes('engagements')) score += 2;

  return score;
}

function extractEngagementSeries(sheet: ParsedSheet) {
  const dateHeader = sheet.headers.find(header => /^date$/i.test(header));
  const impressionsHeader = sheet.headers.find(header => /impressions/i.test(header));
  const engagementsHeader = sheet.headers.find(header => /engagements/i.test(header));

  if (!dateHeader || !impressionsHeader || !engagementsHeader) {
    return [];
  }

  const series = sheet.rows
    .map(row => {
      const date = parseDateValue(row[dateHeader]);
      const impressions = parseNumericValue(row[impressionsHeader]);
      const engagements = parseNumericValue(row[engagementsHeader]);

      if (!date || !Number.isFinite(impressions) || !Number.isFinite(engagements)) {
        return null;
      }

      return {
        date: formatDateIso(date),
        impressions,
        engagements,
        engagement_rate: impressions > 0 ? roundMetric((engagements / impressions) * 100) : 0,
      } satisfies EngagementSeriesPoint;
    })
    .filter((point): point is EngagementSeriesPoint => Boolean(point))
    .sort((left, right) => left.date.localeCompare(right.date));

  return series.slice(-90);
}

function extractTopPosts(sheet: ParsedSheet) {
  const headerRowIndex = sheet.gridRows.findIndex(row => {
    const normalized = row.map(cell => normalizeWhitespace(String(cell ?? '')).toLowerCase());
    return normalized.includes('post url') && (normalized.includes('engagements') || normalized.includes('impressions'));
  });

  if (headerRowIndex === -1) {
    return [];
  }

  const postMap = new Map<string, TopPost>();
  const columnGroups = [
    { urlIndex: 0, dateIndex: 1, valueIndex: 2, metric: 'engagements' as const },
    { urlIndex: 4, dateIndex: 5, valueIndex: 6, metric: 'impressions' as const },
  ];

  for (const row of sheet.gridRows.slice(headerRowIndex + 1)) {
    for (const group of columnGroups) {
      const rawUrl = normalizeWhitespace(String(row[group.urlIndex] ?? ''));
      if (!rawUrl.startsWith('http')) {
        continue;
      }

      const publishedAt = parseDateValue(row[group.dateIndex]);
      const metricValue = parseNumericValue(row[group.valueIndex]);
      const existing = postMap.get(rawUrl) || {
        url: rawUrl,
        published_at: publishedAt ? formatDateIso(publishedAt) : '',
        impressions: null,
        engagements: null,
        engagement_rate: null,
      };

      if (publishedAt && !existing.published_at) {
        existing.published_at = formatDateIso(publishedAt);
      }

      if (Number.isFinite(metricValue)) {
        existing[group.metric] = metricValue;
      }

      if (existing.impressions && existing.engagements !== null && existing.impressions > 0) {
        existing.engagement_rate = roundMetric((existing.engagements / existing.impressions) * 100);
      }

      postMap.set(rawUrl, existing);
    }
  }

  return Array.from(postMap.values())
    .filter(post => post.impressions !== null || post.engagements !== null)
    .sort((left, right) => {
      const rightPrimary = right.impressions ?? right.engagements ?? 0;
      const leftPrimary = left.impressions ?? left.engagements ?? 0;
      if (rightPrimary !== leftPrimary) {
        return rightPrimary - leftPrimary;
      }

      return (right.engagements ?? 0) - (left.engagements ?? 0);
    })
    .slice(0, 6);
}

function formatRangeLabel(days: number) {
  return days === 1 ? '1 day' : `${days} days`;
}

function derivePerformanceInsights(series: EngagementSeriesPoint[], topPosts: TopPost[]) {
  const insights: PerformanceInsight[] = [];

  if (series.length > 0) {
    const totalImpressions = series.reduce((sum, point) => sum + point.impressions, 0);
    const totalEngagements = series.reduce((sum, point) => sum + point.engagements, 0);
    const averageRate = totalImpressions > 0 ? roundMetric((totalEngagements / totalImpressions) * 100) : 0;
    const lookback = Math.min(7, Math.max(1, Math.floor(series.length / 2)));
    const recentWindow = series.slice(-lookback);
    const priorWindow = series.slice(-(lookback * 2), -lookback);
    const recentAverage = recentWindow.reduce((sum, point) => sum + point.impressions, 0) / recentWindow.length;
    const priorAverage = priorWindow.length > 0
      ? priorWindow.reduce((sum, point) => sum + point.impressions, 0) / priorWindow.length
      : recentAverage;
    const momentum = priorAverage > 0 ? roundMetric(((recentAverage - priorAverage) / priorAverage) * 100) : 0;

    insights.push({
      title: 'Reach momentum',
      detail: `Across the last ${formatRangeLabel(series.length)}, you generated ${Math.round(totalImpressions).toLocaleString()} impressions and ${Math.round(totalEngagements).toLocaleString()} engagements with an average engagement rate of ${averageRate}%. ${momentum >= 0 ? 'Recent reach is climbing' : 'Recent reach has cooled'} by ${Math.abs(momentum)}% versus the prior window.`,
      emphasis: momentum >= 0 ? 'positive' : 'watchout',
    });

    const weekdayStats = new Map<string, { totalRate: number; count: number }>();
    for (const point of series) {
      const weekday = new Date(point.date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const existing = weekdayStats.get(weekday) || { totalRate: 0, count: 0 };
      existing.totalRate += point.engagement_rate;
      existing.count += 1;
      weekdayStats.set(weekday, existing);
    }

    const bestWeekday = Array.from(weekdayStats.entries())
      .map(([weekday, stats]) => ({ weekday, averageRate: stats.totalRate / stats.count }))
      .sort((left, right) => right.averageRate - left.averageRate)[0];

    if (bestWeekday) {
      insights.push({
        title: 'Best day to publish next',
        detail: `${bestWeekday.weekday} produced your strongest average engagement rate in this export window. Queue one of next week's highest-conviction posts for ${bestWeekday.weekday.toLowerCase()} and use a sharper opening hook than your baseline updates.`,
        emphasis: 'tip',
      });
    }
  }

  if (topPosts.length > 0) {
    const leader = topPosts[0];
    const benchmarkMetric = leader.impressions ?? leader.engagements ?? 0;
    const runnerUpMetric = topPosts[1] ? (topPosts[1].impressions ?? topPosts[1].engagements ?? 0) : 0;
    const gap = runnerUpMetric > 0 ? roundMetric(((benchmarkMetric - runnerUpMetric) / runnerUpMetric) * 100) : 0;

    insights.push({
      title: 'What your strongest post suggests',
      detail: `Your top post from ${leader.published_at || 'this period'} led with ${leader.impressions?.toLocaleString() ?? 0} impressions and ${leader.engagements?.toLocaleString() ?? 0} engagements. Treat that format as a benchmark and reuse its structure when testing your next post; it outperformed the next best post by ${Math.max(gap, 0)}% on the primary metric.`,
      emphasis: 'positive',
    });
  }

  return insights.slice(0, 3);
}

function extractProfileFromDemographicsSheet(sheet: ParsedSheet): DerivedAudienceProfile | null {
  const categoryHeader = sheet.headers.find(header => /top demographics/i.test(header));
  const valueHeader = sheet.headers.find(header => /^value$/i.test(header));
  const percentageHeader = sheet.headers.find(header => /percentage/i.test(header));

  if (!categoryHeader || !valueHeader) {
    return null;
  }

  const industries = new Map<string, AggregatedEntry>();
  const seniority = new Map<string, AggregatedEntry>();
  const jobFunctions = new Map<string, AggregatedEntry>();
  const companySizes = new Map<string, AggregatedEntry>();
  const locations = new Map<string, AggregatedEntry>();
  const jobTitles = new Map<string, AggregatedEntry>();

  for (const row of sheet.rows) {
    const category = readCell(row, categoryHeader).toLowerCase();
    const value = readCell(row, valueHeader);
    const weight = parseNumericValue(percentageHeader ? row[percentageHeader] : undefined);
    const normalizedWeight = Number.isFinite(weight) && weight > 0 ? weight * 100 : 1;

    if (!value) {
      continue;
    }

    if (category === 'industries') {
      accumulate(industries, value, normalizedWeight);
    } else if (category === 'seniority') {
      accumulate(seniority, value, normalizedWeight);
    } else if (category === 'company size') {
      accumulate(companySizes, value, normalizedWeight);
    } else if (category === 'locations') {
      accumulate(locations, value, normalizedWeight);
    } else if (category === 'job titles') {
      accumulate(jobTitles, value, normalizedWeight);
      accumulate(jobFunctions, deriveJobFunctionFromTitle(value), normalizedWeight);
    }
  }

  return {
    source_sheet_name: sheet.sheetName,
    total_rows: sheet.rows.length,
    raw_columns: sheet.headers,
    top_industries: toTopEntries(industries),
    top_seniority: toTopEntries(seniority),
    top_job_functions: toTopEntries(jobFunctions),
    top_company_sizes: toTopEntries(companySizes),
    top_locations: toTopEntries(locations),
  };
}

function deriveAudienceBiases(profile: DerivedAudienceProfile) {
  const biases = new Set<string>();

  const topFunction = profile.top_job_functions[0]?.label?.toLowerCase() || '';
  const topSeniority = profile.top_seniority[0]?.label?.toLowerCase() || '';
  const topIndustry = profile.top_industries[0]?.label?.toLowerCase() || '';
  const topCompanySize = profile.top_company_sizes[0]?.label?.toLowerCase() || '';

  if (/engineering|developer|software|data|it|product/i.test(topFunction)) {
    biases.add('technical');
  }

  if (/recruit|talent|hr/i.test(topFunction)) {
    biases.add('hiring-focused');
  }

  if (/marketing|sales|creator|media/i.test(topFunction)) {
    biases.add('brand-aware');
  }

  if (/senior|lead|manager|director|vp|head|exec/i.test(topSeniority)) {
    biases.add('senior-heavy');
  }

  if (/entry|junior|associate|early/i.test(topSeniority)) {
    biases.add('early-career');
  }

  if (/startup|series/i.test(topCompanySize)) {
    biases.add('startup-oriented');
  }

  if (/enterprise|1000|5000|large/i.test(topCompanySize)) {
    biases.add('enterprise-oriented');
  }

  if (/ai|software|saas|tech|fintech/i.test(topIndustry)) {
    biases.add('tech-forward');
  }

  if (biases.size === 0) {
    biases.add('general-professional');
  }

  return Array.from(biases);
}

function buildSummary(profile: DerivedAudienceProfile) {
  const industry = profile.top_industries[0]?.label || 'general professional';
  const seniority = profile.top_seniority[0]?.label || 'mixed seniority';
  const jobFunction = profile.top_job_functions[0]?.label || 'cross-functional';
  const companySize = profile.top_company_sizes[0]?.label || 'mixed company sizes';

  return `Audience leans ${jobFunction.toLowerCase()} in ${industry.toLowerCase()}, with a ${seniority.toLowerCase()} skew and ${companySize.toLowerCase()} company mix.`;
}

function parseWorkbookFromBuffer(fileBuffer: Buffer) {
  try {
    return XLSX.read(fileBuffer, { type: 'buffer' });
  } catch {
    const textCandidate = fileBuffer.toString('utf8');
    if (!textCandidate.trim()) {
      throw new Error('The uploaded analytics file appears to be empty.');
    }

    try {
      return XLSX.read(textCandidate, { type: 'string' });
    } catch {
      throw new Error('Unsupported LinkedIn export format. Upload CSV or Excel files (.xlsx, .xls, .xlsm, .xlsb, .xlxs).');
    }
  }
}

export function extractLinkedInAnalytics(fileBuffer: Buffer, fileName: string): LinkedInAnalyticsSnapshot {
  const workbook = parseWorkbookFromBuffer(fileBuffer);
  const sheets = readAllSheetsFromWorkbook(workbook);

  if (sheets.length === 0) {
    throw new Error('The uploaded file does not contain any worksheet data.');
  }

  const demographicsSheet = [...sheets]
    .sort((left, right) => getDemographicsSheetScore(right) - getDemographicsSheetScore(left))[0];
  const engagementSheet = [...sheets]
    .sort((left, right) => getEngagementSheetScore(right) - getEngagementSheetScore(left))[0];
  const topPostsSheet = [...sheets]
    .sort((left, right) => getTopPostsSheetScore(right) - getTopPostsSheetScore(left))[0];

  const demographicsProfile = demographicsSheet ? extractProfileFromDemographicsSheet(demographicsSheet) : null;

  const baseProfile = demographicsProfile || (() => {
    const fallbackSheet = sheets[0];
    const rawColumns = Array.from(
      fallbackSheet.rows.reduce((headers, row) => {
        Object.keys(row).forEach(header => headers.add(normalizeWhitespace(header)));
        return headers;
      }, new Set<string>()),
    );

    const detected = detectColumns(rawColumns);
    const industries = new Map<string, AggregatedEntry>();
    const seniority = new Map<string, AggregatedEntry>();
    const jobFunctions = new Map<string, AggregatedEntry>();
    const companySizes = new Map<string, AggregatedEntry>();
    const locations = new Map<string, AggregatedEntry>();

    for (const row of fallbackSheet.rows) {
      const weight = getRowWeight(row, detected);

      accumulate(industries, readCell(row, detected.industry), weight);
      accumulate(seniority, readCell(row, detected.seniority), weight);
      accumulate(jobFunctions, readCell(row, detected.jobFunction), weight);
      accumulate(companySizes, readCell(row, detected.companySize), weight);
      accumulate(locations, readCell(row, detected.location), weight);
    }

    return {
      source_sheet_name: fallbackSheet.sheetName,
      total_rows: fallbackSheet.rows.length,
      raw_columns: rawColumns,
      top_industries: toTopEntries(industries),
      top_seniority: toTopEntries(seniority),
      top_job_functions: toTopEntries(jobFunctions),
      top_company_sizes: toTopEntries(companySizes),
      top_locations: toTopEntries(locations),
    } satisfies DerivedAudienceProfile;
  })();

  const audience_biases = deriveAudienceBiases(baseProfile);
  const audienceProfile: AudienceProfile = {
    source_file_name: fileName,
    ...baseProfile,
    audience_biases,
    summary: buildSummary(baseProfile),
  };

  const engagementSeries = engagementSheet ? extractEngagementSeries(engagementSheet) : [];
  const topPosts = topPostsSheet ? extractTopPosts(topPostsSheet) : [];
  const performanceInsights = derivePerformanceInsights(engagementSeries, topPosts);

  return {
    audienceProfile,
    engagementSeries,
    topPosts,
    performanceInsights,
  };
}

export function extractAudienceProfile(fileBuffer: Buffer, fileName: string): AudienceProfile {
  return extractLinkedInAnalytics(fileBuffer, fileName).audienceProfile;
}
