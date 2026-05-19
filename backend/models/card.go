package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Card represents a task or item within a list.
type Card struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ListID      uuid.UUID      `gorm:"type:uuid;not null" json:"list_id"`
	Name        string         `gorm:"size:255;not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	Position    int            `gorm:"not null;default:0" json:"position"`
	DueDate     *time.Time     `json:"due_date"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	List       List            `gorm:"foreignKey:ListID" json:"list,omitempty"`
	Labels     []CardLabel     `gorm:"foreignKey:CardID" json:"labels,omitempty"`
	Members    []CardMember    `gorm:"foreignKey:CardID" json:"members,omitempty"`
	Checklists []Checklist     `gorm:"foreignKey:CardID" json:"checklists,omitempty"`
}

func (c *Card) BeforeCreate(tx *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

// Label represents a color-coded tag that can be applied to cards.
type Label struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	BoardID uuid.UUID `gorm:"type:uuid;not null" json:"board_id"`
	Name    string    `gorm:"size:100" json:"name"`
	Color   string    `gorm:"size:50;not null" json:"color"` // hex color

	Board Board `gorm:"foreignKey:BoardID" json:"-"`
}

func (l *Label) BeforeCreate(tx *gorm.DB) error {
	if l.ID == uuid.Nil {
		l.ID = uuid.New()
	}
	return nil
}

// CardLabel is the join table between Card and Label.
type CardLabel struct {
	ID      uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CardID  uuid.UUID `gorm:"type:uuid;not null" json:"card_id"`
	LabelID uuid.UUID `gorm:"type:uuid;not null" json:"label_id"`

	Label Label `gorm:"foreignKey:LabelID" json:"label,omitempty"`
}

func (cl *CardLabel) BeforeCreate(tx *gorm.DB) error {
	if cl.ID == uuid.Nil {
		cl.ID = uuid.New()
	}
	return nil
}

// CardMember represents a user assigned to a card.
type CardMember struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CardID uuid.UUID `gorm:"type:uuid;not null" json:"card_id"`
	UserID uuid.UUID `gorm:"type:uuid;not null" json:"user_id"`

	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (cm *CardMember) BeforeCreate(tx *gorm.DB) error {
	if cm.ID == uuid.Nil {
		cm.ID = uuid.New()
	}
	return nil
}

// Checklist represents a group of checklist items on a card.
type Checklist struct {
	ID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	CardID uuid.UUID `gorm:"type:uuid;not null" json:"card_id"`
	Name   string    `gorm:"size:255;not null" json:"name"`

	Items []ChecklistItem `gorm:"foreignKey:ChecklistID" json:"items,omitempty"`
}

func (ch *Checklist) BeforeCreate(tx *gorm.DB) error {
	if ch.ID == uuid.Nil {
		ch.ID = uuid.New()
	}
	return nil
}

// ChecklistItem represents a single item within a checklist.
type ChecklistItem struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ChecklistID uuid.UUID `gorm:"type:uuid;not null" json:"checklist_id"`
	Name        string    `gorm:"size:255;not null" json:"name"`
	IsChecked   bool      `gorm:"default:false" json:"is_checked"`
}

func (ci *ChecklistItem) BeforeCreate(tx *gorm.DB) error {
	if ci.ID == uuid.Nil {
		ci.ID = uuid.New()
	}
	return nil
}
