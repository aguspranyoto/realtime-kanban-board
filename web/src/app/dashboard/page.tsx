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
import { Plus, LayoutDashboard, LogOut, Settings, CalendarDays, Pencil, Trash } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { ModeToggle } from "@/components/mode-toggle";
import { ConfirmModal } from "@/components/confirm-modal";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, setUser, logout } = useAuthStore();
  const [wsName, setWsName] = useState("");
  const [wsDesc, setWsDesc] = useState("");
  const [boardName, setBoardName] = useState("");
  const [selectedWs, setSelectedWs] = useState<string | null>(null);
  const [wsDialogOpen, setWsDialogOpen] = useState(false);
  const [editWsDialogOpen, setEditWsDialogOpen] = useState(false);
  const [deleteWsDialogOpen, setDeleteWsDialogOpen] = useState(false);
  const [editWsName, setEditWsName] = useState("");
  const [editWsDesc, setEditWsDesc] = useState("");
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

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
      api.post<{ id: string }>("/api/workspaces", data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setSelectedWs(res.data.id);
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

  // Invite member mutation
  const inviteMember = useMutation({
    mutationFn: (data: { workspaceId: string; email: string }) =>
      api.post(`/api/workspaces/${data.workspaceId}/members`, { email: data.email }),
    onSuccess: () => {
      setInviteEmail("");
      setInviteDialogOpen(false);
      toast.success("Member invited successfully!");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to invite member");
    }
  });

  // Update workspace mutation
  const updateWs = useMutation({
    mutationFn: (data: { id: string; name: string; description: string }) =>
      api.put(`/api/workspaces/${data.id}`, { name: data.name, description: data.description }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setEditWsDialogOpen(false);
      toast.success("Workspace updated!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to update workspace");
    }
  });

  // Delete workspace mutation
  const deleteWs = useMutation({
    mutationFn: (id: string) => api.delete(`/api/workspaces/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setSelectedWs(null);
      setDeleteWsDialogOpen(false);
      setEditWsDialogOpen(false);
      toast.success("Workspace deleted!");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Failed to delete workspace");
    }
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
            <button
              onClick={() => router.push("/calendar")}
              className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </button>
            <ModeToggle />
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
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 cursor-pointer border ${
                    selectedWs === ws.id
                      ? "bg-secondary text-foreground border-border shadow-sm font-medium"
                      : "bg-card text-muted-foreground border-border hover:border-foreground/30 hover:bg-secondary/50 hover:text-foreground hover:shadow-sm"
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
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold text-foreground">
                      {workspaces.find((w) => w.id === selectedWs)?.name ||
                        "Boards"}
                    </h2>
                    {user?.id === workspaces.find((w) => w.id === selectedWs)?.owner_id && (
                      <>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 cursor-pointer" />
                            }
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="bg-popover border">
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => {
                                const ws = workspaces.find((w) => w.id === selectedWs);
                                if (ws) {
                                  setEditWsName(ws.name);
                                  setEditWsDesc(ws.description || "");
                                  setEditWsDialogOpen(true);
                                }
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive cursor-pointer"
                              onClick={() => setDeleteWsDialogOpen(true)}
                            >
                              <Trash className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <Dialog open={editWsDialogOpen} onOpenChange={setEditWsDialogOpen}>
                          <DialogContent className="bg-popover border">
                            <DialogHeader>
                              <DialogTitle>Edit Workspace</DialogTitle>
                              <DialogDescription>
                                Update your workspace details.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label>Name</Label>
                                <Input
                                  value={editWsName}
                                  onChange={(e) => setEditWsName(e.target.value)}
                                  placeholder="My Workspace"
                                />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Input
                                  value={editWsDesc}
                                  onChange={(e) => setEditWsDesc(e.target.value)}
                                  placeholder="Optional description"
                                />
                              </div>
                              <Button
                                onClick={() =>
                                  updateWs.mutate({ id: selectedWs!, name: editWsName, description: editWsDesc })
                                }
                                className="w-full cursor-pointer"
                                disabled={!editWsName || updateWs.isPending}
                              >
                                {updateWs.isPending ? "Saving..." : "Save Changes"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        <ConfirmModal
                          isOpen={deleteWsDialogOpen}
                          onOpenChange={setDeleteWsDialogOpen}
                          title="Delete Workspace"
                          textContent="Are you sure you want to delete this workspace? All boards inside it will be permanently deleted."
                          confirmText="Delete"
                          cancelText="Cancel"
                          onConfirm={() => deleteWs.mutate(selectedWs!)}
                          isConfirming={deleteWs.isPending}
                        />
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger
                        render={
                          <Button size="sm" variant="outline" className="cursor-pointer" />
                        }
                      >
                        Invite
                      </DialogTrigger>
                      <DialogContent className="bg-popover border">
                        <DialogHeader>
                          <DialogTitle>Invite to Workspace</DialogTitle>
                          <DialogDescription>
                            Enter the email address of the user you want to invite.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Email</Label>
                            <Input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="user@example.com"
                            />
                          </div>
                          <Button
                            onClick={() =>
                              inviteMember.mutate({
                                workspaceId: selectedWs!,
                                email: inviteEmail,
                              })
                            }
                            className="w-full cursor-pointer"
                            disabled={!inviteEmail || inviteMember.isPending}
                          >
                            {inviteMember.isPending ? "Inviting..." : "Invite"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

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
