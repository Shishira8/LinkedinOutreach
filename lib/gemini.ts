import { type AudienceProfile } from '@/lib/linkedin-analytics';
import {
  parseSimulationReportV2,
  type AggregateAudiencePayload,
  type UserBrandProfile,
} from '@/lib/simulation-v2';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';

async function callGemini(prompt: string, responseJson = true): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const body: any = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 65536,
    },
  };

  if (responseJson) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 503 || response.status === 429) {
      console.warn(`Gemini ${response.status}, retrying (attempt ${attempt + 1}/3)...`);
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      lastError = new Error(`Gemini API error: ${response.status}`);
      continue;
    }

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join('') || '';
    return text;
  }

  throw lastError || new Error('Max retries reached');
}

function normalizeTextForCompare(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRewriteMissingOrUnchanged(original: string, rewrite: unknown) {
  if (typeof rewrite !== 'string' || !rewrite.trim()) {
    return true;
  }

  const normalizedOriginal = normalizeTextForCompare(original);
  const normalizedRewrite = normalizeTextForCompare(rewrite);

  return normalizedOriginal === normalizedRewrite;
}

function audienceRewriteDirection(audience: string) {
  if (audience === 'hiring_managers') {
    return 'Emphasize business outcomes, team leverage, leadership judgment, and practical execution clarity.';
  }

  if (audience === 'domain_experts') {
    return 'Emphasize technical nuance, trade-offs, edge cases, and non-obvious insights for experienced practitioners.';
  }

  return 'Emphasize relatable practical tactics, concrete examples, and immediately usable advice for peers.';
}

function isTooSimilarToExisting(candidate: string, existing: string[]) {
  const normalizedCandidate = normalizeTextForCompare(candidate);
  return existing.some(item => normalizeTextForCompare(item) === normalizedCandidate);
}

function buildTargetAudiencePayload(
  audience: string,
  audienceProfile: AudienceProfile | null,
  personas: any[],
  reactions: any[],
) {
  return {
    audience,
    audience_profile: audienceProfile,
    simulated_personas: personas,
    simulated_reactions: reactions,
  };
}

function buildUserProfilePayload(userProfile: UserBrandProfile | null) {
  if (!userProfile) {
    return {
      status: 'missing',
      note: 'No saved user profile found. Use post draft + audience context only.',
    };
  }

  return {
    full_name: userProfile.full_name || '',
    current_role: userProfile.current_role || userProfile.current_job_role || '',
    target_roles: userProfile.target_roles || [],
    target_industries: userProfile.target_industries || [],
    years_experience: userProfile.years_experience ?? null,
    expertise_areas: userProfile.expertise_areas || [],
    personal_brand_keywords: userProfile.personal_brand_keywords || [],
    writing_tone: userProfile.writing_tone || '',
    career_goals: userProfile.career_goals || '',
    call_to_action_preference: userProfile.call_to_action_preference || '',
  };
}

async function generateAudienceRewrite(
  audience: string,
  postText: string,
  audienceAnalysis: any,
  existingRewrites: string[] = [],
) {
  const direction = audienceRewriteDirection(audience);
  const priorRewriteHint = existingRewrites.length > 0
    ? `Avoid writing a near-duplicate of these existing rewrites:\n${existingRewrites.map((item, index) => `${index + 1}. ${item}`).join('\n')}`
    : '';

  const prompt = `
You are a LinkedIn writing coach.

Audience: ${audience}
Original post:
"""
${postText}
"""

Audience analysis:
${JSON.stringify(audienceAnalysis || {}, null, 2)}

Task:
- Rewrite the post for this audience.
- Keep the same core idea, but improve hook, specificity, and practical value.
- Make it clearly different from the original wording.
- Make the angle distinct for this audience: ${direction}
- Keep the final length between 80% and 130% of original length.
- Return plain text only. No JSON. No code fences.
${priorRewriteHint}
`;

  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const rewritten = await callGemini(prompt, false);
      const cleaned = rewritten.trim().replace(/^"|"$/g, '');

      if (!cleaned || isRewriteMissingOrUnchanged(postText, cleaned)) {
        continue;
      }

      if (isTooSimilarToExisting(cleaned, existingRewrites)) {
        continue;
      }

      return cleaned;
    }

    return postText;
  } catch {
    return postText;
  }
}

