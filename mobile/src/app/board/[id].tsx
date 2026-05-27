import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../lib/api';
import { CardModal } from '../../components/CardModal';
import { NotificationBell } from '../../components/NotificationBell';
import { ArrowLeft, Plus, Activity, Anchor, Aperture, Award, Book, Briefcase, Camera, Compass } from 'lucide-react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';

interface Card {
  id: string;
  list_id: string;
  name: string;
  description: string;
  position: number;
  due_date: string | null;
  cover_url?: string;
  labels?: {
    id: string;
    label_id: string;
    label: {
      id: string;
      name: string;
      color: string;
    }
  }[];
}

interface List {
  id: string;
  board_id: string;
  name: string;
  position: number;
  cards: Card[];
}

interface Board {
  id: string;
  name: string;
  background: string;
  lists: List[];
}

const getFileUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  let baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
  if (Platform.OS === 'android' && baseUrl.includes('localhost')) {
    baseUrl = baseUrl.replace('localhost', '10.0.2.2');
  }
  return `${baseUrl}${url}`;
};

const LABEL_ICONS = [Activity, Anchor, Aperture, Award, Book, Briefcase, Camera, Compass];
const getIconForLabel = (id: string) => {
  if (!id) return LABEL_ICONS[0];
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return LABEL_ICONS[hash % LABEL_ICONS.length];
};

