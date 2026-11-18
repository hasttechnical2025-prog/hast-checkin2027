import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Chấm Công HSTC',
  description: 'Hệ thống chấm công Công ty CP Siêu Thanh Hà Nội',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1e3a8a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={`${inter.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
