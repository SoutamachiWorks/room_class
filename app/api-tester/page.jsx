'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ApiTesterPage() {
  const [method, setMethod] = useState('GET');
  const [endpoint, setEndpoint] = useState('/api/');
  const [bodyData, setBodyData] = useState('');
  const [responseLog, setResponseLog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusCode, setStatusCode] = useState(null);
  const [executionTime, setExecutionTime] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponseLog(null);
    setStatusCode(null);
    
    const startTime = performance.now();
    
    try {
      let options = {
        method: method,
        headers: {}
      };

      if ((method === 'POST' || method === 'PUT') && bodyData) {
        options.headers['Content-Type'] = 'application/json';
        options.body = bodyData;
      }

      // Fetch calls will naturally carry the user's HttpOnly cookies!
      // This means if you are logged in on another tab, this will test endpoint as THAT role.
      const res = await fetch(endpoint, options);
      const endTime = performance.now();
      setExecutionTime(Math.round(endTime - startTime));
      setStatusCode(res.status);

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      setResponseLog(data);

    } catch (err) {
      setResponseLog({ error: 'Network Error / Fetch Exception', details: err.message });
      setStatusCode(0);
      setExecutionTime(Math.round(performance.now() - startTime));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '40px 20px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.875rem', fontWeight: 800, color: '#0F172A' }}>⚡ Mock API Tester (REST)</h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '0.9375rem', marginBottom: '24px' }}>
            Konsol pengujian eksklusif untuk mengecek respon *Server*. Cocok untuk mendemonstrasikan keandalan sistem kepada Dosen Penguji.
          </p>

          {/* Quick Presets */}
          <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid #E2E8F0' }}>
             <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1E293B', marginBottom: '12px' }}>🎯 Skenario Otomatis (Klik untuk Test):</h3>
             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  onClick={() => { setMethod('POST'); setEndpoint('/api/auth/register'); setBodyData(JSON.stringify({ classCode: "KODEKELAS123", username: "tester_siswa1", password: "password123", fullName: "Siswa Uji Coba", email: "siswa@test.com", phone: "081234" }, null, 2)); }}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                >
                  📝 Test Register Siswa Baru
                </button>
                <button 
                  onClick={() => { setMethod('POST'); setEndpoint('/api/auth/login'); setBodyData(JSON.stringify({ identifier: "admin", password: "admin123" }, null, 2)); }}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                >
                  🔑 Test Login (Sistem Auth)
                </button>
                <button 
                  onClick={() => { setMethod('GET'); setEndpoint('/api/admin/system/logs'); setBodyData(''); }}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                >
                  📜 Test Ambil Log (Harus Login Admin)
                </button>
                <button 
                  onClick={() => { setMethod('GET'); setEndpoint('/api/student/materials'); setBodyData(''); }}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '8px 16px', borderRadius: '20px', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                >
                  📚 Test Akses Materi (Siswa/Guru)
                </button>
             </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '0 0 120px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>Method</label>
                <select 
                  value={method} 
                  onChange={e => setMethod(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 600, color: '#334155' }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>

              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>API Endpoint Target</label>
                <input 
                  type="text" 
                  value={endpoint} 
                  onChange={e => setEndpoint(e.target.value)} 
                  placeholder="/api/student/materials"
                  required
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontFamily: 'monospace', fontSize: '1rem' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{ height: '46px', padding: '0 32px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', transition: 'background 0.2s', alignSelf: 'flex-end' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
                onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
              >
                {loading ? 'Sending...' : 'Kirim Reques'}
              </button>
            </div>

            {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
                  JSON Payload Body <span style={{ color: '#94A3B8', fontWeight: 400 }}>(Mendukung format mentah JSON)</span>
                </label>
                <textarea 
                  value={bodyData}
                  onChange={e => setBodyData(e.target.value)}
                  placeholder='{&#10;  "kunci": "nilai"&#10;}'
                  style={{ width: '100%', height: '140px', padding: '16px', borderRadius: '8px', border: '1px solid #CBD5E1', fontFamily: 'monospace', fontSize: '0.875rem', resize: 'vertical', background: '#F8FAFC' }}
                />
              </div>
            )}
          </form>
        </div>

        {/* API Response Output Console */}
        <div style={{ background: '#0F172A', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC' }}>Response Log</h2>
                 {statusCode !== null && (
                   <span style={{ 
                     background: statusCode >= 200 && statusCode < 300 ? '#10B981' : statusCode >= 400 ? '#EF4444' : '#F59E0B',
                     color: 'white',
                     padding: '4px 10px',
                     borderRadius: '4px',
                     fontSize: '0.75rem',
                     fontWeight: 800
                   }}>
                     HTTP {statusCode}
                   </span>
                 )}
              </div>
              
              {executionTime > 0 && <span style={{ color: '#94A3B8', fontSize: '0.875rem', fontFamily: 'monospace' }}>Time: {executionTime}ms</span>}
           </div>

           <div style={{ background: '#1E293B', borderRadius: '8px', padding: '20px', minHeight: '200px', overflowX: 'auto' }}>
              {loading ? (
                <div style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: '0.875rem' }}>{'// Menunggu Tembakan Sistem...'}</div>
              ) : responseLog !== null ? (
                <pre style={{ margin: 0, color: '#A5B4FC', fontFamily: 'monospace', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>
                  {typeof responseLog === 'object' ? JSON.stringify(responseLog, null, 2) : responseLog}
                </pre>
              ) : (
                <div style={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.875rem' }}>{`// Tekan "Kirim Reques" untuk melihat output dari server.`}</div>
              )}
           </div>
        </div>

        {/* Navigation Reference */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link href="/dokumentasi" style={{ color: '#3B82F6', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem', marginRight: '16px' }}>&larr; Kembali ke Dokumentasi Tulis</Link>
          <Link href="/" style={{ color: '#64748B', textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem' }}>Beranda</Link>
        </div>

      </div>
    </div>
  );
}
