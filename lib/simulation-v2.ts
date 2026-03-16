export type UserBrandProfile = {
  clerk_user_id: string;
  full_name?: string;
  current_role?: string;
  current_job_role?: string;
  target_roles?: string[];
  target_industries?: string[];
  years_experience?: number | null;
  expertise_areas?: string[];
  personal_brand_keywords?: string[];
  writing_tone?: string;
  career_goals?: string;
  call_to_action_preference?: string;
  updated_at?: string;
};

export type AudienceSimulationPersona = {
  title: string;
  description: string;
  likely_reaction: string;
  influencing_elements: string;
  relationship_to_goals: string;
};

export type EngagementPrediction = {
  estimated_engagement_rate: string;
  likely_segments: string[];
  potential_reach: string;
  key_factors: string[];
  raw: string;
};

export type RecommendationItem = {
  action: string;
  why: string;
  example: string;
};

export type RevisedPostExample = {
  original: string;
  revised: string;
  raw: string;
};

export type SimulationReportV2 = {
  prompt_version: 'v2';
  analysis: string;
  audience_simulation: {
    personas: AudienceSimulationPersona[];
    raw: string;
  };
  engagement_prediction: EngagementPrediction;
  strengths: Array<{ title: string; why: string }>;
  weaknesses: Array<{ issue: string; impact: string }>;
  recommendations: RecommendationItem[];
  revised_post_example: RevisedPostExample;
  coaching: {
    whats_working_summary?: string;
    whats_working?: string[];
    whats_losing_them_summary?: string;
    whats_losing_them?: string[];
    edits_to_add?: string[];
    suggested_fix?: string;
    rewritten_post?: string;
  };
};

export type AggregateAudiencePayload = {
  engagement_score?: number;
  would_stop_scrolling_pct?: number;
  would_like_pct?: number;
  would_comment_pct?: number;
  score_breakdown?: {
    attention?: number;
    approval?: number;
    conversation?: number;
    sentiment?: number;
  };
  scoring_version?: string;
  coaching?: {
    whats_working_summary?: string;
    whats_working?: string[] | string;
    whats_losing_them_summary?: string;
    whats_losing_them?: string[] | string;
    edits_to_add?: string[] | string;
    suggested_fix?: string[] | string;
    rewritten_post?: string;
  };
  prompt_version?: string;
  analysis?: string;
  audience_simulation?: {
    personas: AudienceSimulationPersona[];
    raw: string;
  };
  engagement_prediction?: EngagementPrediction;
  strengths?: Array<{ title: string; why: string }>;
  weaknesses?: Array<{ issue: string; impact: string }>;
  recommendations?: RecommendationItem[];
  revised_post_example?: RevisedPostExample;
  dangerous_reply?: string;
};

export function parseDelimitedList(value: string): string[] {
  return value
    .split(/\n|;|\|/)
    .map(item => cleanText(item))
    .filter(Boolean);
}

function cleanText(value: string): string {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/^[-*\d.)\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueByNormalized(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    out.push(value);
  }

  return out;
}

function extractTagBlock(text: string, tag: string): string {
  const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'i');
  const fullMatch = text.match(regex)?.[0];
  if (!fullMatch) {
    return '';
  }

  return fullMatch
    .replace(new RegExp(`^<${tag}>`, 'i'), '')
    .replace(new RegExp(`<\\/${tag}>$`, 'i'), '')
    .trim();
}

function parseLabeledLine(block: string, label: string): string {
  const labelEscaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`(?:^|\\n)\\s*[-*]?\\s*${labelEscaped}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*[-*]?\\s*[A-Za-z][^:\\n]{0,80}:|$)`, 'i'));
  return cleanText(match?.[1] || '');
}

function parsePersonaBlocks(block: string): AudienceSimulationPersona[] {
  const matches = block.matchAll(/Persona\s*\d+\s*:\s*(.+?)\n([\s\S]*?)(?=\n\s*Persona\s*\d+\s*:|$)/gi);
  const personas: AudienceSimulationPersona[] = [];

  for (const match of matches) {
    const title = (match[1] || '').trim();
    const details = (match[2] || '').trim();
    const detailLines = details.split('\n').map(line => cleanText(line)).filter(Boolean);
    const fallbackDescription = detailLines[0] || '';
    personas.push({
      title: cleanText(title),
      description: parseLabeledLine(details, 'Description') || fallbackDescription,
      likely_reaction: parseLabeledLine(details, 'Likely reaction'),
      influencing_elements: parseLabeledLine(details, 'Influencing elements'),
      relationship_to_goals: parseLabeledLine(details, 'Relationship to goals'),
    });
  }

  return personas.slice(0, 5);
}

