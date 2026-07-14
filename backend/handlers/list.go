package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/models"
	"github.com/aguspranyoto/realtime-kanban-board/ws"
)

type ListHandler struct{
	Hub *ws.Hub
}

func NewListHandler(hub *ws.Hub) *ListHandler { return &ListHandler{Hub: hub} }

type CreateListRequest struct {
	BoardID string `json:"board_id"`
	Name    string `json:"name"`
}

type UpdateListRequest struct {
	Name     string `json:"name"`
	Position *int   `json:"position"`
}

type ReorderListsRequest struct {
	Lists []struct {
		ID       string `json:"id"`
		Position int    `json:"position"`
	} `json:"lists"`
}

func (h *ListHandler) Create(c *fiber.Ctx) error {
	var req CreateListRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Name == "" || req.BoardID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name and board_id are required"})
	}
	boardID, err := uuid.Parse(req.BoardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid board ID"})
	}
	// Get the next position
	var maxPos int
	database.DB.Model(&models.List{}).Where("board_id = ?", boardID).Select("COALESCE(MAX(position), -1)").Scan(&maxPos)

	list := models.List{BoardID: boardID, Name: req.Name, Position: maxPos + 1}
	if result := database.DB.Create(&list); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create list"})
	}
	
	h.Hub.BroadcastToBoard(req.BoardID, "list_created", list)
	
	return c.Status(fiber.StatusCreated).JSON(list)
}

func (h *ListHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	var list models.List
	if result := database.DB.First(&list, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "List not found"})
	}
	var req UpdateListRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Name != "" { list.Name = req.Name }
	if req.Position != nil { list.Position = *req.Position }
	database.DB.Save(&list)
	
	h.Hub.BroadcastToBoard(list.BoardID.String(), "list_updated", list)
	
	return c.JSON(list)
}

func (h *ListHandler) Reorder(c *fiber.Ctx) error {
	var req ReorderListsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	for _, item := range req.Lists {
		database.DB.Model(&models.List{}).Where("id = ?", item.ID).Update("position", item.Position)
	}
	
	// Assuming all lists in a reorder request belong to the same board, find the board ID from the first list
	if len(req.Lists) > 0 {
		var list models.List
		if err := database.DB.Select("board_id").First(&list, "id = ?", req.Lists[0].ID).Error; err == nil {
			h.Hub.BroadcastToBoard(list.BoardID.String(), "lists_reordered", req.Lists)
		}
	}
	
	return c.JSON(fiber.Map{"message": "Lists reordered successfully"})
}

func (h *ListHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	var list models.List
	if result := database.DB.First(&list, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "List not found"})
	}
	var cardIDs []string
	database.DB.Model(&models.Card{}).Where("list_id = ?", list.ID).Pluck("id", &cardIDs)

	if len(cardIDs) > 0 {
		database.DB.Where("card_id IN ?", cardIDs).Delete(&models.Checklist{})
		database.DB.Where("card_id IN ?", cardIDs).Delete(&models.Attachment{})
		database.DB.Where("card_id IN ?", cardIDs).Delete(&models.Comment{})
		database.DB.Where("card_id IN ?", cardIDs).Delete(&models.CardMember{})
		database.DB.Where("card_id IN ?", cardIDs).Delete(&models.CardLabel{})
		database.DB.Where("id IN ?", cardIDs).Delete(&models.Card{})
	}
	database.DB.Delete(&list)
	
	h.Hub.BroadcastToBoard(list.BoardID.String(), "list_deleted", id)
	
	return c.JSON(fiber.Map{"message": "List deleted successfully"})
}
