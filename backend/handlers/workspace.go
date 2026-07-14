package handlers

import (
	"fmt"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/resend/resend-go/v2"

	"github.com/aguspranyoto/realtime-kanban-board/config"
	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/models"
)

type WorkspaceHandler struct {
	Config *config.Config
}

func NewWorkspaceHandler(cfg *config.Config) *WorkspaceHandler {
	return &WorkspaceHandler{Config: cfg}
}

// --- Request DTOs ---

type CreateWorkspaceRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateWorkspaceRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// --- Handlers ---

// CreateWorkspace creates a new workspace and adds the creator as an admin member.
func (h *WorkspaceHandler) Create(c *fiber.Ctx) error {
	userID, _ := uuid.Parse(c.Locals("userID").(string))

	var req CreateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Workspace name is required"})
	}

	workspace := models.Workspace{
		Name:        req.Name,
		Description: req.Description,
		OwnerID:     userID,
	}

	if result := database.DB.Create(&workspace); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create workspace"})
	}

	// Add creator as admin member
	member := models.WorkspaceMember{
		WorkspaceID: workspace.ID,
		UserID:      userID,
		Role:        "admin",
	}
	database.DB.Create(&member)

	return c.Status(fiber.StatusCreated).JSON(workspace)
}

// GetAll returns all workspaces the authenticated user is a member of.
func (h *WorkspaceHandler) GetAll(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var workspaces []models.Workspace
	database.DB.
		Joins("JOIN realtime_kanban_board_workspace_members ON realtime_kanban_board_workspace_members.workspace_id = realtime_kanban_board_workspaces.id").
		Where("realtime_kanban_board_workspace_members.user_id = ?", userID).
		Preload("Members.User").
		Find(&workspaces)

	return c.JSON(workspaces)
}

// GetByID returns a single workspace by ID.
func (h *WorkspaceHandler) GetByID(c *fiber.Ctx) error {
	id := c.Params("id")

	var workspace models.Workspace
	if result := database.DB.Preload("Members.User").Preload("Boards").First(&workspace, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Workspace not found"})
	}

	return c.JSON(workspace)
}

// Update modifies a workspace's name and description.
func (h *WorkspaceHandler) Update(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userID").(string)

	var workspace models.Workspace
	if result := database.DB.First(&workspace, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Workspace not found"})
	}

	// Check ownership
	if workspace.OwnerID.String() != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only the workspace owner can update it"})
	}

	var req UpdateWorkspaceRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name != "" {
		workspace.Name = req.Name
	}
	if req.Description != nil {
		workspace.Description = *req.Description
	}

	database.DB.Save(&workspace)

	return c.JSON(workspace)
}

// Delete soft-deletes a workspace.
func (h *WorkspaceHandler) Delete(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userID").(string)

	var workspace models.Workspace
	if result := database.DB.First(&workspace, "id = ?", id); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Workspace not found"})
	}

	if workspace.OwnerID.String() != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only the workspace owner can delete it"})
	}

	var boardIDs []string
	database.DB.Model(&models.Board{}).Where("workspace_id = ?", workspace.ID).Pluck("id", &boardIDs)

	if len(boardIDs) > 0 {
		var listIDs []string
		database.DB.Model(&models.List{}).Where("board_id IN ?", boardIDs).Pluck("id", &listIDs)

		if len(listIDs) > 0 {
			var cardIDs []string
			database.DB.Model(&models.Card{}).Where("list_id IN ?", listIDs).Pluck("id", &cardIDs)

			if len(cardIDs) > 0 {
				database.DB.Where("card_id IN ?", cardIDs).Delete(&models.Checklist{})
				database.DB.Where("card_id IN ?", cardIDs).Delete(&models.Attachment{})
				database.DB.Where("card_id IN ?", cardIDs).Delete(&models.Comment{})
				database.DB.Where("card_id IN ?", cardIDs).Delete(&models.CardMember{})
				database.DB.Where("card_id IN ?", cardIDs).Delete(&models.CardLabel{})
				database.DB.Where("id IN ?", cardIDs).Delete(&models.Card{})
			}
			database.DB.Where("id IN ?", listIDs).Delete(&models.List{})
		}
		database.DB.Where("board_id IN ?", boardIDs).Delete(&models.Label{})
		database.DB.Where("board_id IN ?", boardIDs).Delete(&models.Activity{})
		database.DB.Where("id IN ?", boardIDs).Delete(&models.Board{})
	}
	database.DB.Where("workspace_id = ?", workspace.ID).Delete(&models.WorkspaceMember{})
	database.DB.Delete(&workspace)

	return c.JSON(fiber.Map{"message": "Workspace deleted successfully"})
}

