package handlers

import (
	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
	"github.com/aguspranyoto/trello-clone/utils"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

// AddComment handles creating a new comment on a card.
func (h *CardHandler) AddComment(c *fiber.Ctx) error {
	cardID := c.Params("id")
	cid, err := uuid.Parse(cardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid card ID"})
	}

	userIDStr := c.Locals("userID").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid user session"})
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := c.BodyParser(&req); err != nil || req.Text == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body or empty text"})
	}

	// Find the card and its board to check existence and for logging
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Card not found"})
	}

	comment := models.Comment{
		CardID: cid,
		UserID: userID,
		Text:   req.Text,
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create comment"})
	}

	// Preload User details for response and websocket
	database.DB.Preload("User").First(&comment, "id = ?", comment.ID)

	// Fetch username for logging details
	var userName string
	if comment.User != nil {
		userName = comment.User.Name
	} else {
		userName = "A user"
	}

	// Log Activity
	utils.LogActivity(card.List.BoardID, &card.ID, userID, "add_comment", userName+" commented on card '"+card.Name+"'", h.Hub)

	// Broadcast comment added
	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "comment_added", comment)

	return c.Status(fiber.StatusCreated).JSON(comment)
}

// GetComments handles retrieving all comments for a specific card.
func (h *CardHandler) GetComments(c *fiber.Ctx) error {
	cardID := c.Params("id")
	cid, err := uuid.Parse(cardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid card ID"})
	}

	var comments []models.Comment
	if err := database.DB.Preload("User").Order("created_at desc").Find(&comments, "card_id = ?", cid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve comments"})
	}

	return c.JSON(comments)
}

// DeleteComment handles deleting a comment.
func (h *CardHandler) DeleteComment(c *fiber.Ctx) error {
	commentID := c.Params("commentId")
	coid, err := uuid.Parse(commentID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid comment ID"})
	}

	userIDStr := c.Locals("userID").(string)
	userID, _ := uuid.Parse(userIDStr)

	var comment models.Comment
	if err := database.DB.First(&comment, "id = ?", coid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Comment not found"})
	}

	// Ensure the user deleting the comment is the owner of the comment
	if comment.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "You do not have permission to delete this comment"})
	}

	// Get board ID for broadcast
	var card models.Card
	database.DB.Preload("List").First(&card, "id = ?", comment.CardID)

	if err := database.DB.Delete(&comment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete comment"})
	}

	h.Hub.BroadcastToBoard(card.List.BoardID.String(), "comment_deleted", map[string]interface{}{
		"comment_id": coid,
		"card_id":    card.ID,
	})

	return c.JSON(fiber.Map{"message": "Comment deleted successfully"})
}

// GetBoardActivities handles retrieving all activities for a board.
func (h *CardHandler) GetBoardActivities(c *fiber.Ctx) error {
	boardID := c.Params("id")
	bid, err := uuid.Parse(boardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid board ID"})
	}

	var activities []models.Activity
	if err := database.DB.Preload("User").Preload("Card").Order("created_at desc").Find(&activities, "board_id = ?", bid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve activities"})
	}

	return c.JSON(activities)
}

// GetCardActivities handles retrieving activities for a specific card.
func (h *CardHandler) GetCardActivities(c *fiber.Ctx) error {
	cardID := c.Params("id")
	cid, err := uuid.Parse(cardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid card ID"})
	}

	var activities []models.Activity
	if err := database.DB.Preload("User").Order("created_at desc").Find(&activities, "card_id = ?", cid).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve card activities"})
	}

	return c.JSON(activities)
}
