import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getToken } from '../lib/storage';
import api from '../lib/api';

export default function Index() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const token = await getToken();
      if (!token) {
        router.replace('/login');
        return;
      }

      try {
        await api.get('/api/auth/me');
        router.replace('/dashboard');
      } catch (err) {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
    alignItems: 'center',
    justifyContent: 'center',
  },
});
