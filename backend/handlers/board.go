package handlers

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
)

type BoardHandler struct{}

func NewBoardHandler() *BoardHandler {
	return &BoardHandler{}
}

type CreateBoardRequest struct {
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Background  string `json:"background"`
	Visibility  string `json:"visibility"`
}

type UpdateBoardRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Background  string `json:"background"`
	Visibility  string `json:"visibility"`
}

func (h *BoardHandler) Create(c *fiber.Ctx) error {
	var req CreateBoardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Name == "" || req.WorkspaceID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name and workspace_id are required"})
	}
	workspaceID, err := uuid.Parse(req.WorkspaceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid workspace ID"})
	}
	bg := req.Background
	if bg == "" {
		bg = "#1e3a5f"
	}
	vis := req.Visibility
	if vis == "" {
		vis = "workspace"
	}
	board := models.Board{
		WorkspaceID: workspaceID, Name: req.Name,
		Description: req.Description, Background: bg, Visibility: vis,
	}
	if result := database.DB.Create(&board); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create board"})
	}
	defaultLabels := []models.Label{
		{BoardID: board.ID, Name: "", Color: "#61bd4f"},
		{BoardID: board.ID, Name: "", Color: "#f2d600"},
		{BoardID: board.ID, Name: "", Color: "#ff9f1a"},
		{BoardID: board.ID, Name: "", Color: "#eb5a46"},
		{BoardID: board.ID, Name: "", Color: "#c377e0"},
		{BoardID: board.ID, Name: "", Color: "#0079bf"},
	}
	database.DB.Create(&defaultLabels)
	return c.Status(fiber.StatusCreated).JSON(board)
}

func (h *BoardHandler) GetByWorkspace(c *fiber.Ctx) error {
	wID := c.Params("workspaceId")
	var boards []models.Board
	database.DB.Where("workspace_id = ?", wID).Find(&boards)
	return c.JSON(boards)
}

func (h *BoardHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")
	var board models.Board
	result := database.DB.
		Preload("Lists", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC") }).
		Preload("Lists.Cards", func(db *gorm.DB) *gorm.DB { return db.Order("position ASC") }).
		Preload("Lists.Cards.Labels.Label").
		Preload("Lists.Cards.Members.User").
		Preload("Lists.Cards.Checklists.Items").
		Preload("Labels").
		First(&board, "id = ?", id)
	if result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Board not found"})
	}

	// Rewrite old R2 public URLs in card cover_url fields
	for i := range board.Lists {
		for j := range board.Lists[i].Cards {
			if board.Lists[i].Cards[j].CoverURL != "" {
				board.Lists[i].Cards[j].CoverURL = rewriteR2URL(board.Lists[i].Cards[j].CoverURL)
			}
		}
	}

	return c.JSON(board)
}

func (h *BoardHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	var board models.Board
	if result := database.DB.First(&board, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Board not found"})
	}
	var req UpdateBoardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.Name != "" { board.Name = req.Name }
	if req.Description != "" { board.Description = req.Description }
	if req.Background != "" { board.Background = req.Background }
	if req.Visibility != "" { board.Visibility = req.Visibility }
	database.DB.Save(&board)
	return c.JSON(board)
}

func (h *BoardHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	var board models.Board
	if result := database.DB.First(&board, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Board not found"})
	}
	database.DB.Delete(&board)
	return c.JSON(fiber.Map{"message": "Board deleted successfully"})
}
