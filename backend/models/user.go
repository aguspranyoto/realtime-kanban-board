package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a registered user in the system.
type User struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	Name            string     `gorm:"size:255;not null" json:"name"`
	Email           string     `gorm:"size:255;uniqueIndex;not null" json:"email"`
	Password        string     `gorm:"size:255" json:"-"` // Empty for Google OAuth users
	AvatarURL       string     `gorm:"size:512" json:"avatar_url"`
	Provider        string     `gorm:"size:50;default:'local'" json:"provider"` // "local" or "google"
	IsEmailVerified bool       `gorm:"default:false" json:"is_email_verified"`
	VerificationToken string   `gorm:"size:255" json:"-"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Workspaces      []WorkspaceMember `gorm:"foreignKey:UserID" json:"workspaces,omitempty"`
}

// BeforeCreate generates a UUID before inserting a new user.
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}
