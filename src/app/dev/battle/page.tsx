import { notFound } from 'next/navigation';
import { DevBattleBench } from './DevBattleBench';

/** The battle test bench is a development tool: production builds answer 404 here. */
export default function DevBattlePage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DevBattleBench />;
}
