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

type DerivedAudienceProfile = Omit<AudienceProfile, 'source_file_name' | 'audience_biases' | 'summary'>;

type ParsedSheet = {
  sheetName: string;
  rows: SpreadsheetRow[];
  headers: string[];
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
    const headers = rows[0] ? Object.keys(rows[0]).map(normalizeWhitespace) : [];

    return {
      sheetName,
      rows,
      headers,
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

export function extractAudienceProfile(fileBuffer: Buffer, fileName: string): AudienceProfile {
  const workbook = parseWorkbookFromBuffer(fileBuffer);
  const sheets = readAllSheetsFromWorkbook(workbook);

  if (sheets.length === 0) {
    throw new Error('The uploaded file does not contain any worksheet data.');
  }

  const demographicsSheet = [...sheets]
    .sort((left, right) => getDemographicsSheetScore(right) - getDemographicsSheetScore(left))[0];

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
    };
  })();

  const audience_biases = deriveAudienceBiases(baseProfile);

  return {
    source_file_name: fileName,
    ...baseProfile,
    audience_biases,
    summary: buildSummary(baseProfile),
  };
}
