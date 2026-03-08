import fs from 'fs';
import path from 'path';
import { type AudienceProfile } from '@/lib/linkedin-analytics';

export type Persona = {
  id: string;
  name: string;
  age: number;
  role: string;
  [key: string]: any;
};

const topLabels = (entries: Array<{ label: string }> = []) => entries.map(entry => entry.label.toLowerCase());

const scorePersonaMatch = (persona: Persona, profile: AudienceProfile) => {
  const haystack = JSON.stringify(persona).toLowerCase();
  let score = 0;

  for (const label of topLabels(profile.top_industries)) {
    if (haystack.includes(label)) score += 4;
  }

  for (const label of topLabels(profile.top_job_functions)) {
    if (haystack.includes(label)) score += 3;
  }

  for (const label of topLabels(profile.top_seniority)) {
    if (haystack.includes(label)) score += 2;
  }

  for (const label of profile.audience_biases || []) {
    if (haystack.includes(label.toLowerCase())) score += 3;
  }

  return score;
};

const personalizePersona = (persona: Persona, profile: AudienceProfile) => {
  const audienceMatchScore = scorePersonaMatch(persona, profile);
  const topIndustry = profile.top_industries[0]?.label || 'professional';
  const topFunction = profile.top_job_functions[0]?.label || 'cross-functional';
  const topSeniority = profile.top_seniority[0]?.label || 'mixed-seniority';

  return {
    ...persona,
    personalized_for_user_audience: true,
    audience_match_score: audienceMatchScore,
    audience_profile_summary: profile.summary,
    audience_biases: profile.audience_biases,
    audience_segment_hint: `${topSeniority} ${topFunction} audience in ${topIndustry}`,
    personalization_reason: `Adapted to reflect a LinkedIn audience skewing ${topFunction.toLowerCase()} in ${topIndustry.toLowerCase()} with ${topSeniority.toLowerCase()} seniority.`,
  };
};

export const getPersonas = (
  audienceTypes: string[],
  count: number = 5,
  audienceProfile?: AudienceProfile | null,
): Record<string, Persona[]> => {
  const result: Record<string, Persona[]> = {};
  
  const loadFile = (filename: string) => {
    try {
      const filePath = path.join(process.cwd(), 'data', filename);
      const fileContents = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContents);
    } catch (e) {
      console.error(`Error loading ${filename}`, e);
      return [];
    }
  };

  if (audienceTypes.includes('hiring_managers')) {
    const all = loadFile('hiring_manager_personas.json');
    result['hiring_managers'] = all
      .map((persona: Persona) => audienceProfile ? personalizePersona(persona, audienceProfile) : persona)
      .sort((left: Persona, right: Persona) => (right.audience_match_score || 0) - (left.audience_match_score || 0))
      .slice(0, count);
  }
  
  if (audienceTypes.includes('peers')) {
    const all = loadFile('peer_personas.json');
    result['peers'] = all
      .map((persona: Persona) => audienceProfile ? personalizePersona(persona, audienceProfile) : persona)
      .sort((left: Persona, right: Persona) => (right.audience_match_score || 0) - (left.audience_match_score || 0))
      .slice(0, count);
  }
  
  if (audienceTypes.includes('domain_experts')) {
    const all = loadFile('domain_expert_personas.json');
    result['domain_experts'] = all
      .map((persona: Persona) => audienceProfile ? personalizePersona(persona, audienceProfile) : persona)
      .sort((left: Persona, right: Persona) => (right.audience_match_score || 0) - (left.audience_match_score || 0))
      .slice(0, count);
  }
  
  return result;
};
