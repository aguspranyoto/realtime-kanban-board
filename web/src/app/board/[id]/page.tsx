"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Board, List, Card as CardType, Activity as ActivityType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ArrowLeft, Plus, X, MoreHorizontal, Trash2, History } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notification-bell";
import { CardModal } from "@/components/card-modal";
import { formatDistanceToNow } from "date-fns";

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [addingListId, setAddingListId] = useState<string | null>(null);
  const [newCardName, setNewCardName] = useState("");
  const [addingNewList, setAddingNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Parse cardId from URL parameter for direct card modal links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cardIdParam = params.get("cardId");
    if (cardIdParam) {
      setSelectedCardId(cardIdParam);
    }
  }, []);

  // Fetch board with all data
  const { data: board } = useQuery<Board>({
    queryKey: ["board", id],
    queryFn: () => api.get(`/api/boards/${id}`).then((r) => r.data),
  });

  // Fetch board activities
  const { data: activities = [] } = useQuery<ActivityType[]>({
    queryKey: ["board-activities", id],
    queryFn: () => api.get(`/api/boards/${id}/activities`).then((r) => r.data),
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Determine WS protocol based on window location
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, "")
      : "localhost:8080";
    
    const ws = new WebSocket(`${protocol}//${host}/api/ws/board/${id}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Only invalidate if the event type is one of the mutations we care about
        const updateEvents = ["list_created", "list_updated", "list_deleted", "lists_reordered", "card_created", "card_updated", "card_deleted", "cards_moved"];
        if (updateEvents.includes(data.type)) {
          // You could optimize this to apply optimistic updates based on data.payload
          // For now, we'll just invalidate the cache to refetch the board data
          queryClient.invalidateQueries({ queryKey: ["board", id] });
        }
        if (data.type === "activity_logged") {
          queryClient.invalidateQueries({ queryKey: ["board-activities", id] });
        }
        if (data.type === "comment_added") {
          queryClient.invalidateQueries({ queryKey: ["board-activities", id] });
          if (data.payload?.card_id) {
            queryClient.invalidateQueries({ queryKey: ["card-comments", data.payload.card_id] });
          }
        }
        if (data.type === "comment_deleted") {
          queryClient.invalidateQueries({ queryKey: ["board-activities", id] });
          if (data.payload?.card_id) {
            queryClient.invalidateQueries({ queryKey: ["card-comments", data.payload.card_id] });
          }
        }
      } catch (err) {
        console.error("Failed to parse websocket message", err);
      }
    };

    return () => {
      ws.close();
    };
  }, [id, queryClient]);

  // Create list
  const createList = useMutation({
    mutationFn: (data: { board_id: string; name: string }) =>
      api.post("/api/lists", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", id] });
      setNewListName("");
      setAddingNewList(false);
      toast.success("List created!");
    },
  });

  // Create card
  const createCard = useMutation({
    mutationFn: (data: { list_id: string; name: string }) =>
      api.post("/api/cards", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", id] });
      setNewCardName("");
      setAddingListId(null);
      toast.success("Card created!");
    },
  });

  // Delete list
  const deleteList = useMutation({
    mutationFn: (listId: string) => api.delete(`/api/lists/${listId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", id] });
      toast.success("List deleted!");
    },
  });

  // Move cards (drag-and-drop)
  const moveCards = useMutation({
    mutationFn: (data: { cards: { id: string; list_id: string; position: number }[] }) =>
      api.put("/api/cards/move", data),
  });

  // Reorder lists
  const reorderLists = useMutation({
    mutationFn: (data: { lists: { id: string; position: number }[] }) =>
      api.put("/api/lists/reorder", data),
  });

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || !board?.lists) return;

    const { source, destination, type } = result;

    if (type === "list") {
      // Reorder lists
      const newLists = Array.from(board.lists);
      const [moved] = newLists.splice(source.index, 1);
      newLists.splice(destination.index, 0, moved);

      // Optimistic update
      queryClient.setQueryData(["board", id], {
        ...board,
        lists: newLists.map((l, i) => ({ ...l, position: i })),
      });

      reorderLists.mutate({
        lists: newLists.map((l, i) => ({ id: l.id, position: i })),
      });
      return;
    }

    // Move card
    const sourceList = board.lists.find((l) => l.id === source.droppableId);
    const destList = board.lists.find((l) => l.id === destination.droppableId);
    if (!sourceList?.cards || !destList) return;

    const sourceCards = Array.from(sourceList.cards);
    const [movedCard] = sourceCards.splice(source.index, 1);

    if (source.droppableId === destination.droppableId) {
      // Same list reorder
      sourceCards.splice(destination.index, 0, movedCard);
      const updatedLists = board.lists.map((l) =>
        l.id === sourceList.id
          ? { ...l, cards: sourceCards.map((c, i) => ({ ...c, position: i })) }
          : l
      );
      queryClient.setQueryData(["board", id], { ...board, lists: updatedLists });
      moveCards.mutate({
        cards: sourceCards.map((c, i) => ({ id: c.id, list_id: sourceList.id, position: i })),
      });
    } else {
      // Cross-list move
      const destCards = Array.from(destList.cards || []);
      destCards.splice(destination.index, 0, { ...movedCard, list_id: destList.id });

      const updatedLists = board.lists.map((l) => {
        if (l.id === sourceList.id) return { ...l, cards: sourceCards.map((c, i) => ({ ...c, position: i })) };
        if (l.id === destList.id) return { ...l, cards: destCards.map((c, i) => ({ ...c, position: i })) };
        return l;
      });
      queryClient.setQueryData(["board", id], { ...board, lists: updatedLists });

      const allCards = [
        ...sourceCards.map((c, i) => ({ id: c.id, list_id: sourceList.id, position: i })),
        ...destCards.map((c, i) => ({ id: c.id, list_id: destList.id, position: i })),
      ];
      moveCards.mutate({ cards: allCards });
    }
  };

  if (!board) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading board...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: board.background }}>
      {/* Board Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="text-white hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">{board.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="bg-white/10 hover:bg-white/20 rounded-lg p-0.5 text-white">
            <NotificationBell />
          </div>

          {/* Activity Drawer */}
          <Sheet>
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 cursor-pointer"
                />
              }
            >
              <History className="h-4 w-4 mr-1" /> Activity
            </SheetTrigger>
            <SheetContent className="bg-popover border text-foreground w-80 sm:w-96">
              <SheetHeader className="border-b pb-3">
                <SheetTitle className="text-foreground">Board Activity</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-80px)] mt-4">
                <div className="space-y-4 pr-3">
                  {activities.length > 0 ? (
                    activities.map((act) => (
                      <div key={act.id} className="flex gap-3 text-sm">
                        <Avatar className="h-7 w-7 mt-0.5">
                          <AvatarImage src={act.user?.avatar_url} />
                          <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-bold">
                            {act.user?.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-0.5">
                          <p className="text-xs">
                            <span className="font-semibold text-foreground">
                              {act.user?.name}
                            </span>{" "}
                            <span className="text-muted-foreground">{act.details}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-10">
                      No activity logged yet.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Board Canvas */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="list">
          {(provided) => (
            <ScrollArea className="flex-1">
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex gap-4 p-4 items-start min-h-[calc(100vh-60px)]"
              >
                {board.lists
                  ?.sort((a, b) => a.position - b.position)
                  .map((list, index) => (
                    <Draggable key={list.id} draggableId={list.id} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="w-72 shrink-0"
                        >
                          {/* List */}
                          <div className="bg-card/90 backdrop-blur rounded-xl border shadow-lg">
                            {/* List Header */}
                            <div
                              {...provided.dragHandleProps}
                              className="flex items-center justify-between px-3 py-2.5"
                            >
                              <h3 className="font-semibold text-sm text-foreground">{list.name}</h3>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={<Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer" />}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-popover border">
                                  <DropdownMenuItem
                                    onClick={() => deleteList.mutate(list.id)}
                                    className="text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete List
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Cards */}
                            <Droppable droppableId={list.id} type="card">
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`px-2 pb-2 min-h-[8px] space-y-2 transition-colors ${
                                    snapshot.isDraggingOver ? "bg-muted rounded-lg" : ""
                                  }`}
                                >
                                  {list.cards
                                    ?.sort((a, b) => a.position - b.position)
                                    .map((card, cardIndex) => (
                                      <Draggable key={card.id} draggableId={card.id} index={cardIndex}>
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            onClick={() => setSelectedCardId(card.id)}
                                            className={`bg-card border rounded-lg px-3 py-2 text-sm text-foreground hover:border-foreground/50 cursor-pointer transition-all ${
                                              snapshot.isDragging ? "shadow-xl shadow-black/20 rotate-2" : ""
                                            }`}
                                          >
                                            {/* Labels */}
                                            {card.labels && card.labels.length > 0 && (
                                              <div className="flex gap-1 mb-1.5">
                                                {card.labels.map((cl) => (
                                                  <div
                                                    key={cl.id}
                                                    className="h-2 w-8 rounded-full"
                                                    style={{ backgroundColor: cl.label?.color }}
                                                  />
                                                ))}
                                              </div>
                                            )}
                                            {card.name}
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>

                            {/* Add Card */}
                            <div className="px-2 pb-2">
                              {addingListId === list.id ? (
                                <div className="space-y-2">
                                  <Input
                                    autoFocus
                                    value={newCardName}
                                    onChange={(e) => setNewCardName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && newCardName.trim()) {
                                        createCard.mutate({ list_id: list.id, name: newCardName.trim() });
                                      }
                                      if (e.key === "Escape") { setAddingListId(null); setNewCardName(""); }
                                    }}
                                    placeholder="Enter card title..."
                                    className="text-sm"
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      className="cursor-pointer"
                                      onClick={() => {
                                        if (newCardName.trim()) createCard.mutate({ list_id: list.id, name: newCardName.trim() });
                                      }}
                                    >
                                      Add Card
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => { setAddingListId(null); setNewCardName(""); }}
                                      className="cursor-pointer"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                                  onClick={() => { setAddingListId(list.id); setNewCardName(""); }}
                                >
                                  <Plus className="h-4 w-4 mr-1" /> Add a card
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                {provided.placeholder}

                {/* Add New List */}
                <div className="w-72 shrink-0">
                  {addingNewList ? (
                    <div className="bg-card/90 backdrop-blur rounded-xl border p-3 space-y-2">
                      <Input
                        autoFocus
                        value={newListName}
                        onChange={(e) => setNewListName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newListName.trim()) {
                            createList.mutate({ board_id: id, name: newListName.trim() });
                          }
                          if (e.key === "Escape") { setAddingNewList(false); setNewListName(""); }
                        }}
                        placeholder="Enter list title..."
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => {
                            if (newListName.trim()) createList.mutate({ board_id: id, name: newListName.trim() });
                          }}
                        >
                          Add List
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setAddingNewList(false); setNewListName(""); }}
                          className="cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      className="w-full justify-start bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-xl cursor-pointer"
                      onClick={() => setAddingNewList(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add another list
                    </Button>
                  )}
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </Droppable>
      </DragDropContext>

      {/* Card Modal */}
      <CardModal
        card={
          board?.lists
            ?.flatMap((l) => l.cards || [])
            .find((c) => c.id === selectedCardId) || null
        }
        listName={
          board?.lists?.find((l) => l.cards?.some((c) => c.id === selectedCardId))?.name || "Unknown List"
        }
        isOpen={!!selectedCardId}
        onClose={() => setSelectedCardId(null)}
        boardId={id}
      />
    </div>
  );
}
