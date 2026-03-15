import Link from 'next/link';
import { ArrowRight, CandlestickChart, Sparkles, Target } from 'lucide-react';
import { defiButtonVariants } from '@/components/ui/defi/button';
import { DefiPanel } from '@/components/ui/defi/panel';
import { DefiBadge } from '@/components/ui/defi/badge';

export default function Home() {
  return (
    <div className="defi-page pb-20">
      <header className="defi-nav">
        <div className="defi-container py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl defi-logo">ReplyMind</Link>
          <nav className="flex items-center gap-5 font-mono text-sm uppercase tracking-wider">
            <Link href="/dashboard" className="defi-link">Dashboard</Link>
            <Link href="/simulate" className="defi-link">Try Simulator</Link>
          </nav>
        </div>
      </header>

      <main className="defi-container pt-16">
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#07080D]/90 p-8 md:p-12">
          <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-30" />
          <div className="relative z-10 max-w-4xl">
            <DefiBadge variant="orange" className="gap-2">
              <Sparkles className="h-3.5 w-3.5" /> AI audience simulator
            </DefiBadge>
            <h1 className="mt-5 text-4xl font-heading font-bold leading-tight md:text-6xl">
              Stress-test your LinkedIn draft before you hit publish.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#94A3B8]">
              ReplyMind simulates audience reactions, highlights what to keep and cut, and rewrites your post for the audience you care about most.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/simulate" className={defiButtonVariants({ size: 'lg' })}>
                Launch simulation <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/dashboard" className={defiButtonVariants({ variant: 'outline', size: 'lg' })}>
                View dashboard
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <DefiPanel variant="surface" padding="md">
            <Target className="h-5 w-5 text-[#F7931A]" />
            <h2 className="mt-3 font-heading text-lg font-semibold">Audience targeting</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">Choose hiring managers, peers, and domain experts to test how each segment responds.</p>
          </DefiPanel>
          <DefiPanel variant="surface" padding="md">
            <CandlestickChart className="h-5 w-5 text-[#F7931A]" />
            <h2 className="mt-3 font-heading text-lg font-semibold">Deterministic scoring</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">Track attention, approval, and conversation with a consistent 100-point engagement score.</p>
          </DefiPanel>
          <DefiPanel variant="surface" padding="md">
            <Sparkles className="h-5 w-5 text-[#F7931A]" />
            <h2 className="mt-3 font-heading text-lg font-semibold">Rewrite-first coaching</h2>
            <p className="mt-2 text-sm text-[#94A3B8]">Get a rewritten post first, then inspect detailed edits only if you want to go deeper.</p>
          </DefiPanel>
        </section>
      </main>
    </div>
  );
}
