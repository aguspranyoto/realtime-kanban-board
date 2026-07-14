package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Board represents a Kanban Board-style board within a workspace.
type Board struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID   uuid.UUID      `gorm:"type:uuid;not null" json:"workspace_id"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	Description   string         `gorm:"size:1000" json:"description"`
	Background    string         `gorm:"size:512;default:'#1e3a5f'" json:"background"` // hex color or image URL
	Visibility    string         `gorm:"size:50;default:'workspace'" json:"visibility"` // "private" or "workspace"
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Workspace Workspace `gorm:"foreignKey:WorkspaceID" json:"workspace,omitempty"`
	Lists     []List    `gorm:"foreignKey:BoardID" json:"lists,omitempty"`
	Labels    []Label   `gorm:"foreignKey:BoardID" json:"labels,omitempty"`
}

func (b *Board) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
