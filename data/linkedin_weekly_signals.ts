export type WeeklyLinkedInTopic = {
  name: string;
  momentum: 'rising' | 'surging' | 'steady';
  why_it_is_hot: string;
  angle_to_try: string;
};

export type WeeklyReachTip = {
  title: string;
  guidance: string;
  why_it_helps: string;
};

export type WeeklyLinkedInSignals = {
  week_label: string;
  editor_note: string;
  topics: WeeklyLinkedInTopic[];
  reach_tips: WeeklyReachTip[];
};

export const weeklyLinkedInSignals: WeeklyLinkedInSignals = {
  week_label: 'March 3 to March 9, 2026',
  editor_note: 'Curated market-wide LinkedIn signals. These themes and tips are generic platform guidance, not personalized account analytics.',
  topics: [
    {
      name: 'AI workflow receipts',
      momentum: 'surging',
      why_it_is_hot: 'Specific examples of how people actually use AI at work are outperforming broad AI opinions.',
      angle_to_try: 'Show one workflow you replaced, what changed, and the exact tradeoff you accepted.',
    },
    {
      name: 'Build-in-public career storytelling',
      momentum: 'rising',
      why_it_is_hot: 'Posts that combine personal progress with concrete lessons are attracting comments without sounding self-promotional.',
      angle_to_try: 'Turn a project update into a before/after lesson with one sharp takeaway for peers.',
    },
    {
      name: 'Operational lessons from small teams',
      momentum: 'rising',
      why_it_is_hot: 'Lean execution stories are landing well because they feel useful, practical, and credible.',
      angle_to_try: 'Name one constraint, one decision you made, and one thing you would do differently next time.',
    },
    {
      name: 'Opinionated how-to posts',
      momentum: 'steady',
      why_it_is_hot: 'Readers keep rewarding posts that teach something while taking a clear stance.',
      angle_to_try: 'Lead with a contrarian line, then back it up with one concrete example from your work.',
    },
  ],
  reach_tips: [
    {
      title: 'Post when people can reply, not just scroll',
      guidance: 'Generic LinkedIn best practice: prioritize weekday morning or lunch-adjacent slots in your main audience timezone.',
      why_it_helps: 'Early comments and reactions matter more when your target readers are available to engage right away.',
    },
    {
      title: 'Make the first two lines carry the post',
      guidance: 'Write the opening so it works before the reader taps “see more.” Use one claim, one surprise, or one result.',
      why_it_helps: 'Weak openings cost distribution because they lose attention before the rest of the post has a chance to work.',
    },
    {
      title: 'Give the reader a reason to respond',
      guidance: 'End with a specific prompt like a tradeoff, a choice, or a question practitioners can answer quickly.',
      why_it_helps: 'Comments tend to rise when the ask is easy to answer and connected to real experience.',
    },
    {
      title: 'Choose one clear post job',
      guidance: 'Do not mix hiring signal, tutorial, career reflection, and product update in the same post unless one is clearly dominant.',
      why_it_helps: 'Focused posts are easier to understand and perform better than posts that try to accomplish four goals at once.',
    },
  ],
};