function splitTopLevelItems(block: string, limit: number) {
  return block
    .split(/\n(?=\s*(?:\d+\.|[-*]))/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseStrengthItems(block: string): Array<{ title: string; why: string }> {
  const rows = splitTopLevelItems(block, 8);

  const parsed = rows.map(row => {
    const cleaned = cleanText(row);
    const parts = cleaned.split(/\s+-\s+|:\s+/);
    return {
      title: cleanText(parts[0] || cleaned),
      why: cleanText(parts.slice(1).join(': ').trim() || cleaned),
    };
  });

  const dedupedTitles = uniqueByNormalized(parsed.map(item => item.title)).slice(0, 4);
  return dedupedTitles.map(title => parsed.find(item => item.title === title)!).filter(Boolean);
}

function parseWeaknessItems(block: string): Array<{ issue: string; impact: string }> {
  const rows = splitTopLevelItems(block, 8);

  const parsed = rows.map(row => {
    const cleaned = cleanText(row);
    const parts = cleaned.split(/\s+-\s+|:\s+/);
    return {
      issue: cleanText(parts[0] || cleaned),
      impact: cleanText(parts.slice(1).join(': ').trim() || cleaned),
    };
  });

  const dedupedIssues = uniqueByNormalized(parsed.map(item => item.issue)).slice(0, 4);
  return dedupedIssues.map(issue => parsed.find(item => item.issue === issue)!).filter(Boolean);
}

function parseRecommendations(block: string): RecommendationItem[] {
  const rawItems = splitTopLevelItems(block, 8);

  const staged = rawItems.map(raw => {
    const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
    const action = cleanText((lines[0] || '').replace(/^\d+\.\s*/, '').trim());
    const whyLine = lines.find(line => /^-?\s*why\s*:/i.test(line)) || '';
    const exampleLine = lines.find(line => /^-?\s*example\s*:/i.test(line)) || '';
    const fallbackWhy = cleanText(lines[1] || action);

    return {
      action,
      why: cleanText(whyLine.replace(/^-?\s*why\s*:/i, '').trim()) || fallbackWhy,
      example: cleanText(exampleLine.replace(/^-?\s*example\s*:/i, '').trim()) || '',
    };
  });

  const merged: RecommendationItem[] = [];
  for (const item of staged) {
    const actionLower = item.action.toLowerCase();
    const isStandaloneWhy = /^why\s*:/i.test(item.action);
    const isStandaloneExample = /^example\s*:/i.test(item.action);

    if ((isStandaloneWhy || isStandaloneExample) && merged.length > 0) {
      const last = merged[merged.length - 1];
      if (isStandaloneWhy) {
        last.why = cleanText(item.action.replace(/^why\s*:/i, '')) || item.why || last.why;
      }
      if (isStandaloneExample) {
        last.example = cleanText(item.action.replace(/^example\s*:/i, '')) || item.example || last.example;
      }
      continue;
    }

    if (actionLower === 'why' || actionLower === 'example') {
      continue;
    }

    merged.push(item);
  }

  const dedupedActions = uniqueByNormalized(merged.map(item => item.action)).slice(0, 5);
  return dedupedActions.map(action => merged.find(item => item.action === action)!).filter(Boolean);
}

function parseRevisedPostExample(block: string): RevisedPostExample {
  let original = parseLabeledLine(block, 'Original');
  let revised = parseLabeledLine(block, 'Revised');

  if (!original || !revised) {
    const split = block.split(/\n\s*Revised\s*:\s*/i);
    if (split.length > 1) {
      original = original || cleanText(split[0].replace(/^\s*Original\s*:\s*/i, ''));
      revised = revised || split.slice(1).join('\nRevised:').trim();
    }
  }

  return {
    original,
    revised: revised.trim(),
    raw: block,
  };
}

function fallbackTagBlock(rawText: string, title: string): string {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${escaped}[\\s\\S]*?(?=\\n\s*(?:[A-Z][A-Za-z ]{2,40}|<|$))`, 'i');
  return rawText.match(regex)?.[0]?.trim() || '';
}

export function parseSimulationReportV2(rawText: string): SimulationReportV2 {
  const analysis = extractTagBlock(rawText, 'analysis') || fallbackTagBlock(rawText, 'Analysis');
  const audienceSimulation = extractTagBlock(rawText, 'audience_simulation') || fallbackTagBlock(rawText, 'Audience Simulation');
  const engagementPrediction = extractTagBlock(rawText, 'engagement_prediction') || fallbackTagBlock(rawText, 'Engagement Prediction');
  const strengthsBlock = extractTagBlock(rawText, 'strengths') || fallbackTagBlock(rawText, 'Strengths');
  const weaknessesBlock = extractTagBlock(rawText, 'weaknesses') || fallbackTagBlock(rawText, 'Weaknesses');
  const recommendationsBlock = extractTagBlock(rawText, 'recommendations') || fallbackTagBlock(rawText, 'Recommendations');
  const revisedPostExampleBlock = extractTagBlock(rawText, 'revised_post_example') || fallbackTagBlock(rawText, 'Revised Post Example');

  const strengths = parseStrengthItems(strengthsBlock);
  const weaknesses = parseWeaknessItems(weaknessesBlock);
  const recommendations = parseRecommendations(recommendationsBlock);
  const revisedPostExample = parseRevisedPostExample(revisedPostExampleBlock);

  return {
    prompt_version: 'v2',
    analysis,
    audience_simulation: {
      personas: parsePersonaBlocks(audienceSimulation),
      raw: audienceSimulation,
    },
    engagement_prediction: {
      estimated_engagement_rate: parseLabeledLine(engagementPrediction, 'Estimated engagement rate') || '',
      likely_segments: uniqueByNormalized(parseDelimitedList(parseLabeledLine(engagementPrediction, 'Most likely to engage'))),
      potential_reach: parseLabeledLine(engagementPrediction, 'Potential reach') || '',
      key_factors: uniqueByNormalized(parseDelimitedList(parseLabeledLine(engagementPrediction, 'Key factors'))),
      raw: engagementPrediction,
    },
    strengths,
    weaknesses,
    recommendations,
    revised_post_example: revisedPostExample,
    coaching: {
      whats_working_summary: strengths[0]?.title || '',
      whats_working: strengths.map(item => item.title).slice(0, 4),
      whats_losing_them_summary: weaknesses[0]?.issue || '',
      whats_losing_them: weaknesses.map(item => item.issue).slice(0, 4),
      edits_to_add: recommendations.map(item => item.action).slice(0, 5),
      suggested_fix: recommendations[0]?.action || '',
      rewritten_post: revisedPostExample.revised || '',
    },
  };
}
