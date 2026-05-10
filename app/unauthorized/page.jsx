import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Akses Ditolak</h1>
      <p>Anda tidak memiliki izin untuk membuka halaman ini.</p>
      <Link href="/login">Kembali ke Login</Link>
    </main>
  );
}
