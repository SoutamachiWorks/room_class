export default function manifest() {
  return {
    name: 'Room Class',
    short_name: 'RoomClass',
    description: 'Aplikasi Ujian dan Manajemen Kelas Terpadu',
    start_url: '/dashboard?source=pwa',
    id: '/?source=pwa',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    scope: '/',
    orientation: 'portrait',
    background_color: '#0F1117',
    theme_color: '#0F1117',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  };
}