// AddMember adds a user to the workspace by email.
func (h *WorkspaceHandler) AddMember(c *fiber.Ctx) error {
	workspaceID := c.Params("id")
	userID := c.Locals("userID").(string)

	var workspace models.Workspace
	if result := database.DB.First(&workspace, "id = ?", workspaceID); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Workspace not found"})
	}

	// Only owner can add members
	if workspace.OwnerID.String() != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Only the workspace owner can add members"})
	}

	var req struct {
		Email string `json:"email"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var userToAdd models.User
	if result := database.DB.Where("email = ?", req.Email).First(&userToAdd); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User with this email not found"})
	}

	// Check if already a member
	var existingMember models.WorkspaceMember
	if result := database.DB.Where("workspace_id = ? AND user_id = ?", workspace.ID, userToAdd.ID).First(&existingMember); result.Error == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "User is already a member of this workspace"})
	}

	newMember := models.WorkspaceMember{
		WorkspaceID: workspace.ID,
		UserID:      userToAdd.ID,
		Role:        "member",
	}

	if err := database.DB.Create(&newMember).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to add member"})
	}

	// Create in-app notification for the invited user
	notification := models.Notification{
		UserID:  userToAdd.ID,
		ActorID: uuid.MustParse(userID),
		Type:    "workspace_invite",
	}
	database.DB.Create(&notification)

	// Send email using Resend
	resendKey := os.Getenv("RESEND_API_KEY")
	if resendKey != "" {
		client := resend.NewClient(resendKey)

		emailHTML := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head>
			<style>
				body { margin: 0; padding: 0; background-color: #f4f4f4; }
				.container { max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: Arial, sans-serif; text-align: center; color: #000000; }
				.logo-area { padding: 10px 20px; }
				.logo-area h1 { margin: 0; font-size: 16px; font-weight: bold; letter-spacing: 1px; color: #000000; }
				.hero { background-color: #000000; color: #ffffff; padding: 50px 20px; }
				.hero-icon { font-size: 32px; margin-bottom: 15px; }
				.hero-sub { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 15px; }
				.hero-title { font-size: 22px; margin: 0; font-weight: normal; }
				.content-area { padding: 50px 40px; }
				.content-area p { font-size: 16px; line-height: 1.5; margin-bottom: 25px; color: #000000; }
				.workspace-name { display: inline-block; border: 2px solid #000000; font-weight: bold; padding: 12px 24px; border-radius: 4px; margin-bottom: 40px; font-size: 18px; color: #000000; }
				.btn { background-color: #000000; color: #ffffff !important; text-decoration: none; padding: 16px 40px; font-weight: bold; font-size: 14px; display: inline-block; border-radius: 4px; text-transform: uppercase; }
				.signature { font-size: 16px; margin-top: 50px; color: #000000; }
				.signature-name { font-weight: bold; margin-top: 5px; }
			</style>
		</head>
		<body>
			<div class="container">
				<div class="logo-area">
					<h1>AGUSP.COM</h1>
				</div>
				<div class="hero">
					<div class="hero-sub">You've been invited!</div>
					<h2 class="hero-title">Workspace Invitation</h2>
				</div>
				<div class="content-area">
					<p>Hi,<br><br>You're almost ready to get started. You have been invited to collaborate with your team in the following workspace:</p>
					<div class="workspace-name">%s</div><br>
					<a href="%s/dashboard" class="btn">Go to Dashboard</a>
					<div class="signature">
						<div style="margin-bottom: 5px;">Thanks,</div>
						<div class="signature-name">Realtime Kanban Board Team</div>
					</div>
				</div>
			</div>
		</body>
		</html>
		`, workspace.Name, h.Config.WebURL)

		params := &resend.SendEmailRequest{
			From:    "Realtime Kanban Board <notifier@agusp.com>",
			To:      []string{userToAdd.Email},
			Subject: fmt.Sprintf("You've been invited to %s!", workspace.Name),
			Html:    emailHTML,
		}

		_, err := client.Emails.Send(params)
		if err != nil {
			fmt.Printf("Failed to send email via Resend: %v\n", err)
			// Do not rollback member/notification, email delivery failure should not prevent membership
		}
	}

	return c.Status(fiber.StatusCreated).JSON(newMember)
}

// RemoveMember removes a user from the workspace.
func (h *WorkspaceHandler) RemoveMember(c *fiber.Ctx) error {
	workspaceID := c.Params("id")
	memberUserID := c.Params("userId")
	userID := c.Locals("userID").(string)

	var workspace models.Workspace
	if result := database.DB.First(&workspace, "id = ?", workspaceID); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Workspace not found"})
	}

	// A user can remove themselves, or the owner can remove anyone.
	if workspace.OwnerID.String() != userID && memberUserID != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Not authorized to remove this member"})
	}

	// Cannot remove the owner
	if workspace.OwnerID.String() == memberUserID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Cannot remove the workspace owner"})
	}

	if err := database.DB.Where("workspace_id = ? AND user_id = ?", workspace.ID, memberUserID).Delete(&models.WorkspaceMember{}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to remove member"})
	}

	return c.JSON(fiber.Map{"message": "Member removed successfully"})
}
