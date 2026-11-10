import '@fontsource-variable/source-sans-3';
import type { Metadata, Viewport } from 'next';
import { SITE } from '@/lib/links';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: SITE ? new URL(SITE) : undefined,
  title: { default: 'FindHouseQuick: homes to rent from identity-checked landlords and agents', template: '%s | FindHouseQuick' },
  description: 'Houses, flats, shops and short lets to rent, from landlords and agents whose identity we have checked. Inspections are always free.',
  openGraph: { siteName: 'FindHouseQuick', type: 'website' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0b6b3a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
