'use client';

import { useState, useEffect } from 'react';

export default function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Mencegah mini-infobar bawaan browser muncul di mobile
      e.preventDefault();
      // Simpan event agar bisa dipicu nanti dengan tombol custom
      setDeferredPrompt(e);
      // Tampilkan UI custom kita
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Tampilkan prompt instalasi bawaan browser
    deferredPrompt.prompt();
    
    // Tunggu respons user terhadap prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User menerima instalasi PWA');
      setShowPrompt(false);
    }
    
    // Event prompt hanya bisa digunakan sekali, lalu buang
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px', // Posisikan di atas Sticky Bottom Bar
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'var(--color-primary)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '24px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      zIndex: 50,
      width: '90%',
      maxWidth: '400px',
      justifyContent: 'space-between',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="7 10 12 15 17 10"></polyline>
          <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span style={{ fontSize: '0.85rem', fontWeight: '500', lineHeight: '1.2' }}>
          Instal Classroom di HP Anda untuk pengalaman lebih cepat!
        </span>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button 
          onClick={handleInstallClick}
          style={{
            background: 'white',
            color: 'var(--color-primary)',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '16px',
            fontWeight: '700',
            fontSize: '0.8rem',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Instal
        </button>
        <button 
          onClick={() => setShowPrompt(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Tutup"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
