"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import type { Notification } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => api.get("/api/notifications").then((r) => r.data),
    refetchInterval: 10000, // Poll every 10 seconds for real-time feel
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark single notification as read
  const markAsRead = useMutation({
    mutationFn: (id: string) => api.put(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: () => api.put("/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      markAsRead.mutate(notification.id);
    }

    // Redirect to card's board if available
    if (notification.card?.list?.board_id) {
      router.push(`/board/${notification.card.list.board_id}?cardId=${notification.card_id}`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="relative h-8 w-8 p-0 hover:bg-secondary cursor-pointer"
          />
        }
      >
        <Bell className="h-4 w-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-semibold text-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 bg-popover border shadow-xl rounded-xl">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-72">
          {notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors text-left ${
                    !notification.is_read ? "bg-secondary/20" : ""
                  }`}
                >
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarImage src={notification.actor?.avatar_url} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-[10px] font-bold">
                      {notification.actor?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs text-foreground leading-snug">
                      <span className="font-semibold">{notification.actor?.name}</span>{" "}
                      {notification.type === "due" && "notified you that a card is due soon:"}
                      {notification.type === "comment" && "commented on a card:"}
                      {notification.type === "assigned" && "assigned you to a card:"}
                      {notification.type === "mention" && "mentioned you on a card:"}
                      {notification.type === "workspace_invite" && "invited you to a workspace."}
                      {notification.card?.name && (
                        <span className="block font-medium mt-0.5 text-muted-foreground line-clamp-2">
                          {notification.card.name}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="flex items-center">
                      <div className="h-2 w-2 rounded-full bg-black" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <p className="text-xs text-muted-foreground">No notifications yet</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
