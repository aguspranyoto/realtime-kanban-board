package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Attachment represents a file uploaded to Cloudflare R2 and attached to a card.
type Attachment struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	CardID    uuid.UUID      `gorm:"type:uuid;not null" json:"card_id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null" json:"user_id"`
	Name      string         `gorm:"size:255;not null" json:"name"`
	URL       string         `gorm:"size:1024;not null" json:"url"`
	MimeType  string         `gorm:"size:100" json:"mime_type"`
	Size      int64          `gorm:"not null;default:0" json:"size"`
	IsCover   bool           `gorm:"not null;default:false" json:"is_cover"`
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (a *Attachment) BeforeCreate(tx *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}
