'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import type { Layout } from './HalcyonTerminal';

// Client-only: the engine reads window size, localStorage and the clock on mount.
const HalcyonTerminal = dynamic(() => import('./HalcyonTerminal'), { ssr: false });

export default function TerminalShell() {
  const path = usePathname();
  const layout: Layout = path.endsWith('/desktop') ? 'desktop' : path.endsWith('/sidebar') ? 'sidebar' : 'tmux';
  return <HalcyonTerminal layout={layout} />;
}
