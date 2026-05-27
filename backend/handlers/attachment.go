package handlers

import (
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
	"github.com/aguspranyoto/trello-clone/storage"
	"github.com/aguspranyoto/trello-clone/ws"
)

// AttachmentHandler handles file upload and attachment management.
type AttachmentHandler struct {
	Hub      *ws.Hub
	R2Client *storage.R2Client
}

// NewAttachmentHandler creates an AttachmentHandler.
func NewAttachmentHandler(hub *ws.Hub, r2 *storage.R2Client) *AttachmentHandler {
	return &AttachmentHandler{Hub: hub, R2Client: r2}
}

// Upload handles POST /api/cards/:id/attachments
func (h *AttachmentHandler) Upload(c *fiber.Ctx) error {
	cardID := c.Params("id")
	cid, err := uuid.Parse(cardID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid card ID"})
	}

	userIDStr, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Unauthorized"})
	}
	userID, _ := uuid.Parse(userIDStr)

	// Get uploaded file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file provided"})
	}

	// Validate file size (10 MB max)
	if fileHeader.Size > 10*1024*1024 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File too large (max 10 MB)"})
	}

	// Detect MIME type from extension
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	mimeType := mimeFromExt(ext)

	// Open file
	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read file"})
	}
	defer file.Close()

	// Build R2 object key: attachments/<cardID>/<timestamp>-<filename>
	key := fmt.Sprintf("attachments/%s/%d-%s", cardID, time.Now().UnixMilli(), sanitizeFilename(fileHeader.Filename))

	// Upload to R2
	url, err := h.R2Client.UploadFile(c.Context(), key, file, fileHeader.Size, mimeType)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to upload file: " + err.Error()})
	}

	// Save attachment record
	attachment := models.Attachment{
		CardID:   cid,
		UserID:   userID,
		Name:     fileHeader.Filename,
		URL:      url,
		MimeType: mimeType,
		Size:     fileHeader.Size,
	}
	if err := database.DB.Create(&attachment).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to save attachment"})
	}

	// Broadcast card update
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cid).Error; err == nil {
		h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)
	}

	return c.Status(fiber.StatusCreated).JSON(attachment)
}

// GetAll handles GET /api/cards/:id/attachments
func (h *AttachmentHandler) GetAll(c *fiber.Ctx) error {
	cardID := c.Params("id")
	var attachments []models.Attachment
	database.DB.Preload("User").Where("card_id = ?", cardID).Order("created_at DESC").Find(&attachments)

	// Rewrite old R2 public URLs to proxy URLs
	for i := range attachments {
		attachments[i].URL = rewriteR2URL(attachments[i].URL)
	}

	return c.JSON(attachments)
}

// Delete handles DELETE /api/attachments/:id
func (h *AttachmentHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")

	var attachment models.Attachment
	if err := database.DB.First(&attachment, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Attachment not found"})
	}

	// Delete from R2 (extract key from URL)
	key := extractKeyFromURL(attachment.URL)
	if key != "" {
		_ = h.R2Client.DeleteFile(c.Context(), key)
	}

	database.DB.Delete(&attachment)

	// Broadcast
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", attachment.CardID).Error; err == nil {
		h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)
	}

	return c.JSON(fiber.Map{"message": "Attachment deleted"})
}

// SetCover handles PUT /api/attachments/:id/cover
func (h *AttachmentHandler) SetCover(c *fiber.Ctx) error {
	id := c.Params("id")

	var attachment models.Attachment
	if err := database.DB.First(&attachment, "id = ?", id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Attachment not found"})
	}

	// Clear other covers for this card
	database.DB.Model(&models.Attachment{}).Where("card_id = ?", attachment.CardID).Update("is_cover", false)
	// Set this attachment as cover
	database.DB.Model(&attachment).Update("is_cover", true)

	// Also set cover_url on card (using proxy URL)
	proxyURL := rewriteR2URL(attachment.URL)
	database.DB.Model(&models.Card{}).Where("id = ?", attachment.CardID).Update("cover_url", proxyURL)

	// Broadcast
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", attachment.CardID).Error; err == nil {
		h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)
	}

	return c.JSON(fiber.Map{"message": "Cover set", "url": proxyURL})
}

// RemoveCover handles DELETE /api/cards/:id/cover
func (h *AttachmentHandler) RemoveCover(c *fiber.Ctx) error {
	cardID := c.Params("id")

	database.DB.Model(&models.Attachment{}).Where("card_id = ?", cardID).Update("is_cover", false)
	database.DB.Model(&models.Card{}).Where("id = ?", cardID).Update("cover_url", "")

	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cardID).Error; err == nil {
		h.Hub.BroadcastToBoard(card.List.BoardID.String(), "card_updated", card.ID)
	}

	return c.JSON(fiber.Map{"message": "Cover removed"})
}

// --- helpers ---

func mimeFromExt(ext string) string {
	mimes := map[string]string{
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".png":  "image/png",
		".gif":  "image/gif",
		".webp": "image/webp",
		".pdf":  "application/pdf",
		".doc":  "application/msword",
		".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		".xls":  "application/vnd.ms-excel",
		".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		".txt":  "text/plain",
		".zip":  "application/zip",
	}
	if m, ok := mimes[ext]; ok {
		return m
	}
	return "application/octet-stream"
}

func sanitizeFilename(name string) string {
	// Replace spaces with underscores
	return strings.ReplaceAll(name, " ", "_")
}

func extractKeyFromURL(url string) string {
	// Find the start of the object key path
	idx := strings.Index(url, "attachments/")
	if idx == -1 {
		return ""
	}
	return url[idx:]
}

// rewriteR2URL converts old R2 public URLs to backend proxy URLs.
// If the URL is already a relative proxy URL, it is returned as-is.
func rewriteR2URL(url string) string {
	if strings.HasPrefix(url, "/api/files/") {
		return url
	}
	// Extract the object key from old R2 public URLs
	key := extractKeyFromURL(url)
	if key != "" {
		return "/api/files/" + key
	}
	return url
}
