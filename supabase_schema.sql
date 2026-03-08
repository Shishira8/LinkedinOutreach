-- Supabase Schema for ReplyMind

-- 1. users table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  simulations_remaining INTEGER DEFAULT 3
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own data
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid()::text = clerk_user_id);

-- 2. simulations table
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  clerk_user_id TEXT, -- For anonymous or unlinked users initially
  post_text TEXT NOT NULL,
  platform TEXT DEFAULT 'linkedin',
  selected_audiences TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' -- pending, complete, error
);

-- Enable RLS
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;

-- Users can view their own simulations
CREATE POLICY "Users can view own simulations" ON public.simulations
  FOR SELECT USING (clerk_user_id = auth.uid()::text OR clerk_user_id IS NULL);

-- 3. simulation_results table
CREATE TABLE public.simulation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_id UUID REFERENCES public.simulations(id) ON DELETE CASCADE,
  personas_json JSONB NOT NULL,
  reactions_json JSONB NOT NULL,
  aggregate_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;

-- Users can view results for their simulations
CREATE POLICY "Users can view own simulation results" ON public.simulation_results
  FOR SELECT USING (
    simulation_id IN (
      SELECT id FROM public.simulations WHERE clerk_user_id = auth.uid()::text OR clerk_user_id IS NULL
    )
  );

-- 4. anonymous usage quotas table
CREATE TABLE public.anonymous_usage_quotas (
  identity_hash TEXT PRIMARY KEY,
  usage_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. LinkedIn audience imports table
CREATE TABLE public.linkedin_audience_imports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  row_count INTEGER DEFAULT 0,
  raw_columns TEXT[] NOT NULL DEFAULT '{}',
  audience_profile_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.linkedin_audience_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own LinkedIn audience imports" ON public.linkedin_audience_imports
  FOR SELECT USING (clerk_user_id = auth.uid()::text);


-- 6. cached persona packs per imported LinkedIn audience profile
CREATE TABLE public.user_persona_packs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  linkedin_import_id UUID NOT NULL REFERENCES public.linkedin_audience_imports(id) ON DELETE CASCADE,
  persona_pack_json JSONB NOT NULL,
  source TEXT DEFAULT 'linkedin_import',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clerk_user_id, linkedin_import_id)
);

ALTER TABLE public.user_persona_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own persona packs" ON public.user_persona_packs
  FOR SELECT USING (clerk_user_id = auth.uid()::text);

-- Indexes for performance
CREATE INDEX idx_users_clerk_id ON public.users(clerk_user_id);
CREATE INDEX idx_simulations_user_id ON public.simulations(user_id);
CREATE INDEX idx_simulations_clerk_id ON public.simulations(clerk_user_id);
CREATE INDEX idx_simulation_results_sim_id ON public.simulation_results(simulation_id);
CREATE INDEX idx_anonymous_usage_window_started_at ON public.anonymous_usage_quotas(window_started_at);
CREATE INDEX idx_linkedin_audience_imports_clerk_id ON public.linkedin_audience_imports(clerk_user_id);
CREATE INDEX idx_linkedin_audience_imports_created_at ON public.linkedin_audience_imports(created_at);
CREATE INDEX idx_user_persona_packs_lookup ON public.user_persona_packs(clerk_user_id, linkedin_import_id);
