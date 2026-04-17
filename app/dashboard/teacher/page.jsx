export default function TeacherDashboard() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 24,
      padding: 32,
      boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
    }}>
      <h1 style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#1A1A1A',
        marginBottom: 8,
      }}>
        Teacher Dashboard
      </h1>
      <p style={{ color: '#9CA3AF', fontSize: '0.9375rem' }}>
        Selamat datang di panel guru. Fitur tugas, materi, dan ujian akan segera hadir.
      </p>
    </div>
  );
}
