import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import api from '../lib/api';
import { Activity, Anchor, Aperture, Award, Book, Briefcase, Camera, Compass } from 'lucide-react-native';

interface CardModalProps {
  visible: boolean;
  cardId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

const LABEL_ICONS = [Activity, Anchor, Aperture, Award, Book, Briefcase, Camera, Compass];
const getIconForLabel = (id: string) => {
  if (!id) return LABEL_ICONS[0];
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return LABEL_ICONS[hash % LABEL_ICONS.length];
};

export function CardModal({ visible, cardId, onClose, onUpdate }: CardModalProps) {
  const [card, setCard] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Edit states
  const [desc, setDesc] = useState('');
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  
  // Checklist states
  const [newChecklistName, setNewChecklistName] = useState('');
  const [isAddingChecklist, setIsAddingChecklist] = useState(false);
  const [newItemName, setNewItemName] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (visible && cardId) {
      fetchCard();
    }
  }, [visible, cardId]);

  const fetchCard = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/cards/${cardId}`);
      setCard(response.data);
      setDesc(response.data.description || '');
    } catch (err) {
      Alert.alert('Error', 'Failed to load card details');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDesc = async () => {
    try {
      await api.put(`/api/cards/${cardId}`, { description: desc });
      setIsEditingDesc(false);
      fetchCard();
      onUpdate();
    } catch (err) {
      Alert.alert('Error', 'Failed to update description');
    }
  };

  const handleToggleChecklist = async (itemId: string, checked: boolean) => {
    try {
      await api.put(`/api/checklists/items/${itemId}`, { is_checked: checked });
      fetchCard();
    } catch (err) {
      Alert.alert('Error', 'Failed to update checklist item');
    }
  };

  const handleAddChecklist = async () => {
    if (!newChecklistName.trim()) return;
    try {
      await api.post(`/api/cards/${cardId}/checklists`, { name: newChecklistName });
      setNewChecklistName('');
      setIsAddingChecklist(false);
      fetchCard();
    } catch (err) {
      Alert.alert('Error', 'Failed to create checklist');
    }
  };

  const handleAddChecklistItem = async (checklistId: string) => {
    const text = newItemName[checklistId];
    if (!text?.trim()) return;
    try {
      await api.post(`/api/checklists/${checklistId}/items`, { name: text });
      setNewItemName({ ...newItemName, [checklistId]: '' });
      fetchCard();
    } catch (err) {
      Alert.alert('Error', 'Failed to add item');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {loading || !card ? (
            <ActivityIndicator size="large" color="#ffffff" style={{ padding: 40 }} />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.modalTitle}>{card.name}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Due Date & Labels */}
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                {card.due_date && (
                  <View>
                    <Text style={styles.sectionLabel}>Due Date</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {new Date(card.due_date).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                )}
                {card.labels && card.labels.length > 0 && (
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionLabel}>Labels</Text>
                    <View style={styles.labelsWrapper}>
                      {card.labels.map((cl: any) => {
                        const Icon = getIconForLabel(cl.label_id);
                        return (
                          <View key={cl.id} style={styles.labelWrapper}>
                            <View style={[styles.labelIconSide, { backgroundColor: cl.label?.color || '#cbd5e1' }]}>
                              <Icon size={14} color="rgba(0,0,0,0.6)" />
                            </View>
                            <View style={[styles.labelTextSide, { backgroundColor: cl.label?.color || '#cbd5e1', opacity: 0.8 }]}>
                              <Text style={styles.labelText} numberOfLines={1}>{cl.label?.name}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              {/* Description */}
              <Text style={styles.sectionTitle}>Description</Text>
              {isEditingDesc ? (
                <View style={styles.editDescContainer}>
                  <TextInput
                    style={styles.descInput}
                    multiline
                    value={desc}
                    onChangeText={setDesc}
                    placeholder="Add description..."
                    placeholderTextColor="#64748b"
                  />
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditingDesc(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateDesc}>
                      <Text style={styles.saveText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.descDisplay} onPress={() => setIsEditingDesc(true)}>
                  <Text style={styles.descText}>
                    {card.description || 'No description yet. Tap to add...'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Checklists */}
              {card.checklists?.map((cl: any) => (
                <View key={cl.id} style={styles.checklistContainer}>
                  <Text style={styles.sectionTitle}>{cl.name}</Text>
                  
                  {cl.items?.map((item: any) => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={styles.checklistItem}
                      onPress={() => handleToggleChecklist(item.id, !item.is_checked)}
                    >
                      <View style={[styles.checkbox, item.is_checked && styles.checkboxChecked]}>
                        {item.is_checked && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                      <Text style={[styles.checklistItemText, item.is_checked && styles.checklistItemTextDone]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.addItemRow}>
                    <TextInput
                      style={styles.addItemInput}
                      placeholder="Add an item..."
                      placeholderTextColor="#64748b"
                      value={newItemName[cl.id] || ''}
                      onChangeText={(t) => setNewItemName({ ...newItemName, [cl.id]: t })}
                    />
                    <TouchableOpacity 
                      style={styles.addItemBtn}
                      onPress={() => handleAddChecklistItem(cl.id)}
                    >
                      <Text style={styles.addItemBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {/* Add Checklist Button */}
              {isAddingChecklist ? (
                <View style={styles.checklistContainer}>
                  <TextInput
                    style={styles.addItemInput}
                    placeholder="Checklist title"
                    placeholderTextColor="#64748b"
                    value={newChecklistName}
                    onChangeText={setNewChecklistName}
                    autoFocus
                  />
                  <View style={[styles.actionsRow, { marginTop: 8 }]}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsAddingChecklist(false)}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleAddChecklist}>
                      <Text style={styles.saveText}>Add Checklist</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setIsAddingChecklist(true)}>
                  <Text style={styles.outlineBtnText}>+ Add Checklist</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 12,
    marginTop: 16,
  },
  badge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  labelsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 6,
    overflow: 'hidden',
    height: 24,
  },
  labelIconSide: {
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelTextSide: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  labelText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  descDisplay: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 80,
  },
  descText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
  },
  editDescContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
    padding: 12,
  },
  descInput: {
    color: '#ffffff',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  cancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#94a3b8',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveText: {
    color: '#0f172a',
    fontWeight: 'bold',
  },
  checklistContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#475569',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checklistItemText: {
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1,
  },
  checklistItemTextDone: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  addItemRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  addItemInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
  },
  addItemBtn: {
    backgroundColor: '#334155',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  addItemBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  outlineBtnText: {
    color: '#cbd5e1',
    fontWeight: 'bold',
  }
});
