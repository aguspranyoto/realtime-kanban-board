package handlers

import (
	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type AutomationHandler struct{}

func NewAutomationHandler() *AutomationHandler {
	return &AutomationHandler{}
}

// GetRulesByBoard fetches all automation rules for a given board.
func (h *AutomationHandler) GetRulesByBoard(c *fiber.Ctx) error {
	boardIDStr := c.Params("boardId")
	boardID, err := uuid.Parse(boardIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid board ID"})
	}

	var rules []models.AutomationRule
	if err := database.DB.Where("board_id = ?", boardID).Order("created_at desc").Find(&rules).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch rules"})
	}

	return c.JSON(rules)
}

// CreateRule creates a new automation rule on the board.
func (h *AutomationHandler) CreateRule(c *fiber.Ctx) error {
	boardIDStr := c.Params("boardId")
	boardID, err := uuid.Parse(boardIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid board ID"})
	}

	userIDStr := c.Locals("userID").(string)
	userID, _ := uuid.Parse(userIDStr)

	var req struct {
		Name          string `json:"name"`
		Trigger       string `json:"trigger"`
		TriggerParams string `json:"trigger_params"`
		Action        string `json:"action"`
		ActionParams  string `json:"action_params"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" || req.Trigger == "" || req.Action == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name, trigger, and action are required"})
	}

	// Default empty JSON object strings if not provided
	if req.TriggerParams == "" {
		req.TriggerParams = "{}"
	}
	if req.ActionParams == "" {
		req.ActionParams = "{}"
	}

	rule := models.AutomationRule{
		BoardID:       boardID,
		CreatedBy:     userID,
		Name:          req.Name,
		Trigger:       req.Trigger,
		TriggerParams: req.TriggerParams,
		Action:        req.Action,
		ActionParams:  req.ActionParams,
		IsActive:      true,
	}

	if err := database.DB.Create(&rule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create rule"})
	}

	return c.Status(fiber.StatusCreated).JSON(rule)
}

// DeleteRule deletes an automation rule.
func (h *AutomationHandler) DeleteRule(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid rule ID"})
	}

	var rule models.AutomationRule
	if err := database.DB.First(&rule, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Rule not found"})
	}

	if err := database.DB.Delete(&rule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete rule"})
	}

	return c.JSON(fiber.Map{"message": "Rule deleted successfully"})
}

// ToggleRule enables or disables an automation rule.
func (h *AutomationHandler) ToggleRule(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid rule ID"})
	}

	var req struct {
		IsActive bool `json:"is_active"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var rule models.AutomationRule
	if err := database.DB.First(&rule, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Rule not found"})
	}

	rule.IsActive = req.IsActive
	if err := database.DB.Save(&rule).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update rule"})
	}

	return c.JSON(rule)
}
