package handlers

import (
	"fmt"
	"io"

	"github.com/gofiber/fiber/v2"

	"github.com/aguspranyoto/realtime-kanban-board/storage"
)

// FileProxyHandler serves files from R2 through the backend.
// This avoids relying on R2 public access which may be blocked.
type FileProxyHandler struct {
	R2Client *storage.R2Client
}

// NewFileProxyHandler creates a FileProxyHandler.
func NewFileProxyHandler(r2 *storage.R2Client) *FileProxyHandler {
	return &FileProxyHandler{R2Client: r2}
}

// Serve handles GET /api/files/*
// It fetches the file from R2 using the key from the URL path and streams it to the client.
func (h *FileProxyHandler) Serve(c *fiber.Ctx) error {
	if h.R2Client == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Storage not configured"})
	}

	// The key is everything after /api/files/
	key := c.Params("*")
	if key == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "No file key provided"})
	}

	output, err := h.R2Client.GetFile(c.Context(), key)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "File not found"})
	}
	defer output.Body.Close()

	// Set content type
	contentType := "application/octet-stream"
	if output.ContentType != nil {
		contentType = *output.ContentType
	}
	c.Set("Content-Type", contentType)

	// Set cache headers for better performance
	c.Set("Cache-Control", "public, max-age=31536000, immutable")

	// Set content length if available
	if output.ContentLength != nil {
		c.Set("Content-Length", fmt.Sprintf("%d", *output.ContentLength))
	}

	// Stream the file body to the response
	body, err := io.ReadAll(output.Body)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to read file"})
	}

	return c.Send(body)
}
