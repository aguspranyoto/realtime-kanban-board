import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Tag, CheckSquare, Clock, AlignLeft, X } from "lucide-react";

import api from "@/lib/api";
import type { Card } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";

interface CardModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  listName?: string;
}

export function CardModal({ card, isOpen, onClose, boardId, listName }: CardModalProps) {
  const queryClient = useQueryClient();
  const [desc, setDesc] = useState(card?.description || "");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({});

  // Sync state when card changes
  if (card && card.description !== desc && !isEditingDesc) {
    setDesc(card.description || "");
  }

  const invalidateBoard = () => {
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
  };

  // Update description
  const updateDesc = useMutation({
    mutationFn: () => api.put(`/api/cards/${card?.id}`, { description: desc }),
    onSuccess: () => {
      setIsEditingDesc(false);
      invalidateBoard();
      toast.success("Description updated");
    },
  });

  // Update due date
  const updateDueDate = useMutation({
    mutationFn: (date: Date | null) =>
      api.put(`/api/cards/${card?.id}`, { due_date: date ? date.toISOString() : "null" }),
    onSuccess: () => invalidateBoard(),
  });

  // Add label
  const addLabel = useMutation({
    mutationFn: () =>
      api.post(`/api/cards/${card?.id}/labels`, { name: newLabelName, color: newLabelColor }),
    onSuccess: () => {
      setNewLabelName("");
      invalidateBoard();
    },
  });

  // Remove label
  const removeLabel = useMutation({
    mutationFn: (labelId: string) => api.delete(`/api/cards/${card?.id}/labels/${labelId}`),
    onSuccess: () => invalidateBoard(),
  });

  // Add checklist
  const addChecklist = useMutation({
    mutationFn: () => api.post(`/api/cards/${card?.id}/checklists`, { name: newChecklistName }),
    onSuccess: () => {
      setNewChecklistName("");
      invalidateBoard();
    },
  });

  // Delete checklist
  const deleteChecklist = useMutation({
    mutationFn: (id: string) => api.delete(`/api/checklists/${id}`),
    onSuccess: () => invalidateBoard(),
  });

  // Add checklist item
  const addItem = useMutation({
    mutationFn: (data: { checklistId: string; name: string }) =>
      api.post(`/api/checklists/${data.checklistId}/items`, { name: data.name }),
    onSuccess: (_, v) => {
      setNewItemNames((prev) => ({ ...prev, [v.checklistId]: "" }));
      invalidateBoard();
    },
  });

  // Toggle checklist item
  const toggleItem = useMutation({
    mutationFn: (data: { id: string; isChecked: boolean }) =>
      api.put(`/api/checklists/items/${data.id}`, { is_checked: data.isChecked }),
    onSuccess: () => invalidateBoard(),
  });

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-popover border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            {card.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">in list <span className="underline">{listName || "Unknown List"}</span></p>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-6 mt-4">
          <div className="col-span-3 space-y-6">
            
            {/* Due Date & Labels Badges */}
            <div className="flex flex-wrap gap-4">
              {card.due_date && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Due Date</h3>
                  <div className="bg-muted text-sm px-3 py-1.5 rounded-md flex items-center gap-2 border">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>{format(new Date(card.due_date), "MMM d, yyyy")}</span>
                  </div>
                </div>
              )}
              {card.labels && card.labels.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Labels</h3>
                  <div className="flex flex-wrap gap-2">
                    {card.labels.map((cl) => (
                      <div
                        key={cl.id}
                        className="px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1 group"
                        style={{ backgroundColor: cl.label?.color, color: "#fff" }}
                      >
                        {cl.label?.name}
                        <button
                          onClick={() => removeLabel.mutate(cl.label_id)}
                          className="opacity-0 group-hover:opacity-100 ml-1 hover:text-black transition-opacity cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlignLeft className="w-5 h-5 text-muted-foreground" />
                <h3 className="text-lg font-semibold text-foreground">Description</h3>
              </div>
              {isEditingDesc ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-card border rounded-md p-3 text-sm text-foreground focus:outline-none min-h-[100px]"
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Add a more detailed description..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => updateDesc.mutate()} className="cursor-pointer">
                      Save
                    </Button>
                    <Button variant="ghost" onClick={() => setIsEditingDesc(false)} className="cursor-pointer">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="bg-muted hover:bg-accent text-sm p-3 rounded-md cursor-pointer transition-colors min-h-[60px]"
                  onClick={() => setIsEditingDesc(true)}
                >
                  {desc || <span className="text-muted-foreground">Add a more detailed description...</span>}
                </div>
              )}
            </div>

            {/* Checklists */}
            {card.checklists?.map((checklist) => {
              const totalItems = checklist.items?.length || 0;
              const completedItems = checklist.items?.filter((i) => i.is_checked).length || 0;
              const progress = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

              return (
                <div key={checklist.id} className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-5 h-5 text-muted-foreground" />
                      <h3 className="text-lg font-semibold text-foreground">{checklist.name}</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteChecklist.mutate(checklist.id)}
                      className="text-destructive hover:bg-destructive/10 cursor-pointer p-1 h-auto"
                    >
                      Delete
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-muted-foreground w-8">{progress}%</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-2 ml-8 mb-4">
                    {checklist.items?.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <Checkbox
                          checked={item.is_checked}
                          onCheckedChange={(checked) =>
                            toggleItem.mutate({ id: item.id, isChecked: checked as boolean })
                          }
                          className="mt-1 cursor-pointer"
                        />
                        <span className={`text-sm ${item.is_checked ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Add Item */}
                  <div className="ml-8 flex gap-2">
                    <Input
                      placeholder="Add an item..."
                      value={newItemNames[checklist.id] || ""}
                      onChange={(e) =>
                        setNewItemNames((prev) => ({ ...prev, [checklist.id]: e.target.value }))
                      }
                      className="h-8"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newItemNames[checklist.id]?.trim()) {
                          addItem.mutate({
                            checklistId: checklist.id,
                            name: newItemNames[checklist.id].trim(),
                          });
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      className="h-8 cursor-pointer"
                      onClick={() => {
                        if (newItemNames[checklist.id]?.trim()) {
                          addItem.mutate({
                            checklistId: checklist.id,
                            name: newItemNames[checklist.id].trim(),
                          });
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar */}
          <div className="col-span-1 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Add to card</h3>

            {/* Labels Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-full justify-start cursor-pointer" />
                }
              >
                <Tag className="w-4 h-4 mr-2" /> Labels
              </PopoverTrigger>
              <PopoverContent className="w-60 bg-popover border p-3" align="end">
                <h4 className="text-sm font-semibold mb-3">Labels</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Label name"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    {["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"].map((color) => (
                      <button
                        key={color}
                        className={`w-6 h-6 rounded-md cursor-pointer ${newLabelColor === color ? "ring-2 ring-white" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setNewLabelColor(color)}
                      />
                    ))}
                  </div>
                  <Button
                    className="w-full h-8 text-sm cursor-pointer"
                    onClick={() => {
                      if (newLabelName.trim()) addLabel.mutate();
                    }}
                  >
                    Create Label
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Checklists Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-full justify-start cursor-pointer" />
                }
              >
                <CheckSquare className="w-4 h-4 mr-2" /> Checklist
              </PopoverTrigger>
              <PopoverContent className="w-60 bg-popover border p-3" align="end">
                <h4 className="text-sm font-semibold mb-3">Add checklist</h4>
                <div className="space-y-3">
                  <Input
                    placeholder="Checklist title"
                    value={newChecklistName}
                    onChange={(e) => setNewChecklistName(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button
                    className="w-full h-8 text-sm cursor-pointer"
                    onClick={() => {
                      if (newChecklistName.trim()) addChecklist.mutate();
                    }}
                  >
                    Add
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Dates Popover */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="outline" className="w-full justify-start cursor-pointer" />
                }
              >
                <Clock className="w-4 h-4 mr-2" /> Dates
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border" align="end">
                <Calendar
                  mode="single"
                  selected={card.due_date ? new Date(card.due_date) : undefined}
                  onSelect={(date) => {
                    updateDueDate.mutate(date || null);
                  }}
                  className="bg-popover border-none"
                />
                {card.due_date && (
                  <div className="p-3 border-t">
                    <Button
                      variant="destructive"
                      className="w-full text-xs h-8 cursor-pointer"
                      onClick={() => updateDueDate.mutate(null)}
                    >
                      Remove Date
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
