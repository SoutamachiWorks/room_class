import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/lib/theme';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata = {
  manifest: '/manifest.webmanifest',
  title: 'Classroom — Sistem Manajemen Kelas',
  description: 'Platform manajemen kelas digital untuk guru dan siswa. Kelola tugas, materi, dan ujian dalam satu tempat.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Classroom',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
