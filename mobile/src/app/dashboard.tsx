import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../lib/api';
import { removeToken } from '../lib/storage';
import { NotificationBell } from '../components/NotificationBell';
import { LogOut, Plus } from 'lucide-react-native';

interface Board {
  id: string;
  name: string;
  background: string;
}

interface Workspace {
  id: string;
  name: string;
  description: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const { width } = useWindowDimensions();

  // Dynamic grid column calculation: 1 column for very small screens, 2 for most phones, more for tablets
  const numColumns = width < 380 ? 1 : Math.floor(width / 180);

  // Modal states
  const [wsModalVisible, setWsModalVisible] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');

  const [boardModalVisible, setBoardModalVisible] = useState(false);
  const [boardName, setBoardName] = useState('');

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/api/workspaces');
      setWorkspaces(response.data);
      if (response.data.length > 0 && !selectedWs) {
        setSelectedWs(response.data[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBoards = async (wsId: string) => {
    setBoardsLoading(true);
    try {
      const response = await api.get(`/api/boards/workspace/${wsId}`);
      setBoards(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setBoardsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWs) {
      fetchBoards(selectedWs);
    } else {
      setBoards([]);
    }
  }, [selectedWs]);

  const handleLogout = async () => {
    await removeToken();
    router.replace('/login');
  };

  const handleCreateWorkspace = async () => {
    if (!wsName.trim()) return;
    try {
      const response = await api.post('/api/workspaces', {
        name: wsName,
        description: wsDesc,
      });
      setWorkspaces([...workspaces, response.data]);
      setSelectedWs(response.data.id);
      setWsModalVisible(false);
      setWsName('');
      setWsDesc('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create workspace');
    }
  };

  const handleCreateBoard = async () => {
    if (!boardName.trim() || !selectedWs) return;
    try {
      const response = await api.post('/api/boards', {
        workspace_id: selectedWs,
        name: boardName,
        background: '#1e293b', // Default dark background
      });
      setBoards([...boards, response.data]);
      setBoardModalVisible(false);
      setBoardName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to create board');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Trello Clone</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <NotificationBell />
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut size={14} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Workspaces List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Workspaces</Text>
          <TouchableOpacity onPress={() => setWsModalVisible(true)} style={styles.actionButton}>
            <Plus size={16} color="#f8fafc" />
            <Text style={styles.actionButtonText}>New</Text>
          </TouchableOpacity>
        </View>

        {workspaces.length === 0 ? (
          <Text style={styles.emptyText}>No workspaces yet</Text>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={workspaces}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.wsCard,
                  selectedWs === item.id && styles.wsCardSelected,
                ]}
                onPress={() => setSelectedWs(item.id)}
              >
                <Text
                  style={[
                    styles.wsCardText,
                    selectedWs === item.id && styles.wsCardTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Boards List */}
      <View style={[styles.section, { flex: 1 }]}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Boards</Text>
          {selectedWs && (
            <TouchableOpacity onPress={() => setBoardModalVisible(true)} style={styles.actionButton}>
              <Plus size={16} color="#f8fafc" />
              <Text style={styles.actionButtonText}>New Board</Text>
            </TouchableOpacity>
          )}
        </View>

        {boardsLoading ? (
          <ActivityIndicator color="#ffffff" style={{ marginTop: 24 }} />
        ) : boards.length === 0 ? (
          <Text style={styles.emptyText}>
            {selectedWs ? 'No boards in this workspace' : 'Select a workspace to view boards'}
          </Text>
        ) : (
          <FlatList
            key={numColumns} // Force re-render when numColumns changes
            data={boards}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.boardRow : undefined}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.boardCard, 
                  { 
                    backgroundColor: item.background || '#1e293b',
                    width: numColumns > 1 ? `${100 / numColumns - 2}%` : '100%',
                    marginBottom: numColumns === 1 ? 12 : 0,
                  }
                ]}
                onPress={() => router.push(`/board/${item.id}`)}
              >
                <Text style={styles.boardCardText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Create Workspace Modal */}
      <Modal visible={wsModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Workspace</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Workspace Name"
              placeholderTextColor="#64748b"
              value={wsName}
              onChangeText={setWsName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Description"
              placeholderTextColor="#64748b"
              value={wsDesc}
              onChangeText={setWsDesc}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setWsModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleCreateWorkspace}>
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Board Modal */}
      <Modal visible={boardModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Board</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Board Name"
              placeholderTextColor="#64748b"
              value={boardName}
              onChangeText={setBoardName}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setBoardModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleCreateBoard}>
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Slate 900
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#f8fafc',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 8,
  },
  wsCard: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    height: 42,
  },
  wsCardSelected: {
    backgroundColor: '#f8fafc',
    borderColor: '#f8fafc',
  },
  wsCardText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  wsCardTextSelected: {
    color: '#0f172a',
  },
  boardRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  boardCard: {
    aspectRatio: 1.6,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#334155',
  },
  boardCardText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    padding: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  modalButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginLeft: 12,
  },
  modalButtonText: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
  },
  modalButtonCancelText: {
    color: '#cbd5e1',
  },
});
