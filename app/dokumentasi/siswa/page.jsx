import Image from 'next/image';
import Link from 'next/link';
import styles from '../dokumentasi.module.css';
import { studentScreenshots } from '../studentScreenshots';

const studentGuides = [
  {
    title: 'Login dan dashboard',
    steps: [
      'Masuk menggunakan akun siswa yang sudah dibuat admin.',
      'Cek dashboard untuk melihat tugas, ujian tersedia, nilai terbaru, dan informasi kelas.',
      'Gunakan menu navigasi untuk membuka materi, tugas, dan ujian.',
    ],
  },
  {
    title: 'Tugas',
    steps: [
      'Buka menu Tugas atau pilih tugas dari dashboard utama.',
      'Baca instruksi dan perhatikan deadline pengumpulan.',
      'Unggah file jawaban atau isi jawaban sesuai format yang diminta, lalu kirim tugas.',
    ],
  },
  {
    title: 'Materi',
    steps: [
      'Buka menu Materi.',
      'Pilih materi berdasarkan mata pelajaran atau kelas yang tersedia.',
      'Buka detail materi untuk membaca isi materi dan lampiran pendukung dari guru.',
    ],
  },
  {
    title: 'Mengikuti ujian',
    steps: [
      'Buka menu Ujian dan pilih ujian yang tersedia.',
      'Tekan mulai ujian, lalu baca peringatan ujian sebelum masuk ke form soal.',
      'Kerjakan soal pada form ujian sampai selesai dan submit jawaban.',
      'Selama ujian, tetap berada pada tab ujian agar tidak tercatat sebagai aktivitas mencurigakan.',
    ],
  },
  {
    title: 'Melihat nilai dan evaluasi',
    steps: [
      'Buka hasil ujian setelah nilai tersedia.',
      'Masuk ke detail nilai untuk melihat ringkasan hasil pengerjaan.',
      'Buka evaluasi ujian untuk melihat pembahasan atau umpan balik yang tersedia.',
    ],
  },
];

const studentScenario = [
  'Siswa login ke Classroom.',
  'Siswa membuka dashboard utama untuk melihat ringkasan tugas, materi, dan ujian.',
  'Siswa membuka menu Tugas untuk mengecek daftar tugas dari guru.',
  'Siswa mengunggah file jawaban atau melengkapi jawaban, lalu mengirim tugas.',
  'Siswa membuka menu Materi untuk melihat materi pembelajaran.',
  'Siswa membuka detail materi dan membaca isi materi yang diberikan guru.',
  'Siswa membuka menu Ujian, lalu memilih ujian yang tersedia.',
  'Siswa menekan mulai ujian dan membaca peringatan ujian.',
  'Siswa menjawab soal pada form ujian sampai selesai.',
  'Siswa mengecek hasil ujian setelah nilai tersedia.',
  'Siswa membuka detail nilai dan memilih lihat evaluasi.',
  'Siswa melihat hasil evaluasi ujian sebagai umpan balik pengerjaan.',
];

function GuideCards() {
  return (
    <section className={styles.roleSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.studentTone}`}>Panduan Siswa</span>
        <h2>Cara pemakaian dashboard siswa</h2>
        <p>Siswa menggunakan Classroom untuk membaca materi, mengumpulkan tugas, dan mengikuti ujian.</p>
      </div>
      <div className={styles.guideGrid}>
        {studentGuides.map((guide) => (
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

function StudentScenario() {
  return (
    <section className={styles.flowSection}>
      <div className={styles.sectionHeading}>
        <span className={`${styles.eyebrow} ${styles.flowTone}`}>Alur Uji Coba Siswa</span>
        <h2>Urutan pengujian role siswa</h2>
        <p>Alur ini mengikuti screenshot siswa dari login sampai melihat hasil evaluasi ujian.</p>
      </div>
      <div className={styles.timeline}>
        {studentScenario.map((item, index) => (
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
        <h2>Catatan siswa saat mengikuti ujian</h2>
        <p>
          Tab Activity Detection dipakai saat ujian berlangsung. Sistem dapat mencatat aktivitas
          seperti berpindah tab, minimize browser, atau kehilangan fokus dari halaman ujian.
        </p>
      </div>
      <ul>
        <li>Pastikan koneksi stabil sebelum memulai ujian.</li>
        <li>Jangan membuka tab atau aplikasi lain selama ujian berlangsung.</li>
        <li>Jika simulasi anti-cheat diperlukan, lakukan hanya ketika penguji memberikan arahan.</li>
        <li>Submit jawaban setelah selesai dan tunggu instruksi guru untuk melihat hasil.</li>
      </ul>
    </section>
  );
}

export default function StudentDocumentationPage() {
  return (
    <main className={styles.roleDocShell}>
      <header className={styles.roleDocHeader}>
        <Link href="/dokumentasi" className={styles.backLink}>Kembali ke Dokumentasi</Link>
        <span className={`${styles.eyebrow} ${styles.studentTone}`}>Dokumentasi Siswa</span>
        <h1>Alur siswa untuk materi, tugas, dan ujian</h1>
        <p>
          Panduan ini menampilkan alur siswa dari login, dashboard utama, pengumpulan tugas,
          membaca materi, mulai dan menjawab ujian, sampai melihat nilai serta evaluasi.
        </p>
      </header>

      <GuideCards />
      <StudentScenario />
      <AntiCheatNotes />

      <section className={styles.roleDocTimeline}>
        {studentScreenshots.map((item, index) => (
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
                alt={`Screenshot ${item.title} pada alur siswa Classroom`}
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