export default function BoardScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Modals / Input states
  const [newListModalVisible, setNewListModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');

  const [newCardModalVisible, setNewCardModalVisible] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [activeListId, setActiveListId] = useState<string | null>(null);

  // Card detail modal
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cardDetailVisible, setCardDetailVisible] = useState(false);

  const fetchBoard = async () => {
    try {
      const response = await api.get(`/api/boards/${id}`);
      setBoard(response.data);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load board');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBoard();

    // Set up WebSocket for real-time updates
    let wsURL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
    if (Platform.OS === 'android' && wsURL.includes('localhost')) {
      wsURL = wsURL.replace('localhost', '10.0.2.2');
    }
    // Convert http/https to ws/wss
    wsURL = wsURL.replace(/^http/, 'ws') + `/ws/board/${id}`;

    const ws = new WebSocket(wsURL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'board_updated' || msg.type === 'list_updated' || msg.type === 'card_updated') {
          fetchBoard();
        }
      } catch (err) {
        // Simple silent reload on any ws message
        fetchBoard();
      }
    };

    ws.onerror = (e) => console.log('WebSocket error:', e);
    ws.onclose = () => console.log('WebSocket closed');

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [id]);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await api.post('/api/lists', {
        board_id: id,
        name: newListName,
      });
      setNewListModalVisible(false);
      setNewListName('');
      fetchBoard();
    } catch (error) {
      Alert.alert('Error', 'Failed to create list');
    }
  };

  const handleCreateCard = async () => {
    if (!newCardName.trim() || !activeListId) return;
    try {
      await api.post('/api/cards', {
        list_id: activeListId,
        name: newCardName,
      });
      setNewCardModalVisible(false);
      setNewCardName('');
      setActiveListId(null);
      fetchBoard();
    } catch (error) {
      Alert.alert('Error', 'Failed to create card');
    }
  };

  const handleDragEnd = async (listId: string, data: Card[]) => {
    if (!board) return;
    
    // Update local state optimistically
    setBoard({
      ...board,
      lists: board.lists.map((l) =>
        l.id === listId ? { ...l, cards: data } : l
      ),
    });

    try {
      await api.put('/api/cards/move', {
        card_ids: data.map((c) => c.id),
        list_id: listId,
      });
    } catch (err) {
      fetchBoard();
    }
  };

  const handleOpenCard = (card: Card) => {
    setSelectedCardId(card.id);
    setCardDetailVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  if (!board) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <ArrowLeft size={24} color="#cbd5e1" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {board.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <NotificationBell />
          <TouchableOpacity onPress={() => setNewListModalVisible(true)} style={{ padding: 8 }}>
            <Plus size={24} color="#f8fafc" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Board Canvas */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.boardCanvas}
      >
        {board.lists
          ?.sort((a, b) => a.position - b.position)
          .map((list) => (
            <View key={list.id} style={styles.listContainer}>
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>{list.name}</Text>
              </View>

              <DraggableFlatList
                style={styles.cardsContainer}
                data={[...(list.cards || [])].sort((a, b) => a.position - b.position)}
                onDragEnd={({ data }) => handleDragEnd(list.id, data)}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item: card, drag, isActive }) => (
                  <ScaleDecorator>
                    <TouchableOpacity
                      activeOpacity={1}
                      onLongPress={drag}
                      disabled={isActive}
                      style={[
                        styles.card,
                        { opacity: isActive ? 0.7 : 1, elevation: isActive ? 5 : 0 }
                      ]}
                      onPress={() => handleOpenCard(card)}
                    >
                      {card.cover_url ? (
                        <Image
                          source={{ uri: getFileUrl(card.cover_url) }}
                          style={styles.cardCover}
                        />
                      ) : null}
                      <View style={styles.cardBody}>
                        <View style={styles.cardContent}>
                          {card.labels && card.labels.length > 0 && (
                            <View style={styles.labelsContainer}>
                              {card.labels.map((cl) => {
                                const Icon = getIconForLabel(cl.label_id);
                                return (
                                  <View key={cl.id} style={styles.labelWrapper}>
                                    <View style={[styles.labelIconSide, { backgroundColor: cl.label?.color || '#cbd5e1' }]}>
                                      <Icon size={12} color="rgba(0,0,0,0.6)" />
                                    </View>
                                    <View style={[styles.labelTextSide, { backgroundColor: cl.label?.color || '#cbd5e1', opacity: 0.8 }]}>
                                      <Text style={styles.labelText} numberOfLines={1}>{cl.label?.name}</Text>
                                    </View>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          <Text style={styles.cardText}>{card.name}</Text>
                          
                          {card.due_date && (
                            <View style={styles.dueDateBadge}>
                              <Text style={styles.dueDateText}>
                                {new Date(card.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </ScaleDecorator>
                )}
                ListFooterComponent={() => (
                  <TouchableOpacity
                    style={styles.addCardButton}
                    onPress={() => {
                      setActiveListId(list.id);
                      setNewCardModalVisible(true);
                    }}
                  >
                    <Text style={styles.addCardText}>+ Add Card</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          ))}
      </ScrollView>

      {/* Create List Modal */}
      <Modal visible={newListModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New List</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List Name"
              placeholderTextColor="#64748b"
              value={newListName}
              onChangeText={setNewListName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => setNewListModalVisible(false)}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleCreateList}>
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Card Modal */}
      <Modal visible={newCardModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Card</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Card Name"
              placeholderTextColor="#64748b"
              value={newCardName}
              onChangeText={setNewCardName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setNewCardModalVisible(false);
                  setNewCardName('');
                  setActiveListId(null);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalButton} onPress={handleCreateCard}>
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Card Details Modal (New full-featured component) */}
      <CardModal
        visible={cardDetailVisible}
        cardId={selectedCardId}
        onClose={() => {
          setCardDetailVisible(false);
          setSelectedCardId(null);
        }}
        onUpdate={fetchBoard}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  newListButton: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  boardCanvas: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  listContainer: {
    width: 280,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginRight: 16,
    padding: 12,
    maxHeight: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  listHeader: {
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardsContainer: {
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  cardCover: {
    width: '100%',
    height: 80,
    backgroundColor: '#1e293b',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  cardContent: {
    flex: 1,
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 4,
    overflow: 'hidden',
    height: 20,
    maxWidth: 120,
  },
  labelIconSide: {
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelTextSide: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
  },
  dueDateBadge: {
    marginTop: 8,
    backgroundColor: '#1e293b',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dueDateText: {
    color: '#94a3b8',
    fontSize: 10,
  },
  cardText: {
    color: '#ffffff',
    fontSize: 14,
  },
  cardActionsRow: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  sortButton: {
    padding: 4,
    marginLeft: 4,
  },
  sortButtonText: {
    color: '#64748b',
    fontSize: 12,
  },
  addCardButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  addCardText: {
    color: '#94a3b8',
    fontSize: 14,
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
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
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
