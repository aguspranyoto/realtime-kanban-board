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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../lib/api';

interface Card {
  id: string;
  list_id: string;
  name: string;
  description: string;
  position: number;
  due_date: string | null;
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
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [cardDetailVisible, setCardDetailVisible] = useState(false);
  const [cardDesc, setCardDesc] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);

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

  const handleMoveCard = async (cardId: string, direction: 'up' | 'down') => {
    if (!board) return;
    // Find card and list
    let currentList: List | null = null;
    let cardIndex = -1;
    for (const l of board.lists) {
      const idx = l.cards.findIndex((c) => c.id === cardId);
      if (idx !== -1) {
        currentList = l;
        cardIndex = idx;
        break;
      }
    }

    if (!currentList) return;

    const targetIdx = direction === 'up' ? cardIndex - 1 : cardIndex + 1;
    if (targetIdx < 0 || targetIdx >= currentList.cards.length) return;

    // Swap positions
    const cards = [...currentList.cards].sort((a, b) => a.position - b.position);
    const temp = cards[cardIndex].position;
    cards[cardIndex].position = cards[targetIdx].position;
    cards[targetIdx].position = temp;

    try {
      // Optimistic update locally
      setBoard({
        ...board,
        lists: board.lists.map((l) =>
          l.id === currentList!.id ? { ...l, cards: [...cards] } : l
        ),
      });

      // Persist moving
      await api.put('/api/cards/move', {
        card_ids: cards.map((c) => c.id),
        list_id: currentList.id,
      });
    } catch (err) {
      fetchBoard();
    }
  };

  const handleMoveCardToList = async (cardId: string, targetListId: string) => {
    if (!board) return;
    try {
      await api.put(`/api/cards/${cardId}`, {
        list_id: targetListId,
      });
      setCardDetailVisible(false);
      fetchBoard();
    } catch (err) {
      Alert.alert('Error', 'Failed to move card');
    }
  };

  const handleUpdateCardDesc = async () => {
    if (!selectedCard) return;
    try {
      await api.put(`/api/cards/${selectedCard.id}`, {
        description: cardDesc,
      });
      setSelectedCard({ ...selectedCard, description: cardDesc });
      setIsEditingDesc(false);
      fetchBoard();
    } catch (err) {
      Alert.alert('Error', 'Failed to update description');
    }
  };

  const handleOpenCard = (card: Card) => {
    setSelectedCard(card);
    setCardDesc(card.description || '');
    setIsEditingDesc(false);
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {board.name}
        </Text>
        <TouchableOpacity onPress={() => setNewListModalVisible(true)}>
          <Text style={styles.newListButton}>+ List</Text>
        </TouchableOpacity>
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

              <ScrollView style={styles.cardsContainer} showsVerticalScrollIndicator={false}>
                {list.cards
                  ?.sort((a, b) => a.position - b.position)
                  .map((card, idx) => (
                    <TouchableOpacity
                      key={card.id}
                      style={styles.card}
                      onPress={() => handleOpenCard(card)}
                    >
                      <Text style={styles.cardText}>{card.name}</Text>

                      {/* Monochromatic sorting indicators */}
                      <View style={styles.cardActionsRow}>
                        {idx > 0 && (
                          <TouchableOpacity
                            style={styles.sortButton}
                            onPress={() => handleMoveCard(card.id, 'up')}
                          >
                            <Text style={styles.sortButtonText}>▲</Text>
                          </TouchableOpacity>
                        )}
                        {idx < list.cards.length - 1 && (
                          <TouchableOpacity
                            style={styles.sortButton}
                            onPress={() => handleMoveCard(card.id, 'down')}
                          >
                            <Text style={styles.sortButtonText}>▼</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}

                <TouchableOpacity
                  style={styles.addCardButton}
                  onPress={() => {
                    setActiveListId(list.id);
                    setNewCardModalVisible(true);
                  }}
                >
                  <Text style={styles.addCardText}>+ Add Card</Text>
                </TouchableOpacity>
              </ScrollView>
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

      {/* Card Details Modal */}
      {selectedCard && (
        <Modal visible={cardDetailVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{selectedCard.name}</Text>

              {/* Description */}
              <Text style={styles.modalSectionTitle}>Description</Text>
              {isEditingDesc ? (
                <View>
                  <TextInput
                    style={[styles.modalInput, styles.descInput]}
                    multiline
                    value={cardDesc}
                    onChangeText={setCardDesc}
                    placeholder="Add description..."
                    placeholderTextColor="#64748b"
                  />
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.modalButtonCancel]}
                      onPress={() => setIsEditingDesc(false)}
                    >
                      <Text style={styles.modalButtonCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalButton} onPress={handleUpdateCardDesc}>
                      <Text style={styles.modalButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.descContainer}
                  onPress={() => setIsEditingDesc(true)}
                >
                  <Text style={styles.descText}>
                    {selectedCard.description || 'No description yet. Tap to add...'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Move to another List */}
              <Text style={styles.modalSectionTitle}>Move to list</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {board.lists
                  .filter((l) => l.id !== selectedCard.list_id)
                  .map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      style={styles.moveListOption}
                      onPress={() => handleMoveCardToList(selectedCard.id, l.id)}
                    >
                      <Text style={styles.moveListOptionText}>{l.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalButton, { marginTop: 24, alignSelf: 'stretch', marginLeft: 0 }]}
                onPress={() => {
                  setCardDetailVisible(false);
                  setSelectedCard(null);
                }}
              >
                <Text style={[styles.modalButtonText, { textAlign: 'center' }]}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
    borderBottomWidth: 1,
    borderColor: '#1e293b',
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
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardText: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
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
  descInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  descContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#475569',
    minHeight: 60,
  },
  descText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  moveListOption: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  moveListOptionText: {
    color: '#ffffff',
    fontSize: 14,
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
