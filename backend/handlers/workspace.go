package handlers

import (
	"fmt"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/resend/resend-go/v2"

	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
)

type WorkspaceHandler struct{}

func NewWorkspaceHandler() *WorkspaceHandler {
	return &WorkspaceHandler{}
}

// --- Request DTOs ---

type CreateWorkspaceRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateWorkspaceRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
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
		Joins("JOIN trello_clone_workspace_members ON trello_clone_workspace_members.workspace_id = trello_clone_workspaces.id").
		Where("trello_clone_workspace_members.user_id = ?", userID).
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
	if req.Description != "" {
		workspace.Description = req.Description
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

		params := &resend.SendEmailRequest{
			From:    "Trello Clone <onboarding@resend.dev>",
			To:      []string{userToAdd.Email},
			Subject: fmt.Sprintf("You've been invited to %s!", workspace.Name),
			Html:    fmt.Sprintf("<strong>Hello!</strong><br>You have been added to the workspace <strong>%s</strong>. Log in to start collaborating!", workspace.Name),
		}

		_, err := client.Emails.Send(params)
		if err != nil {
			fmt.Printf("Failed to send email via Resend: %v\n", err)
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
