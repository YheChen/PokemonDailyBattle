'use client';
import { useEffect, useState } from 'react';
import { copyToClipboard } from '@/lib/game/share';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

export interface ShareResultProps {
  text: string;
  className?: string;
}

/** Share text block with a Copy button (Clipboard API with a textarea fallback). */
export function ShareResult({ text, className }: ShareResultProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const id = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  const copy = async () => {
    const ok = await copyToClipboard(text);
    setStatus(ok ? 'copied' : 'failed');
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-wide text-muted">Share your result</span>
        <Button size="sm" variant={status === 'copied' ? 'secondary' : 'primary'} onClick={copy} aria-live="polite">
          {status === 'copied' ? 'Copied!' : status === 'failed' ? 'Copy failed' : 'Copy'}
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-ds border-2 border-border bg-bg/60 p-3 font-ui text-sm leading-relaxed">{text}</pre>
      {status === 'failed' ? <p className="text-xs text-muted">Select the text above and copy it manually.</p> : null}
    </div>
  );
}
