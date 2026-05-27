import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import api from '../lib/api';
import { Bell } from 'lucide-react-native';

export function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [visible, setVisible] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/api/notifications');
      setNotifications(response.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.put(`/api/notifications/${id}/read`);
      fetchNotifications();
    } catch (err) {
      Alert.alert('Error', 'Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/api/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      Alert.alert('Error', 'Failed to mark all as read');
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => { fetchNotifications(); setVisible(true); }} style={styles.bellBtn}>
        <Bell size={24} color="#e2e8f0" />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.header}>
              <Text style={styles.title}>Notifications</Text>
              <View style={styles.headerRight}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView style={styles.list}>
              {notifications.length === 0 ? (
                <Text style={styles.emptyText}>No notifications</Text>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={[styles.notificationCard, !n.is_read && styles.unreadCard]}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMessage}>{n.message}</Text>
                    <Text style={styles.notifDate}>
                      {new Date(n.created_at).toLocaleString()}
                    </Text>
                    {!n.is_read && (
                      <TouchableOpacity onPress={() => handleMarkAsRead(n.id)} style={styles.readBtn}>
                        <Text style={styles.readBtnText}>Mark read</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    padding: 8,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    maxHeight: '80%',
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  markAllText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 20,
  },
  list: {
    marginBottom: 8,
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    padding: 20,
  },
  notificationCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unreadCard: {
    borderColor: '#3b82f6',
    backgroundColor: '#172554', // darker blue tint
  },
  notifTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  notifMessage: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 8,
  },
  notifDate: {
    color: '#64748b',
    fontSize: 12,
  },
  readBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  readBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
