"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import type { Workspace, Board, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser, logout } = useAuthStore();
  const [wsName, setWsName] = useState("");
  const [wsDesc, setWsDesc] = useState("");
  const [boardName, setBoardName] = useState("");
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);

  // Fetch current user on mount
  useEffect(() => {
    if (!user) {
      api
        .get<User>("/api/auth/me")
        .then((res) => setUser(res.data))
        .catch(() => router.push("/"));
    }
  }, [user, setUser, router]);

  // Fetch workspaces
  const { data: workspaces = [] } = useQuery<Workspace[]>({
    queryKey: ["workspaces"],
    queryFn: () => api.get("/api/workspaces").then((r) => r.data),
    enabled: !!user,
  });

  // Fetch boards for selected workspace
  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ["boards", selectedWs],
    queryFn: () =>
      api.get(`/api/boards/workspace/${selectedWs}`).then((r) => r.data),
    enabled: !!selectedWs,
  });

  // Create workspace mutation
  const createWs = useMutation({
    mutationFn: (data: { name: string; description: string }) =>
      api.post("/api/workspaces", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setWsName("");
      setWsDesc("");
      setWsDialogOpen(false);
      toast.success("Workspace created!");
    },
  });

  // Create board mutation
  const createBoard = useMutation({
    mutationFn: (data: { workspace_id: string; name: string }) =>
      api.post("/api/boards", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boards", selectedWs] });
      setBoardName("");
      setBoardDialogOpen(false);
      toast.success("Board created!");
    },
  });

  const handleLogout = async () => {
    await api.post("/api/auth/logout");
    logout();
    router.push("/");
  };

  // Auto-select first workspace
  useEffect(() => {
    if (workspaces.length > 0 && !selectedWs) {
      setSelectedWs(workspaces[0].id);
    }
  }, [workspaces, selectedWs]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="h-5 w-5 text-foreground" />
            <span className="text-lg font-semibold text-foreground">
              Trello Clone
            </span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    className="flex items-center gap-2 cursor-pointer"
                  />
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
              <DropdownMenuContent
                align="end"
                className="bg-popover border"
              >
                <DropdownMenuItem className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Workspaces */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Workspaces</h2>
              <Dialog open={wsDialogOpen} onOpenChange={setWsDialogOpen}>
                <DialogTrigger
                  render={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 cursor-pointer"
                    />
                  }
                >
                  <Plus className="h-4 w-4" />
                </DialogTrigger>
                <DialogContent className="bg-popover border">
                  <DialogHeader>
                    <DialogTitle>Create Workspace</DialogTitle>
                    <DialogDescription>
                      A workspace holds all your boards and team members.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="My Workspace"
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={wsDesc}
                        onChange={(e) => setWsDesc(e.target.value)}
                        placeholder="Optional description"
                      />
                    </div>
                    <Button
                      onClick={() =>
                        createWs.mutate({ name: wsName, description: wsDesc })
                      }
                      className="w-full cursor-pointer"
                      disabled={!wsName || createWs.isPending}
                    >
                      {createWs.isPending ? "Creating..." : "Create Workspace"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWs(ws.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                    selectedWs === ws.id
                      ? "bg-secondary text-foreground border"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {ws.name}
                </button>
              ))}
              {workspaces.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No workspaces yet. Create one to get started!
                </p>
              )}
            </div>
          </div>

          {/* Main Content: Boards */}
          <div className="lg:col-span-3 space-y-6">
            {selectedWs ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">
                    {workspaces.find((w) => w.id === selectedWs)?.name ||
                      "Boards"}
                  </h2>
                  <Dialog
                    open={boardDialogOpen}
                    onOpenChange={setBoardDialogOpen}
                  >
                    <DialogTrigger
                      render={
                        <Button
                          size="sm"
                          className="cursor-pointer"
                        />
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" /> New Board
                    </DialogTrigger>
                    <DialogContent className="bg-popover border">
                      <DialogHeader>
                        <DialogTitle>Create Board</DialogTitle>
                        <DialogDescription>
                          Add a new board to organize your tasks.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Board Name</Label>
                          <Input
                            value={boardName}
                            onChange={(e) => setBoardName(e.target.value)}
                            placeholder="My Board"
                          />
                        </div>
                        <Button
                          onClick={() =>
                            createBoard.mutate({
                              workspace_id: selectedWs!,
                              name: boardName,
                            })
                          }
                          className="w-full cursor-pointer"
                          disabled={!boardName || createBoard.isPending}
                        >
                          {createBoard.isPending
                            ? "Creating..."
                            : "Create Board"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {boards.map((board) => (
                    <Card
                      key={board.id}
                      className="group cursor-pointer border bg-card hover:border-foreground/50 hover:shadow-lg transition-all duration-200"
                      onClick={() => router.push(`/board/${board.id}`)}
                    >
                      <div
                        className="h-24 rounded-t-xl"
                        style={{ background: board.background }}
                      />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base group-hover:text-foreground transition-colors">
                          {board.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <p className="text-xs text-muted-foreground">
                          {board.description || "No description"}
                        </p>
                      </CardContent>
                    </Card>
                  ))}

                  {boards.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      <p>No boards yet. Create your first board!</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-20 text-muted-foreground">
                <LayoutDashboard className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg">
                  Select or create a workspace to see your boards
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
