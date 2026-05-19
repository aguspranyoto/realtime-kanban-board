package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// List represents a column within a board (e.g., "To Do", "In Progress", "Done").
type List struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	BoardID   uuid.UUID      `gorm:"type:uuid;not null" json:"board_id"`
	Name      string         `gorm:"size:255;not null" json:"name"`
	Position  int            `gorm:"not null;default:0" json:"position"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Board Board  `gorm:"foreignKey:BoardID" json:"board,omitempty"`
	Cards []Card `gorm:"foreignKey:ListID" json:"cards,omitempty"`
}

func (l *List) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}
