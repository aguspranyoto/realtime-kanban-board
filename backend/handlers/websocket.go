package handlers

import (
	"log"

	"github.com/aguspranyoto/trello-clone/ws"
	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

// WsHandler manages websocket connections
type WsHandler struct {
	Hub *ws.Hub
}

// NewWsHandler creates a new websocket handler
func NewWsHandler(hub *ws.Hub) *WsHandler {
	return &WsHandler{Hub: hub}
}

// Upgrade upgrades the HTTP connection to a WebSocket connection
func (h *WsHandler) Upgrade(c *fiber.Ctx) error {
	// Verify it's a websocket request
	if websocket.IsWebSocketUpgrade(c) {
		c.Locals("allowed", true)
		return c.Next()
	}
	return fiber.ErrUpgradeRequired
}

// HandleConnection handles the active websocket connection
func (h *WsHandler) HandleConnection(c *websocket.Conn) {
	boardID := c.Params("boardId")
	// userID could be extracted from a token passed via query param or headers, 
	// but for now we just use a generic connection.
	
	client := &ws.Client{
		Conn:    c,
		BoardID: boardID,
		UserID:  "anonymous", // Can be updated to parse JWT from query param
	}

	h.Hub.Register <- client
	defer func() {
		h.Hub.Unregister <- client
		c.Close()
	}()

	for {
		messageType, message, err := c.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket error: %v", err)
			}
			break
		}

		if messageType == websocket.TextMessage {
			// Right now we don't process incoming messages from the client.
			// But we could parse them here.
			log.Printf("Received message from client on board %s: %s", boardID, message)
		}
	}
}