export async function generateReaction(persona: any, postText: string, platform: string) {
  const prompt = `
You are simulating a LinkedIn user reading a post.
Here is your persona:
${JSON.stringify(persona, null, 2)}

Here is the post you are reading on ${platform}:
"${postText}"

React authentically based on your persona. If the persona includes LinkedIn audience personalization fields, treat those as strong context about what this user's real audience tends to care about.
Return a JSON object with:
- action: "like", "comment", or "scroll_past"
- comment: The text of your comment (if action is "comment", otherwise empty string)
- tone: "positive", "neutral", "skeptical", or "negative"
- almost_changed_mind_because: A brief thought on what almost made you do something else.
`;

  try {
    const text = await callGemini(prompt);
    return JSON.parse(text);
  } catch (e) {
    console.error("Error in generateReaction", e);
    return { action: "scroll_past", comment: "", tone: "neutral", almost_changed_mind_because: "Failed to parse" };
  }
}

export async function aggregateReactions(reactionsByAudience: any, postText: string) {
  const prompt = `
You are an expert career coach and LinkedIn strategist.
Analyze these simulated reactions to a user's LinkedIn post.

Post:
"${postText}"

Reactions by audience:
${JSON.stringify(reactionsByAudience, null, 2)}

For each audience group present in the reactions, provide an aggregate analysis.
Return a JSON object where keys are the audience group names (e.g., "hiring_managers", "peers", "domain_experts") and values are objects with:
- engagement_score: 0-100
- would_stop_scrolling_pct: percentage (0-100)
- would_like_pct: percentage (0-100)
- would_comment_pct: percentage (0-100)
- top_themes: array of 2-3 strings
- dangerous_reply: A specific comment that could hurt the user's reputation (if any, otherwise empty)
- coaching: object with:
  - whats_working_summary: one short sentence under 22 words
  - whats_working: array of 2-3 short bullets, each under 14 words
  - whats_losing_them_summary: one short sentence under 22 words
  - whats_losing_them: array of 2-3 short bullets, each under 14 words
  - edits_to_add: array of 3-5 concrete changes the user can directly add to the draft, each starting with an action verb like "Add", "Quantify", "Name", "Show", "End with"
  - suggested_fix: one sentence under 24 words summarizing the highest-leverage revision
  - rewritten_post: one polished rewrite of the original post that already applies the suggested edits

Rules:
- Be specific to the actual post content. Refer to details that are already in the draft.
- Do not give generic advice like "be more engaging" or "add more detail".
- Every edit must describe something concrete the user can insert, sharpen, quantify, or cut.
- Prefer short, skimmable phrases over paragraphs.
- For rewritten_post, keep the voice authentic to the original but strengthen the opening hook and specificity.
- For rewritten_post, target roughly 80-130% of the original post length and keep it LinkedIn-ready.
`;

  try {
    const text = await callGemini(prompt);
    const parsed = JSON.parse(text);

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const acceptedRewrites: string[] = [];

    for (const audience of Object.keys(parsed)) {
      if (!parsed[audience] || typeof parsed[audience] !== 'object') {
        continue;
      }

      const coaching = parsed[audience].coaching;
      if (!coaching || typeof coaching !== 'object') {
        parsed[audience].coaching = {};
      }

      const currentRewrite = parsed[audience].coaching.rewritten_post;
      let finalRewrite = typeof currentRewrite === 'string' ? currentRewrite.trim() : '';

      const needsRegeneration =
        isRewriteMissingOrUnchanged(postText, finalRewrite) ||
        isTooSimilarToExisting(finalRewrite, acceptedRewrites);

      if (needsRegeneration) {
        finalRewrite = await generateAudienceRewrite(audience, postText, parsed[audience], acceptedRewrites);
      }

      parsed[audience].coaching.rewritten_post = finalRewrite || postText;
      acceptedRewrites.push(parsed[audience].coaching.rewritten_post);
    }

    return parsed;
  } catch (e) {
    console.error("Error in aggregateReactions", e);
    return {};
  }
}

