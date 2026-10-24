import type { Metadata } from 'next';
import { Shell } from '@/components/layout/Shell';
import { Heading } from '@/components/ui/Heading';
import { SettingsForm } from '@/components/settings/SettingsForm';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Player name, battle speed, AI difficulty, default team generation and display options for Pokémon Champions.',
};

export default function SettingsPage() {
  return (
    <Shell className="space-y-8">
      <Heading level={1} kicker="Preferences" size="lg">
        Settings
      </Heading>
      <p className="max-w-2xl text-muted">Changes save instantly to this browser. Nothing is uploaded anywhere.</p>
      <SettingsForm />
    </Shell>
  );
}
