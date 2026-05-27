import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  CalendarIcon,
  Tag,
  CheckSquare,
  Clock,
  AlignLeft,
  X,
  MessageSquare,
  Paperclip,
  Image,
  FileText,
  Trash2,
  ExternalLink,
} from "lucide-react";

import api from "@/lib/api";
import type { Card, Comment as CommentType, Attachment } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function CardModal({ card, isOpen, onClose, boardId, listName }: CardModalProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [desc, setDesc] = useState(card?.description || "");
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3b82f6");
  const [newChecklistName, setNewChecklistName] = useState("");
  const [newItemNames, setNewItemNames] = useState<Record<string, string>>({});
  const [newCommentText, setNewCommentText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when card changes
  if (card && card.description !== desc && !isEditingDesc) {
    setDesc(card.description || "");
  }

  const invalidateBoard = () => {
    queryClient.invalidateQueries({ queryKey: ["board", boardId] });
  };

  // Fetch card comments
  const { data: comments = [] } = useQuery<CommentType[]>({
    queryKey: ["card-comments", card?.id],
    queryFn: () => api.get(`/api/cards/${card?.id}/comments`).then((r) => r.data),
    enabled: !!card?.id,
  });

  // Fetch card attachments
  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: ["card-attachments", card?.id],
    queryFn: () => api.get(`/api/cards/${card?.id}/attachments`).then((r) => r.data),
    enabled: !!card?.id,
  });

  // Post comment
  const addComment = useMutation({
    mutationFn: (text: string) => api.post(`/api/cards/${card?.id}/comments`, { text }),
    onSuccess: () => {
      setNewCommentText("");
      queryClient.invalidateQueries({ queryKey: ["card-comments", card?.id] });
      invalidateBoard();
      toast.success("Comment posted");
    },
  });

  // Delete comment
  const deleteComment = useMutation({
    mutationFn: (commentId: string) => api.delete(`/api/comments/${commentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-comments", card?.id] });
      invalidateBoard();
      toast.success("Comment deleted");
    },
  });

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

  // Delete attachment
  const deleteAttachment = useMutation({
    mutationFn: (id: string) => api.delete(`/api/attachments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-attachments", card?.id] });
      invalidateBoard();
      toast.success("Attachment deleted");
    },
  });

  // Set cover
  const setCover = useMutation({
    mutationFn: (id: string) => api.put(`/api/attachments/${id}/cover`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-attachments", card?.id] });
      invalidateBoard();
      toast.success("Cover set");
    },
  });

  // Remove cover
  const removeCover = useMutation({
    mutationFn: () => api.delete(`/api/cards/${card?.id}/cover`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card-attachments", card?.id] });
      invalidateBoard();
      toast.success("Cover removed");
    },
  });

  // Upload file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !card) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      await api.post(`/api/cards/${card.id}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      queryClient.invalidateQueries({ queryKey: ["card-attachments", card.id] });
      invalidateBoard();
      toast.success("File uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!card) return null;

  const coverAttachment = attachments.find((a) => a.is_cover);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-3xl sm:max-w-3xl bg-popover border max-h-[90vh] overflow-y-auto p-0">
        {/* Cover Image */}
        {(card.cover_url || coverAttachment?.url) && (
          <div className="relative w-full h-40 overflow-hidden rounded-t-lg">
            <img
              src={card.cover_url || coverAttachment?.url}
              alt="Card cover"
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => removeCover.mutate()}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors cursor-pointer"
              title="Remove cover"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="p-6">
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

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Paperclip className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-semibold text-foreground">Attachments</h3>
                  </div>
                  <div className="space-y-3">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg border group hover:border-border/80 transition-colors">
                        {/* Thumbnail or icon */}
                        {isImageMime(att.mime_type) ? (
                          <div className="w-14 h-10 rounded overflow-hidden flex-shrink-0 bg-border">
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-14 h-10 rounded bg-border flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatFileSize(att.size)} · Added {formatDistanceToNow(new Date(att.created_at), { addSuffix: true })}
                          </p>
                          <div className="flex gap-3 mt-1.5">
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" /> Open
                            </a>
                            {isImageMime(att.mime_type) && !att.is_cover && (
                              <button
                                onClick={() => setCover.mutate(att.id)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Image className="w-3 h-3" /> Make cover
                              </button>
                            )}
                            {att.is_cover && (
                              <span className="text-xs text-primary flex items-center gap-1">
                                <Image className="w-3 h-3" /> Cover
                              </span>
                            )}
                            <button
                              onClick={() => deleteAttachment.mutate(att.id)}
                              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div className="mt-8 border-t pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-5 h-5 text-muted-foreground" />
                  <h3 className="text-lg font-semibold text-foreground">Comments</h3>
                </div>

                {/* Add Comment Input */}
                <div className="flex gap-3 mb-6">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <textarea
                      placeholder="Write a comment..."
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      className="w-full bg-card border rounded-md p-2 text-sm text-foreground focus:outline-none min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      disabled={!newCommentText.trim() || addComment.isPending}
                      onClick={() => addComment.mutate(newCommentText.trim())}
                      className="cursor-pointer"
                    >
                      {addComment.isPending ? "Posting..." : "Comment"}
                    </Button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length > 0 ? (
                    comments.map((comm) => (
                      <div key={comm.id} className="flex gap-3 text-sm">
                        <Avatar className="h-8 w-8 mt-0.5">
                          <AvatarImage src={comm.user?.avatar_url} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-bold">
                            {comm.user?.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">{comm.user?.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(comm.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            {user && comm.user_id === user.id && (
                              <button
                                onClick={() => deleteComment.mutate(comm.id)}
                                className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <p className="bg-muted p-2 rounded-md text-foreground whitespace-pre-wrap leading-relaxed">
                            {comm.text}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      No comments yet. Write a comment above to get started!
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="col-span-1 space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Add to card</h3>

              {/* Attachment Upload */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                />
                <Button
                  variant="outline"
                  className="w-full justify-start cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  id="btn-add-attachment"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Attachment"}
                </Button>
              </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
