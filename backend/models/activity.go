package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Activity represents an action performed on a board, list, or card.
type Activity struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	BoardID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"board_id"`
	CardID    *uuid.UUID `gorm:"type:uuid;index" json:"card_id,omitempty"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	Action    string     `gorm:"size:100;not null" json:"action"` // e.g., "create_card", "move_card", "add_comment"
	Details   string     `gorm:"type:text" json:"details"`        // e.g., "moved card to Done" or "added a comment"
	CreatedAt time.Time  `json:"created_at"`

	// Relations
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Card *Card `gorm:"foreignKey:CardID" json:"card,omitempty"`
}

// BeforeCreate generates a UUID before inserting a new activity.
func (a *Activity) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
