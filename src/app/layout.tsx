import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kaisen SECURE ADMIN — Vishal SecureScan Administration Platform',
  description: 'Enterprise API-key lifecycle management, user access control, device integrity enforcement, and scan-report administration for Vishal SecureScan.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
