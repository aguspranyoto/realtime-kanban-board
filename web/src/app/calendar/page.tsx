"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutDashboard, LogOut, Settings, Clock } from "lucide-react";

import api from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type { Workspace, Board, List, Card, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notification-bell";
import { ModeToggle } from "@/components/mode-toggle";
import { CardModal } from "@/components/card-modal";
import { Badge } from "@/components/ui/badge";

// Represents a card enriched with its board/list context
interface ScheduledCard {
  card: Card;
  boardId: string;
  boardName: string;
  listName: string;
  dueDate: Date;
}

// Fetch all boards for all workspaces, then all lists with cards
async function fetchAllScheduledCards(): Promise<ScheduledCard[]> {
  const workspacesRes = await api.get<Workspace[]>("/api/workspaces");
  const workspaces: Workspace[] = workspacesRes.data;

  const scheduled: ScheduledCard[] = [];

  await Promise.all(
    workspaces.map(async (ws) => {
      const boardsRes = await api.get<Board[]>(`/api/boards/workspace/${ws.id}`);
      const boards: Board[] = boardsRes.data;

      await Promise.all(
        boards.map(async (board) => {
          const boardRes = await api.get<Board & { lists?: (List & { cards?: Card[] })[] }>(
            `/api/boards/${board.id}`
          );
          const fullBoard = boardRes.data;
          const lists = fullBoard.lists || [];

          for (const list of lists) {
            for (const card of list.cards || []) {
              if (card.due_date) {
                scheduled.push({
                  card,
                  boardId: board.id,
                  boardName: board.name,
                  listName: list.name,
                  dueDate: parseISO(card.due_date),
                });
              }
            }
          }
        })
      );
    })
  );

  return scheduled;
}

export default function CalendarPage() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCard, setSelectedCard] = useState<{ card: Card; boardId: string; listName: string } | null>(null);

  useEffect(() => {
    if (!user) {
      api
        .get<User>("/api/auth/me")
        .then((res) => setUser(res.data))
        .catch(() => router.push("/"));
    }
  }, [user, setUser, router]);

  const { data: scheduledCards = [], isLoading } = useQuery<ScheduledCard[]>({
    queryKey: ["calendar-cards"],
    queryFn: fetchAllScheduledCards,
    enabled: !!user,
    staleTime: 30_000,
  });

  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    logout();
    router.push("/");
  };

  // Build a map: "yyyy-MM-dd" -> ScheduledCard[]
  const cardsByDate = useMemo(() => {
    const map = new Map<string, ScheduledCard[]>();
    for (const sc of scheduledCards) {
      const key = format(sc.dueDate, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(sc);
    }
    return map;
  }, [scheduledCards]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  if (!user) return null;

  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-sm">Dashboard</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <CalendarDays className="h-5 w-5" />
              <span>Calendar</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ModeToggle />
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" className="flex items-center gap-2 cursor-pointer" />
                }
              >
                <Avatar className="h-7 w-7">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    {user.name?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline text-sm text-foreground">{user.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border">
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {format(currentDate, "MMMM yyyy")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {scheduledCards.length} card{scheduledCards.length !== 1 ? "s" : ""} with due dates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="cursor-pointer text-xs"
              id="btn-calendar-today"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="h-8 w-8 cursor-pointer"
              id="btn-calendar-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="h-8 w-8 cursor-pointer"
              id="btn-calendar-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {weekdays.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-3 uppercase tracking-wide">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center space-y-2">
                <CalendarDays className="h-10 w-10 mx-auto animate-pulse opacity-40" />
                <p className="text-sm">Loading calendar...</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayCards = cardsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                const _isToday = isToday(day);

                return (
                  <div
                    key={idx}
                    className={`min-h-[120px] p-2 border-b border-r relative transition-colors ${
                      isCurrentMonth ? "bg-card" : "bg-muted/20"
                    } ${idx % 7 === 6 ? "border-r-0" : ""}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                          _isToday
                            ? "bg-foreground text-background font-bold"
                            : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                        }`}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    {/* Cards due on this day */}
                    <div className="space-y-1">
                      {dayCards.slice(0, 3).map(({ card, boardId, boardName, listName }) => (
                        <button
                          key={card.id}
                          onClick={() => setSelectedCard({ card, boardId, listName })}
                          className="w-full text-left group cursor-pointer"
                          title={`${card.name} · ${boardName}`}
                        >
                          <div className="flex items-start gap-1.5 bg-muted hover:bg-accent border hover:border-foreground/30 rounded-md px-1.5 py-1 transition-all duration-150">
                            <Clock className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate leading-tight">
                                {card.name}
                              </p>
                              <p className="text-[9px] text-muted-foreground truncate">
                                {boardName}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                      {dayCards.length > 3 && (
                        <p className="text-[10px] text-muted-foreground pl-1">
                          +{dayCards.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming / Overdue Cards List */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming this month */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Due This Month
            </h2>
            <div className="space-y-2">
              {scheduledCards
                .filter((sc) => isSameMonth(sc.dueDate, currentDate))
                .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
                .slice(0, 10)
                .map(({ card, boardId, boardName, listName, dueDate }) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard({ card, boardId, listName })}
                    className="w-full text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 p-3 bg-card border rounded-lg hover:border-foreground/40 hover:bg-muted transition-all">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          dueDate < new Date() ? "bg-destructive" : "bg-primary"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{card.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{boardName} · {listName}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs flex-shrink-0 ${
                          dueDate < new Date() ? "border-destructive/50 text-destructive" : ""
                        }`}
                      >
                        {format(dueDate, "MMM d")}
                      </Badge>
                    </div>
                  </button>
                ))}
              {scheduledCards.filter((sc) => isSameMonth(sc.dueDate, currentDate)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No cards due this month.
                </p>
              )}
            </div>
          </div>

          {/* Overdue */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-destructive" />
              Overdue
            </h2>
            <div className="space-y-2">
              {scheduledCards
                .filter((sc) => sc.dueDate < new Date() && !isToday(sc.dueDate))
                .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
                .slice(0, 10)
                .map(({ card, boardId, boardName, listName, dueDate }) => (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard({ card, boardId, listName })}
                    className="w-full text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 p-3 bg-card border border-destructive/20 rounded-lg hover:border-destructive/50 hover:bg-destructive/5 transition-all">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-destructive" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{card.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{boardName} · {listName}</p>
                      </div>
                      <Badge variant="destructive" className="text-xs flex-shrink-0">
                        {format(dueDate, "MMM d")}
                      </Badge>
                    </div>
                  </button>
                ))}
              {scheduledCards.filter((sc) => sc.dueDate < new Date() && !isToday(sc.dueDate)).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No overdue cards. 🎉
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Modal */}
      {selectedCard && (
        <CardModal
          card={selectedCard.card}
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          boardId={selectedCard.boardId}
          listName={selectedCard.listName}
        />
      )}
    </div>
  );
}
