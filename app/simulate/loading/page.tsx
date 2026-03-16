'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { DefiPanel } from '@/components/ui/defi/panel';
import { defiButtonVariants } from '@/components/ui/defi/button';

export default function LoadingPage() {
  const [steps, setSteps] = useState([
    { id: 1, text: 'Generating your audience personas...', status: 'pending' },
    { id: 2, text: 'Simulating hiring manager reactions...', status: 'pending' },
    { id: 3, text: 'Rewriting your post for each audience...', status: 'pending' },
    { id: 4, text: 'Finalizing your coaching report...', status: 'pending' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const dataStr = sessionStorage.getItem('simulationData');
    if (!dataStr) {
      router.push('/simulate');
      return;
    }

    const startSimulation = async () => {
      try {
        const response = await fetch('/api/simulate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: dataStr,
        });

        if (!response.ok) {
          let message = 'Failed to start simulation';

          try {
            const errorData = await response.json();
            if (errorData?.error) {
              message = errorData.error;
            }
          } catch {
            // Ignore JSON parsing issues and use the default message.
          }

          if (response.status === 401) {
            router.push('/sign-in?redirect_url=/simulate');
            return;
          }

          throw new Error(message);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No reader available');

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          let eventEndIndex;
          while ((eventEndIndex = buffer.indexOf('\n\n')) !== -1) {
            const eventString = buffer.slice(0, eventEndIndex);
            buffer = buffer.slice(eventEndIndex + 2);
            
            const lines = eventString.split('\n');
            let eventType = '';
            let dataStr = '';
            
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.substring(7);
              } else if (line.startsWith('data: ')) {
                dataStr = line.substring(6);
              }
            }
            
            if (eventType && dataStr) {
              try {
                const data = JSON.parse(dataStr);
                
                if (eventType === 'progress') {
                  setSteps(prev => prev.map(s => {
                    if (s.id < data.step) return { ...s, status: 'complete' };
                    if (s.id === data.step) return { ...s, status: 'in_progress', text: data.message };
                    return s;
                  }));
                } else if (eventType === 'complete') {
                  setSteps(prev => prev.map(s => ({ ...s, status: 'complete' })));
                  // Store results in sessionStorage so the results page can use them
                  // even if Supabase inserts failed
                  sessionStorage.setItem(`simulation_results_${data.id}`, JSON.stringify(data));
                  setTimeout(() => {
                    router.push(`/results/${data.id}`);
                  }, 1000);
                } else if (eventType === 'error') {
                  setError(data.message);
                }
              } catch (e) {
                console.error("Failed to parse SSE data", e);
              }
            }
          }
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An error occurred');
      }
    };

    startSimulation();
  }, [router]);

  return (
    <div className="defi-page flex flex-col items-center justify-center px-4">
      <DefiPanel className="w-full max-w-md" variant="surface" padding="lg">
        <h2 className="text-2xl font-heading font-bold text-white mb-6 text-center">Simulating Reactions</h2>
        
        {error ? (
          <div className="p-4 bg-red-500/10 text-red-300 rounded-xl border border-red-400/40 text-center">
            {error}
            <button 
              onClick={() => router.push('/simulate')}
              className={`${defiButtonVariants({ variant: 'outline', size: 'sm' })} mt-4`}
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-4">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">
                  {step.status === 'complete' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
                  {step.status === 'in_progress' && <Loader2 className="w-5 h-5 text-[#F7931A] animate-spin" />}
                  {step.status === 'pending' && <div className="w-3 h-3 rounded-full bg-white/20" />}
                </div>
                <span className={`text-sm font-medium transition-colors ${
                  step.status === 'complete' ? 'text-[#94A3B8]' :
                  step.status === 'in_progress' ? 'text-white' : 'text-[#64748B]'
                }`}>
                  {step.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {!error && (
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-[#94A3B8] font-medium uppercase tracking-wider">Estimated time: ~30 seconds</p>
          </div>
        )}
      </DefiPanel>
    </div>
  );
}
