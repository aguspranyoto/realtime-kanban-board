package handlers

import (
	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

type NotificationHandler struct{}

func NewNotificationHandler() *NotificationHandler {
	return &NotificationHandler{}
}

// GetNotifications fetches all notifications for the authenticated user.
func (h *NotificationHandler) GetNotifications(c *fiber.Ctx) error {
	userIDStr := c.Locals("userID").(string)
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var notifications []models.Notification
	if err := database.DB.Preload("Actor").Preload("Card.List").Order("created_at desc").Find(&notifications, "user_id = ?", userID).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to retrieve notifications"})
	}

	return c.JSON(notifications)
}

// MarkAsRead marks a single notification as read.
func (h *NotificationHandler) MarkAsRead(c *fiber.Ctx) error {
	id := c.Params("id")
	nid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid notification ID"})
	}

	userIDStr := c.Locals("userID").(string)
	userID, _ := uuid.Parse(userIDStr)

	var notification models.Notification
	if err := database.DB.First(&notification, "id = ?", nid).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Notification not found"})
	}

	if notification.UserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Unauthorized"})
	}

	notification.IsRead = true
	if err := database.DB.Save(&notification).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update notification"})
	}

	return c.JSON(notification)
}

// MarkAllAsRead marks all notifications for the authenticated user as read.
func (h *NotificationHandler) MarkAllAsRead(c *fiber.Ctx) error {
	userIDStr := c.Locals("userID").(string)
	userID, _ := uuid.Parse(userIDStr)

	if err := database.DB.Model(&models.Notification{}).Where("user_id = ?", userID).Update("is_read", true).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update notifications"})
	}

	return c.JSON(fiber.Map{"message": "All notifications marked as read"})
}
