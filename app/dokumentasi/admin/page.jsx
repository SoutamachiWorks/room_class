import Image from 'next/image';
import Link from 'next/link';
import styles from '../dokumentasi.module.css';
import { adminScreenshots } from '../adminScreenshots';

const adminGuides = [
  {
    title: 'Login dan dashboard utama',
    steps: [
      'Buka halaman login, lalu masuk menggunakan akun admin.',
      'Pastikan ringkasan jumlah siswa, guru, kelas aktif, dan storage tampil di dashboard.',
      'Gunakan dashboard sebagai pusat kontrol sebelum guru dan siswa mulai uji coba.',
    ],
  },
  {
    title: 'Kode kelas dan tahun ajaran',
    steps: [
      'Buka menu Kode Kelas untuk menambah atau mengecek kelas yang tersedia.',
      'Tambahkan kode kelas sesuai kelas yang dipakai saat uji coba.',
      'Buka menu Tahun Ajaran dan pastikan tahun ajaran aktif sudah benar.',
    ],
  },
  {
    title: 'Data pengguna',
    steps: [
      'Buka menu Semua Pengguna untuk menambah akun guru dan siswa.',
      'Isi data akun, pilih role yang sesuai, lalu simpan.',
      'Gunakan reset password jika akun peserta uji coba tidak bisa masuk.',
    ],
  },
  {
    title: 'Mata pelajaran',
    steps: [
      'Buka menu Mata Pelajaran untuk melihat daftar mapel.',
      'Tambahkan mata pelajaran yang akan dipakai guru untuk materi, tugas, dan ujian.',
      'Pastikan nama mapel dan kelas sudah sesuai agar integrasi di role guru tidak salah arah.',
    ],
  },
];

const adminScenario = [
  'Admin login ke aplikasi Classroom.',
  'Admin mengecek dashboard utama sebagai verifikasi awal data sistem.',
  'Admin membuat atau mengecek kode kelas yang akan digunakan.',
  'Admin memastikan tahun ajaran aktif sudah sesuai.',
  'Admin menambahkan akun guru dan siswa untuk uji coba.',
  'Admin menambahkan mata pelajaran yang akan digunakan pada materi, tugas, dan ujian.',
];

function GuideCards() {
  return (
    <section className={styles.roleSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.adminTone}`}>Panduan Admin</span>
        <h2>Cara pemakaian dashboard admin</h2>
        <p>Admin menyiapkan data dasar agar guru dan siswa bisa langsung mencoba alur utama Classroom.</p>
      </div>
      <div className={styles.guideGrid}>
        {adminGuides.map((guide) => (
          <article key={guide.title} className={styles.guideCard}>
            <h3>{guide.title}</h3>
            <ol>
              {guide.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminScenario() {
  return (
    <section className={styles.flowSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.flowTone}`}>Alur Uji Coba Admin</span>
        <h2>Urutan pengujian role admin</h2>
        <p>Alur ini dipakai untuk menyiapkan data sebelum guru dan siswa mulai menguji fitur inti.</p>
      </div>
      <div className={styles.timeline}>
        {adminScenario.map((item, index) => (
          <div key={item} className={styles.timelineItem}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AdminDocumentationPage() {
  return (
    <main className={styles.roleDocShell}>
      <header className={styles.roleDocHeader}>
        <Link href="/dokumentasi" className={styles.backLink}>Kembali ke Dokumentasi</Link>
        <span className={`${styles.eyebrow} ${styles.adminTone}`}>Dokumentasi Admin</span>
        <h1>Alur admin dari login sampai mata pelajaran</h1>
        <p>
          Panduan ini menampilkan screenshot berukuran besar agar detail tombol, form, dan menu admin
          terlihat jelas saat dipakai untuk uji coba atau laporan.
        </p>
      </header>

      <GuideCards />
      <AdminScenario />

      <section className={styles.roleDocTimeline}>
        {adminScreenshots.map((item, index) => (
          <article key={item.image} className={styles.roleDocStep}>
            <div className={styles.roleDocStepText}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </div>
            <div className={styles.roleDocImageFrame}>
              <Image
                src={item.image}
                alt={`Screenshot ${item.title} pada alur admin Classroom`}
                width={item.width}
                height={item.height}
                sizes="(max-width: 1100px) 100vw, 1120px"
                priority={index < 2}
              />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
