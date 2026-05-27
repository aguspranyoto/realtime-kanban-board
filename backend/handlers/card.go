package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
	"github.com/aguspranyoto/trello-clone/utils"
	"github.com/aguspranyoto/trello-clone/ws"
)

type CardHandler struct{
	Hub *ws.Hub
}

func NewCardHandler(hub *ws.Hub) *CardHandler { return &CardHandler{Hub: hub} }

type CreateCardRequest struct {
	ListID string `json:"list_id"`
	Name   string `json:"name"`
}

type UpdateCardRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Position    *int   `json:"position"`
	ListID      string `json:"list_id"`
	DueDate     string `json:"due_date"`
}

type MoveCardRequest struct {
	Cards []struct {
		ID       string `json:"id"`
		ListID   string `json:"list_id"`
		Position int    `json:"position"`
	} `json:"cards"`
}

func (h *CardHandler) Create(c *fiber.Ctx) error {
	var req CreateCardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Name == "" || req.ListID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name and list_id are required"})
	}
	listID, err := uuid.Parse(req.ListID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid list ID"})
	}
	var maxPos int
	database.DB.Model(&models.Card{}).Where("list_id = ?", listID).Select("COALESCE(MAX(position), -1)").Scan(&maxPos)
	card := models.Card{ListID: listID, Name: req.Name, Position: maxPos + 1}
	if result := database.DB.Create(&card); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create card"})
	}
	
	// Get board ID for broadcast
	var list models.List
	if err := database.DB.Select("board_id").First(&list, "id = ?", req.ListID).Error; err == nil {
		h.Hub.BroadcastToBoard(list.BoardID.String(), "card_created", card)
		userIDStr := c.Locals("userID").(string)
		userID, _ := uuid.Parse(userIDStr)
		utils.LogActivity(list.BoardID, &card.ID, userID, "create_card", "created card '"+card.Name+"'", h.Hub)
		
		// Run automation trigger
		utils.EvaluateOnCardCreated(card.ID, listID, h.Hub)
	}
	
	return c.Status(fiber.StatusCreated).JSON(card)
}

func (h *CardHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var card models.Card
	result := database.DB.
		Preload("Labels.Label").
		Preload("Members.User").
		Preload("Checklists.Items").
		Preload("Attachments.User").
		First(&card, "id = ?", id)
	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Card not found"})
	}

	// Rewrite old R2 public URLs
	if card.CoverURL != "" {
		card.CoverURL = rewriteR2URL(card.CoverURL)
	}
	for i := range card.Attachments {
		card.Attachments[i].URL = rewriteR2URL(card.Attachments[i].URL)
	}

	return c.JSON(card)
}

func (h *CardHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	var card models.Card
	if result := database.DB.First(&card, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Card not found"})
	}
	var req UpdateCardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	
	oldListID := card.ListID
	if req.Name != "" { card.Name = req.Name }
	if req.Description != "" { card.Description = req.Description }
	if req.Position != nil { card.Position = *req.Position }
	if req.ListID != "" {
		lid, _ := uuid.Parse(req.ListID)
		card.ListID = lid
	}
	if req.DueDate == "null" {
		card.DueDate = nil
	} else if req.DueDate != "" {
		if t, err := time.Parse(time.RFC3339, req.DueDate); err == nil {
			card.DueDate = &t
		}
	}
	database.DB.Save(&card)
	
	// Get board ID for broadcast
	var list models.List
	if err := database.DB.Select("board_id").First(&list, "id = ?", card.ListID).Error; err == nil {
		h.Hub.BroadcastToBoard(list.BoardID.String(), "card_updated", card)
		userIDStr := c.Locals("userID").(string)
		userID, _ := uuid.Parse(userIDStr)
		utils.LogActivity(list.BoardID, &card.ID, userID, "update_card", "updated card '"+card.Name+"'", h.Hub)
		
		// Run automation trigger if moved
		if req.ListID != "" && oldListID != card.ListID {
			utils.EvaluateOnCardMoved(card.ID, card.ListID, h.Hub)
		}
	}
	
	return c.JSON(card)
}

// MoveCards batch updates card positions and list assignments (for drag-and-drop).
func (h *CardHandler) MoveCards(c *fiber.Ctx) error {
	var req MoveCardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	for _, item := range req.Cards {
		var prevCard models.Card
		database.DB.Select("list_id").First(&prevCard, "id = ?", item.ID)

		database.DB.Model(&models.Card{}).Where("id = ?", item.ID).
			Updates(map[string]interface{}{"list_id": item.ListID, "position": item.Position})

		if prevCard.ListID.String() != item.ListID {
			cardID, _ := uuid.Parse(item.ID)
			destListID, _ := uuid.Parse(item.ListID)
			utils.EvaluateOnCardMoved(cardID, destListID, h.Hub)
		}
	}
	
	if len(req.Cards) > 0 {
		var list models.List
		if err := database.DB.Select("board_id").First(&list, "id = ?", req.Cards[0].ListID).Error; err == nil {
			h.Hub.BroadcastToBoard(list.BoardID.String(), "cards_moved", req.Cards)
		}
	}
	
	return c.JSON(fiber.Map{"message": "Cards moved successfully"})
}

func (h *CardHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	var card models.Card
	if result := database.DB.First(&card, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Card not found"})
	}
	database.DB.Delete(&card)
	
	var list models.List
	if err := database.DB.Select("board_id").First(&list, "id = ?", card.ListID).Error; err == nil {
		h.Hub.BroadcastToBoard(list.BoardID.String(), "card_deleted", id)
		userIDStr := c.Locals("userID").(string)
		userID, _ := uuid.Parse(userIDStr)
		utils.LogActivity(list.BoardID, nil, userID, "delete_card", "deleted card '"+card.Name+"'", h.Hub)
	}
	
	return c.JSON(fiber.Map{"message": "Card deleted successfully"})
}
