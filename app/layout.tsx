import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Te Matemata',
  description: 'Voice-driven critical thinking + engineering training. Think out loud, learn deeply, reflect daily.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
