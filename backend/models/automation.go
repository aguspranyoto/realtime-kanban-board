package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Supported trigger types
const (
	TriggerChecklistComplete = "checklist_complete" // All checklists on card are 100% done
	TriggerCardMovedToList   = "card_moved_to_list" // Card arrives in a specific list
	TriggerCardCreatedInList = "card_created_in_list" // Card is created in a specific list
)

// Supported action types
const (
	ActionMoveCardToList      = "move_card_to_list"      // Move card to another list
	ActionAddLabel            = "add_label"               // Add a label to the card
	ActionArchiveCard         = "archive_card"            // Soft-delete the card
	ActionCompleteAllItems    = "complete_all_items"      // Check all checklist items
)

// AutomationRule defines a trigger → action rule scoped to a board.
type AutomationRule struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	BoardID       uuid.UUID      `gorm:"type:uuid;not null;index" json:"board_id"`
	CreatedBy     uuid.UUID      `gorm:"type:uuid;not null" json:"created_by"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	Trigger       string         `gorm:"size:100;not null" json:"trigger"`
	TriggerParams string         `gorm:"type:text;default:'{}'" json:"trigger_params"` // JSON string
	Action        string         `gorm:"size:100;not null" json:"action"`
	ActionParams  string         `gorm:"type:text;default:'{}'" json:"action_params"` // JSON string
	IsActive      bool           `gorm:"not null;default:true" json:"is_active"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`

	Board Board `gorm:"foreignKey:BoardID" json:"-"`
}

func (r *AutomationRule) BeforeCreate(tx *gorm.DB) error {
	if r.ID == uuid.Nil {
		r.ID = uuid.New()
	}
	return nil
}
