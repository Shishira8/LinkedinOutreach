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
