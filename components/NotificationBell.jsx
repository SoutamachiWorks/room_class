'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './NotificationBell.module.css';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const pathname = usePathname();

  // Close dropdown when path changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Optional: Set up a polling interval or WebSocket here if real-time is needed.
    // For now, poll every 60 seconds.
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (id, url) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      // Optimistically update
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'success':
        return (
          <svg className={styles.iconSuccess} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={styles.iconWarning} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      default:
        return (
          <svg className={styles.iconInfo} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  return (
    <div className={styles.bellContainer} ref={dropdownRef}>
      <button 
        className={`${styles.bellButton} ${isOpen ? styles.active : ''}`} 
        onClick={handleToggle}
        aria-label="Notifikasi"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className={styles.dropdownPanel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Notifikasi</h3>
            {unreadCount > 0 && <span className={styles.panelBadge}>{unreadCount} Baru</span>}
          </div>
          
          <div className={styles.panelBody}>
            {loading ? (
              <div className={styles.emptyState}>Memuat notifikasi...</div>
            ) : notifications.length === 0 ? (
              <div className={styles.emptyState}>Belum ada notifikasi.</div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif._id} 
                  className={`${styles.notifItem} ${!notif.isRead ? styles.unread : ''}`}
                >
                  <div className={styles.notifIconWrapper}>
                    {getIconForType(notif.type)}
                  </div>
                  <div className={styles.notifContent}>
                    <div className={styles.notifTitle}>{notif.title}</div>
                    <div className={styles.notifMessage}>{notif.message}</div>
                    <div className={styles.notifTime}>{formatDate(notif.createdAt)}</div>
                    
                    {notif.actionUrl && (
                      <Link 
                        href={notif.actionUrl} 
                        className={styles.actionLink}
                        onClick={() => handleMarkAsRead(notif._id, notif.actionUrl)}
                      >
                        Lihat Detail
                      </Link>
                    )}
                    {!notif.actionUrl && !notif.isRead && (
                      <button 
                        className={styles.markReadBtn}
                        onClick={() => handleMarkAsRead(notif._id)}
                      >
                        Tandai dibaca
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
