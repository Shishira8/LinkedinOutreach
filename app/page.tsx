import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold text-[#0A66C2] tracking-tight">ReplyMind</div>
        <nav className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Dashboard
          </Link>
          <Link href="/simulate" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Try Simulator
          </Link>
        </nav>
      </header>

      <main className="w-full max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 max-w-4xl leading-tight">
          See how hiring managers react to your post — <span className="text-[#0A66C2]">before you publish</span>
        </h1>
        
        <p className="mt-8 text-xl text-slate-600 max-w-2xl leading-relaxed">
          Simulate 40 real reactions from hiring managers, peers, and domain experts in 30 seconds. Perfect your LinkedIn strategy without the guesswork.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row gap-4">
          <Link 
            href="/simulate" 
            className="px-8 py-4 bg-[#0A66C2] text-white rounded-full font-semibold text-lg hover:bg-[#004182] transition-colors shadow-lg shadow-blue-500/30"
          >
            Try it free →
          </Link>
          <p className="text-sm text-slate-500 mt-4 sm:mt-0 sm:self-center">No signup required</p>
        </div>

        {/* Mockup Preview */}
        <div className="mt-24 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <div className="ml-4 text-sm font-medium text-slate-500">Simulation Results Preview</div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
            <div className="space-y-4">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Hiring Managers</div>
              <div className="text-4xl font-light text-emerald-600">84<span className="text-lg text-slate-400">/100</span></div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">SJ</div>
                  <div>
                    <div className="text-sm font-bold">Sarah Jenkins</div>
                    <div className="text-xs text-slate-500">Engineering Manager</div>
                  </div>
                </div>
                <p className="text-sm text-slate-700">&quot;Love the focus on impact metrics here. This is exactly what I look for in senior candidates.&quot;</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Peers</div>
              <div className="text-4xl font-light text-emerald-600">92<span className="text-lg text-slate-400">/100</span></div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">AR</div>
                  <div>
                    <div className="text-sm font-bold">Alex Rivera</div>
                    <div className="text-xs text-slate-500">Frontend Engineer</div>
                  </div>
                </div>
                <p className="text-sm text-slate-700">&quot;So relatable! I struggled with the exact same bug last week. Thanks for sharing the solution.&quot;</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Domain Experts</div>
              <div className="text-4xl font-light text-amber-500">65<span className="text-lg text-slate-400">/100</span></div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">AT</div>
                  <div>
                    <div className="text-sm font-bold">Alan Turing</div>
                    <div className="text-xs text-slate-500">Principal Engineer</div>
                  </div>
                </div>
                <p className="text-sm text-slate-700">&quot;Good start, but you missed the underlying performance implications of this approach.&quot;</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
