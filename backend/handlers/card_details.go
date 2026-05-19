package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
)

// AddLabelToCard handles creating/attaching a label to a card
func (h *CardHandler) AddLabelToCard(c *fiber.Ctx) error {
	cardID := c.Params("id")
	cid, err := uuid.Parse(cardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid card ID"})
	}

	var req struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Find the board ID via the card's list
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Card not found"})
	}

	// Find or create label on the board
	var label models.Label
	if err := database.DB.Where("board_id = ? AND color = ? AND name = ?", card.List.BoardID, req.Color, req.Name).First(&label).Error; err != nil {
		// Create new label
		label = models.Label{
			BoardID: card.List.BoardID,
			Name:    req.Name,
			Color:   req.Color,
		}
		database.DB.Create(&label)
	}

	// Attach to card if not already attached
	var cardLabel models.CardLabel
	if err := database.DB.Where("card_id = ? AND label_id = ?", cid, label.ID).First(&cardLabel).Error; err != nil {
		cardLabel = models.CardLabel{CardID: cid, LabelID: label.ID}
		database.DB.Create(&cardLabel)
	}

	// Broadcast
	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)

	return c.JSON(label)
}

// RemoveLabelFromCard handles removing a label from a card
func (h *CardHandler) RemoveLabelFromCard(c *fiber.Ctx) error {
	cardID := c.Params("id")
	labelID := c.Params("labelId")

	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cardID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Card not found"})
	}

	database.DB.Where("card_id = ? AND label_id = ?", cardID, labelID).Delete(&models.CardLabel{})

	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)
	return c.JSON(fiber.Map{"message": "Label removed"})
}

// AddChecklist handles creating a new checklist on a card
func (h *CardHandler) AddChecklist(c *fiber.Ctx) error {
	cardID := c.Params("id")
	cid, err := uuid.Parse(cardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid card ID"})
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	checklist := models.Checklist{
		CardID: cid,
		Name:   req.Name,
	}
	database.DB.Create(&checklist)

	var card models.Card
	database.DB.Preload("List").First(&card, "id = ?", cid)
	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)

	return c.JSON(checklist)
}

// AddChecklistItem handles adding an item to a checklist
func (h *CardHandler) AddChecklistItem(c *fiber.Ctx) error {
	checklistID := c.Params("id")
	chid, _ := uuid.Parse(checklistID)

	var req struct {
		Name string `json:"name"`
	}
	c.BodyParser(&req)

	item := models.ChecklistItem{
		ChecklistID: chid,
		Name:        req.Name,
		IsChecked:   false,
	}
	database.DB.Create(&item)

	// Broadcast
	var checklist models.Checklist
	database.DB.First(&checklist, "id = ?", chid)
	var card models.Card
	database.DB.Preload("List").First(&card, "id = ?", checklist.CardID)
	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)

	return c.JSON(item)
}

// UpdateChecklistItem handles checking/unchecking a checklist item
func (h *CardHandler) UpdateChecklistItem(c *fiber.Ctx) error {
	itemID := c.Params("id")

	var req struct {
		IsChecked bool `json:"is_checked"`
	}
	c.BodyParser(&req)

	database.DB.Model(&models.ChecklistItem{}).Where("id = ?", itemID).Update("is_checked", req.IsChecked)

	// Broadcast
	var item models.ChecklistItem
	database.DB.First(&item, "id = ?", itemID)
	var checklist models.Checklist
	database.DB.First(&checklist, "id = ?", item.ChecklistID)
	var card models.Card
	database.DB.Preload("List").First(&card, "id = ?", checklist.CardID)
	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)

	return c.JSON(fiber.Map{"message": "Item updated"})
}

// DeleteChecklist handles deleting a checklist
func (h *CardHandler) DeleteChecklist(c *fiber.Ctx) error {
	id := c.Params("id")
	
	var checklist models.Checklist
	if err := database.DB.First(&checklist, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Checklist not found"})
	}
	
	// Delete items first
	database.DB.Where("checklist_id = ?", id).Delete(&models.ChecklistItem{})
	database.DB.Delete(&checklist)

	var card models.Card
	database.DB.Preload("List").First(&card, "id = ?", checklist.CardID)
	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)

	return c.JSON(fiber.Map{"message": "Checklist deleted"})
}
