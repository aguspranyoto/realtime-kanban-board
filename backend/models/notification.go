package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Notification represents a system notification sent to a user.
type Notification struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`  // Recipient
	ActorID   uuid.UUID  `gorm:"type:uuid;not null;index" json:"actor_id"` // Sender/Triggerer
	CardID    *uuid.UUID `gorm:"type:uuid;index" json:"card_id,omitempty"`
	Type      string     `gorm:"size:100;not null" json:"type"` // e.g., "assigned", "comment", "mention", "due"
	IsRead    bool       `gorm:"default:false" json:"is_read"`
	CreatedAt time.Time  `json:"created_at"`

	// Relations
	User  *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Actor *User `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
	Card  *Card `gorm:"foreignKey:CardID" json:"card,omitempty"`
}

// BeforeCreate generates a UUID before inserting a new notification.
func (n *Notification) BeforeCreate(tx *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}
