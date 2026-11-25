import type { Metadata } from 'next';
import { VT323, Share_Tech_Mono, IBM_Plex_Mono } from 'next/font/google';
import TerminalShell from '@/components/halcyon/TerminalShell';
import '@/components/halcyon/halcyon.css';

const vt323 = VT323({ weight: '400', subsets: ['latin'], variable: '--font-vt323' });
const shareTech = Share_Tech_Mono({ weight: '400', subsets: ['latin'], variable: '--font-share-tech' });
const plexMono = IBM_Plex_Mono({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'HALCYON-OS · Space Trader',
  description: 'Retro CRT cockpit for SpaceTraders — tmux, sidebar and desktop layouts.',
};

// The terminal lives in the layout so switching between the three layout
// routes keeps the session (and simulator state) alive.
export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${vt323.variable} ${shareTech.variable} ${plexMono.variable}`}>
      <TerminalShell />
      {children}
    </div>
  );
}
