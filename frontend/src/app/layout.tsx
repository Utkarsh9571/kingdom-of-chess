import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kingdom of Chess — Live Tournament Platform',
  description: 'Online live chess tournaments and 1-on-1 matches for kids in India',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased font-sans selection:bg-brand-orange/20 selection:text-brand-navy">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