export async function aggregateReactionsV2(
  reactionsByAudience: Record<string, any[]>,
  postText: string,
  options: {
    audienceProfile: AudienceProfile | null;
    userProfile: UserBrandProfile | null;
    personasByAudience: Record<string, any[]>;
  },
): Promise<Record<string, AggregateAudiencePayload>> {
  const audiences = Object.keys(reactionsByAudience || {});
  const result: Record<string, AggregateAudiencePayload> = {};

  await Promise.all(audiences.map(async audience => {
    const targetAudience = buildTargetAudiencePayload(
      audience,
      options.audienceProfile,
      options.personasByAudience[audience] || [],
      reactionsByAudience[audience] || [],
    );
    const userProfilePayload = buildUserProfilePayload(options.userProfile);

    const prompt = `
You are an AI-powered audience simulation system designed to help job seekers improve their personal branding on LinkedIn. Your task is to simulate how a specific target audience would react to a LinkedIn post draft and provide actionable feedback to improve engagement and brand positioning.

First, review information about the target LinkedIn audience. This may include LinkedIn audience analytics data such as demographics, age ranges, job titles, industries, and engagement patterns from previous posts:

<target_audience>
${JSON.stringify(targetAudience, null, 2)}
</target_audience>

Next, review the job seeker's profile information:

<user_profile>
${JSON.stringify(userProfilePayload, null, 2)}
</user_profile>

Here is the LinkedIn post draft you need to evaluate:

<post_draft>
${postText}
</post_draft>

Your task is to simulate how the target audience would respond to this post and provide comprehensive feedback.

Before providing your structured feedback, wrap your detailed analysis inside <analysis> tags. In your analysis:

1. Extract and list out specific demographic and professional data points from the target audience information. Write out each distinct data point (age ranges, job titles, industries, seniority levels, geographic locations, etc.). If LinkedIn analytics data is provided, enumerate the key segments present in the data with their percentages or frequencies. It's OK for this section to be quite long.

2. For each major audience segment identified, write out their key characteristics, pain points, and interests.

3. List out the specific post elements present in the draft (e.g., opening hook, story structure, value propositions, call-to-action, tone indicators, etc.).

4. Evaluate how the post aligns with the user's personal brand and career goals based on their profile.

5. For each post element, assess which audience segments it would resonate with and which might find it ineffective or off-putting. Be specific.

6. Compare the post against best practices for effective LinkedIn content (storytelling, value proposition, authenticity, call-to-action, professional tone, etc.), noting which practices are present and which are missing.

7. Plan out 3-5 specific personas that represent distinct segments within the target audience. For each planned persona, write down:
   - The specific data points from the audience information that inform this persona
   - Their likely professional motivations and pain points
   - How they might react to this specific post

After your analysis, structure your response with the following sections:

<audience_simulation>
Create 3-5 different personas from the target audience and predict their likely reactions. Each persona should be directly derived from the demographic and professional data in the target audience information. For each persona, include:
- A persona description including their role, seniority level, industry, and key motivations (reference specific data from the audience information)
- Their likely reaction (Would they engage? Scroll past? React negatively?)
- Specific elements of the post that would influence their reaction
- How this persona relates to the job seeker's goals
</audience_simulation>

<engagement_prediction>
Predict the likely engagement metrics:
- Estimated engagement rate range (e.g., views, likes, comments, shares)
- Which audience segments are most likely to engage (be specific about job titles, roles, or demographics)
- Potential reach beyond immediate network
- Factors that would increase or decrease engagement
</engagement_prediction>

<strengths>
List 2-4 specific strengths of the post that work well for the target audience and personal branding goals. For each strength, explain why it's effective for the specific audience.
</strengths>

<weaknesses>
List 2-4 specific weaknesses or missed opportunities in the post. For each weakness, explain how it impacts different audience segments.
</weaknesses>

<recommendations>
Provide 3-5 concrete, actionable recommendations to improve the post. Each recommendation must:
- Address a specific issue or opportunity identified in your analysis
- Explain WHY it would improve reception among the target audience (reference specific audience segments when relevant)
- Provide a specific example or suggestion for implementation
</recommendations>

<revised_post_example>
Provide a brief example showing how the opening paragraph or a key section could be revised based on your top recommendation. Show both the original excerpt and the revised version.
</revised_post_example>

Important output rules:
- Return plain text only.
- Include all tags exactly once: <analysis>, <audience_simulation>, <engagement_prediction>, <strengths>, <weaknesses>, <recommendations>, <revised_post_example>.
- Do not output JSON.
`;

    try {
      const text = await callGemini(prompt, false);
      const parsed = parseSimulationReportV2(text);
      if (!parsed.coaching?.rewritten_post?.trim()) {
        parsed.coaching = {
          ...(parsed.coaching || {}),
          rewritten_post: await generateAudienceRewrite(audience, postText, parsed),
        };
      }

      if (!parsed.engagement_prediction.estimated_engagement_rate && parsed.engagement_prediction.raw) {
        parsed.engagement_prediction.estimated_engagement_rate = 'Estimated from qualitative audience fit';
      }

      result[audience] = parsed;
    } catch (error) {
      console.error('Error in aggregateReactionsV2 for audience', audience, error);
      result[audience] = {
        prompt_version: 'v2',
        analysis: '',
        audience_simulation: {
          personas: [],
          raw: '',
        },
        engagement_prediction: {
          estimated_engagement_rate: '',
          likely_segments: [],
          potential_reach: '',
          key_factors: [],
          raw: '',
        },
        strengths: [],
        weaknesses: [],
        recommendations: [],
        revised_post_example: {
          original: '',
          revised: postText,
          raw: '',
        },
        coaching: {
          rewritten_post: postText,
        },
      };
    }
  }));

  return result;
}
