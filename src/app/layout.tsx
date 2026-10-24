import type { Metadata, Viewport } from 'next';
import { Nunito, Press_Start_2P, VT323 } from 'next/font/google';
import { Footer } from '@/components/layout/Footer';
import { Nav } from '@/components/layout/Nav';
import './globals.css';

const display = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-display', display: 'swap' });
const pixel = VT323({ weight: '400', subsets: ['latin'], variable: '--font-pixel', display: 'swap' });
const ui = Nunito({ weight: ['400', '600', '700', '800'], subsets: ['latin'], variable: '--font-ui', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Pokémon Daily Battle',
    template: '%s · Pokémon Daily Battle',
  },
  description: 'Six random Pokémon. Legendary opponents. One chance to become Champion.',
  applicationName: 'Pokémon Daily Battle',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Champions',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: 'Pokémon Daily Battle',
    description: 'Six random Pokémon. Legendary opponents. One chance to become Champion.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1226',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${pixel.variable} ${ui.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-ui">
        <Nav />
        <main id="main" className="flex flex-1 flex-col">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
