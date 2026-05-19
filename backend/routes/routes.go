package routes

import (
	"github.com/gofiber/fiber/v2"

	"github.com/aguspranyoto/trello-clone/config"
	"github.com/aguspranyoto/trello-clone/handlers"
	"github.com/aguspranyoto/trello-clone/middleware"
	"github.com/aguspranyoto/trello-clone/ws"
	"github.com/gofiber/contrib/websocket"
)

// Setup registers all API routes on the Fiber app.
func Setup(app *fiber.App, cfg *config.Config, hub *ws.Hub) {
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

	// Protected routes
	protected := api.Group("", middleware.AuthMiddleware(cfg))
	protected.Get("/auth/me", auth.GetMe)
	protected.Post("/auth/logout", auth.Logout)

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
	protected.Put("/lists/:id", list.Update)
	protected.Put("/lists/reorder", list.Reorder)
	protected.Delete("/lists/:id", list.Delete)

	// Cards
	card := handlers.NewCardHandler(hub)
	protected.Post("/cards", card.Create)
	protected.Get("/cards/:id", card.GetByID)
	protected.Put("/cards/:id", card.Update)
	protected.Put("/cards/move", card.MoveCards)
	protected.Delete("/cards/:id", card.Delete)

	// Card Details (Labels & Checklists)
	protected.Post("/cards/:id/labels", card.AddLabelToCard)
	protected.Delete("/cards/:id/labels/:labelId", card.RemoveLabelFromCard)
	protected.Post("/cards/:id/checklists", card.AddChecklist)
	protected.Post("/checklists/:id/items", card.AddChecklistItem)
	protected.Put("/checklists/items/:id", card.UpdateChecklistItem)
	protected.Delete("/checklists/:id", card.DeleteChecklist)
}
