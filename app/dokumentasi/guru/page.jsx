import Image from 'next/image';
import Link from 'next/link';
import styles from '../dokumentasi.module.css';
import { guruScreenshots } from '../guruScreenshots';

const teacherGuides = [
  {
    title: 'Login dan dashboard',
    steps: [
      'Masuk menggunakan akun guru yang sudah dibuat admin.',
      'Cek ringkasan dashboard seperti jadwal, tugas aktif, ujian aktif, dan aktivitas siswa.',
      'Gunakan menu samping untuk masuk ke fitur materi, tugas, dan ujian.',
    ],
  },
  {
    title: 'Materi pelajaran',
    steps: [
      'Buka menu Materi Pelajaran.',
      'Tekan tombol tambah materi, lalu pilih mata pelajaran dan kelas tujuan.',
      'Isi judul, deskripsi, dan lampiran jika ada, lalu simpan materi.',
    ],
  },
  {
    title: 'Penugasan',
    steps: [
      'Buka menu Penugasan untuk melihat daftar tugas.',
      'Buat tugas baru dengan mengisi mata pelajaran, kelas, instruksi, lampiran, dan deadline.',
      'Setelah siswa mengumpulkan, buka monitoring evaluasi penugasan untuk memberi nilai atau catatan.',
    ],
  },
  {
    title: 'Ujian dan monitoring',
    steps: [
      'Buka menu Ujian, lalu masuk ke bank soal atau pembuatan ujian.',
      'Isi pembuatan ujian dari tahap 1 sampai tahap 3.',
      'Publish ujian jika data, soal, jadwal, dan pengaturan sudah benar.',
      'Buka monitoring ujian untuk melihat status pengerjaan dan catatan aktivitas siswa.',
    ],
  },
];

const teacherScenario = [
  'Guru login ke RoomClass.',
  'Guru mengecek dashboard utama untuk melihat ringkasan aktivitas pembelajaran.',
  'Guru membuka Materi Pelajaran dan menambahkan satu materi untuk siswa.',
  'Guru membuka Penugasan dan menambahkan satu tugas untuk kelas tujuan.',
  'Guru mengecek monitoring evaluasi penugasan setelah siswa mengumpulkan tugas.',
  'Guru membuka Ujian, menyiapkan bank soal, lalu membuat ujian dari tahap 1 sampai tahap 3.',
  'Guru mempublikasikan ujian agar siswa bisa mengerjakan.',
  'Guru membuka monitoring ujian untuk memantau status pengerjaan dan catatan aktivitas anti-cheat.',
];

function GuideCards() {
  return (
    <section className={styles.roleSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.teacherTone}`}>Panduan Guru</span>
        <h2>Cara pemakaian dashboard guru</h2>
        <p>Guru mengelola alur pembelajaran dari materi, tugas, ujian, publish ujian, sampai monitoring.</p>
      </div>
      <div className={styles.guideGrid}>
        {teacherGuides.map((guide) => (
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

function TeacherScenario() {
  return (
    <section className={styles.flowSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.flowTone}`}>Alur Uji Coba Guru</span>
        <h2>Urutan pengujian role guru</h2>
        <p>Alur ini mengikuti screenshot yang tersedia dari login sampai monitoring ujian.</p>
      </div>
      <div className={styles.timeline}>
        {teacherScenario.map((item, index) => (
          <div key={item} className={styles.timelineItem}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AntiCheatNotes() {
  return (
    <section className={styles.antiCheatSection}>
      <div>
        <span className={`${styles.eyebrow} ${styles.warningTone}`}>Anti-Cheat</span>
        <h2>Catatan guru saat menguji Tab Activity Detection</h2>
        <p>
          Pada role guru, fitur anti-cheat dicek melalui monitoring ujian. Guru dapat membandingkan
          siswa yang mengerjakan normal dengan siswa yang melakukan simulasi berpindah tab.
        </p>
      </div>
      <ul>
        <li>Pastikan ujian sudah dipublish sebelum siswa mulai mengerjakan.</li>
        <li>Berikan instruksi agar siswa tetap berada pada tab ujian selama pengerjaan.</li>
        <li>Lakukan satu simulasi berpindah tab untuk memastikan catatan aktivitas muncul di monitoring.</li>
        <li>Gunakan hasil monitoring sebagai bukti fitur anti-cheat berjalan pada skenario uji coba.</li>
      </ul>
    </section>
  );
}

export default function TeacherDocumentationPage() {
  return (
    <main className={styles.roleDocShell}>
      <header className={styles.roleDocHeader}>
        <Link href="/dokumentasi" className={styles.backLink}>Kembali ke Dokumentasi</Link>
        <span className={`${styles.eyebrow} ${styles.teacherTone}`}>Dokumentasi Guru</span>
        <h1>Alur guru dari login sampai monitoring ujian</h1>
        <p>
          Panduan ini menampilkan alur guru untuk materi, penugasan, pembuatan ujian,
          publish ujian, dan monitoring ujian dengan screenshot besar.
        </p>
      </header>

      <GuideCards />
      <TeacherScenario />
      <AntiCheatNotes />

      <section className={styles.roleDocTimeline}>
        {guruScreenshots.map((item, index) => (
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
                alt={`Screenshot ${item.title} pada alur guru RoomClass`}
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
