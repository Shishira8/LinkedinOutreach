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

Rules:
- Be specific to the actual post content. Refer to details that are already in the draft.
- Do not give generic advice like "be more engaging" or "add more detail".
- Every edit must describe something concrete the user can insert, sharpen, quantify, or cut.
- Prefer short, skimmable phrases over paragraphs.
`;

  try {
    const text = await callGemini(prompt);
    return JSON.parse(text);
  } catch (e) {
    console.error("Error in aggregateReactions", e);
    return {};
  }
}
