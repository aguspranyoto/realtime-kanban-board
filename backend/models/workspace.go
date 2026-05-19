package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Workspace represents a group of boards owned by users.
type Workspace struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Description string         `gorm:"size:1000" json:"description"`
	OwnerID     uuid.UUID      `gorm:"type:uuid;not null" json:"owner_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Owner   User              `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Members []WorkspaceMember `gorm:"foreignKey:WorkspaceID" json:"members,omitempty"`
	Boards  []Board           `gorm:"foreignKey:WorkspaceID" json:"boards,omitempty"`
}

func (w *Workspace) BeforeCreate(tx *gorm.DB) error {
	if w.ID == uuid.Nil {
		w.ID = uuid.New()
	}
	return nil
}

// WorkspaceMember represents a user's membership in a workspace.
type WorkspaceMember struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID uuid.UUID     `gorm:"type:uuid;not null" json:"workspace_id"`
	UserID      uuid.UUID     `gorm:"type:uuid;not null" json:"user_id"`
	Role        string        `gorm:"size:50;default:'member'" json:"role"` // "admin" or "member"
	CreatedAt   time.Time     `json:"created_at"`

	// Relations
	User      User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Workspace Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
}

func (wm *WorkspaceMember) BeforeCreate(tx *gorm.DB) error {
	if wm.ID == uuid.Nil {
		wm.ID = uuid.New()
	}
	return nil
}
