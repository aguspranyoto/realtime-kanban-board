package routes

import (
	"github.com/gofiber/fiber/v2"

	"github.com/aguspranyoto/trello-clone/config"
	"github.com/aguspranyoto/trello-clone/handlers"
	"github.com/aguspranyoto/trello-clone/middleware"
	"github.com/aguspranyoto/trello-clone/storage"
	"github.com/aguspranyoto/trello-clone/ws"
	"github.com/gofiber/contrib/websocket"
)

// Setup registers all API routes on the Fiber app.
func Setup(app *fiber.App, cfg *config.Config, hub *ws.Hub, r2 *storage.R2Client) {
	api := app.Group("/api")

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "Trello Clone API is running"})
	})

	// Auth routes (public)
	auth := handlers.NewAuthHandler(cfg)
	api.Post("/auth/register", auth.Register)
	api.Post("/auth/login", auth.Login)
	api.Post("/auth/google", auth.GoogleCallback)

	// WebSocket route
	wsHandler := handlers.NewWsHandler(hub)
	api.Use("/ws", wsHandler.Upgrade)
	api.Get("/ws/board/:boardId", websocket.New(wsHandler.HandleConnection))

	// File proxy route (public – serves R2 files through the backend)
	fileProxy := handlers.NewFileProxyHandler(r2)
	api.Get("/files/*", fileProxy.Serve)

	// Protected routes
	protected := api.Group("", middleware.AuthMiddleware(cfg))
	protected.Get("/auth/me", auth.GetMe)
	protected.Post("/auth/logout", auth.Logout)

	// Notifications
	notificationHandler := handlers.NewNotificationHandler()
	protected.Get("/notifications", notificationHandler.GetNotifications)
	protected.Put("/notifications/:id/read", notificationHandler.MarkAsRead)
	protected.Put("/notifications/read-all", notificationHandler.MarkAllAsRead)

	// Workspaces
	ws := handlers.NewWorkspaceHandler()
	protected.Post("/workspaces", ws.Create)
	protected.Get("/workspaces", ws.GetAll)
	protected.Get("/workspaces/:id", ws.GetByID)
	protected.Put("/workspaces/:id", ws.Update)
	protected.Delete("/workspaces/:id", ws.Delete)

	// Boards
	board := handlers.NewBoardHandler()
	protected.Post("/boards", board.Create)
	protected.Get("/boards/workspace/:workspaceId", board.GetByWorkspace)
	protected.Get("/boards/:id", board.GetByID)
	protected.Put("/boards/:id", board.Update)
	protected.Delete("/boards/:id", board.Delete)

	// Lists
	list := handlers.NewListHandler(hub)
	protected.Post("/lists", list.Create)
	protected.Put("/lists/reorder", list.Reorder)
	protected.Put("/lists/:id", list.Update)
	protected.Delete("/lists/:id", list.Delete)

	// Cards
	card := handlers.NewCardHandler(hub)
	protected.Post("/cards", card.Create)
	protected.Put("/cards/move", card.MoveCards)
	protected.Get("/cards/:id", card.GetByID)
	protected.Put("/cards/:id", card.Update)
	protected.Delete("/cards/:id", card.Delete)

	// Card Details (Labels & Checklists)
	protected.Post("/cards/:id/labels", card.AddLabelToCard)
	protected.Delete("/cards/:id/labels/:labelId", card.RemoveLabelFromCard)
	protected.Post("/cards/:id/checklists", card.AddChecklist)
	protected.Post("/checklists/:id/items", card.AddChecklistItem)
	protected.Put("/checklists/items/:id", card.UpdateChecklistItem)
	protected.Delete("/checklists/:id", card.DeleteChecklist)

	// Comments
	protected.Post("/cards/:id/comments", card.AddComment)
	protected.Get("/cards/:id/comments", card.GetComments)
	protected.Delete("/comments/:commentId", card.DeleteComment)

	// Activities
	protected.Get("/boards/:id/activities", card.GetBoardActivities)
	protected.Get("/cards/:id/activities", card.GetCardActivities)

	// Attachments (Phase 7)
	attachment := handlers.NewAttachmentHandler(hub, r2)
	protected.Post("/cards/:id/attachments", attachment.Upload)
	protected.Get("/cards/:id/attachments", attachment.GetAll)
	protected.Delete("/attachments/:id", attachment.Delete)
	protected.Put("/attachments/:id/cover", attachment.SetCover)
	protected.Delete("/cards/:id/cover", attachment.RemoveCover)

	// Automation Rules (Phase 8)
	automation := handlers.NewAutomationHandler()
	protected.Get("/boards/:boardId/rules", automation.GetRulesByBoard)
	protected.Post("/boards/:boardId/rules", automation.CreateRule)
	protected.Delete("/rules/:id", automation.DeleteRule)
	protected.Put("/rules/:id/toggle", automation.ToggleRule)
}
