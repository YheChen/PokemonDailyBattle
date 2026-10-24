'use client';
import { useState } from 'react';
import { resetStats } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/** "Reset statistics" with a confirmation modal. Only clears `pc:stats`; settings and daily records stay. */
export function ResetStatsButton({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const confirm = () => {
    resetStats();
    setOpen(false);
  };
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)} disabled={disabled}>
        Reset statistics
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset statistics?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep them
            </Button>
            <Button variant="danger" onClick={confirm}>
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This erases your battle totals, streaks, trainers defeated, best Boss Rush and the whole battle history. Your
          settings are kept. This cannot be undone.
        </p>
      </Modal>
    </>
  );
}
