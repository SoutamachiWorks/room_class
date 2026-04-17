import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'RoomClass — Sistem Manajemen Kelas',
  description:
    'Platform manajemen kelas digital untuk guru dan siswa. Kelola tugas, materi, dan ujian dalam satu tempat.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
