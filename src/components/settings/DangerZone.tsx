'use client';
import { useState } from 'react';
import { clearAllData } from '@/lib/storage';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

/** "Clear all data" with a confirmation modal: removes every `pc:` localStorage key. */
export function DangerZone() {
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);

  const confirm = () => {
    clearAllData();
    setOpen(false);
    setCleared(true);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Removes your statistics, settings, daily records, Boss Rush progress and any in-progress battle from this browser.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="danger" onClick={() => setOpen(true)}>
          Clear all data
        </Button>
        {cleared ? (
          <span className="text-xs font-extrabold text-green" role="status">
            All data cleared.
          </span>
        ) : null}
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Clear all data?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirm}>
              Clear everything
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Everything Pokémon Champions stored in this browser will be deleted: statistics, settings, daily results, Boss
          Rush runs and saved battles. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
