package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gofiber/contrib/websocket"
)

// Message represents a websocket message structure
type Message struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

// Client represents a connected websocket client
type Client struct {
	Conn    *websocket.Conn
	BoardID string
	UserID  string
	mu      sync.Mutex
}

// WriteMessage provides thread-safe writing to the websocket connection
func (c *Client) WriteMessage(messageType int, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.Conn.WriteMessage(messageType, data)
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
	mu         sync.Mutex
}

// NewHub creates a new Hub instance
func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Run starts the hub loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("Client connected to board %s. Total clients: %d", client.BoardID, len(h.clients))
		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Conn.Close()
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			// Just a general broadcast if needed
			h.mu.Lock()
			for client := range h.clients {
				if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
					client.Conn.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// BroadcastToBoard sends a message to all clients connected to a specific board
func (h *Hub) BroadcastToBoard(boardID string, messageType string, payload interface{}) {
	msg := Message{
		Type:    messageType,
		Payload: payload,
	}
	
	bytes, err := json.Marshal(msg)
	if err != nil {
		log.Println("Error marshalling broadcast message:", err)
		return
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	for client := range h.clients {
		if client.BoardID == boardID {
			if err := client.WriteMessage(websocket.TextMessage, bytes); err != nil {
				client.Conn.Close()
				delete(h.clients, client)
			}
		}
	}
}
