package utils

import (
	"log"

	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
	"github.com/aguspranyoto/trello-clone/ws"
	"github.com/google/uuid"
)

// LogActivity logs a user action to the activity log and broadcasts it.
func LogActivity(boardID uuid.UUID, cardID *uuid.UUID, userID uuid.UUID, action string, details string, hub *ws.Hub) {
	activity := models.Activity{
		BoardID: boardID,
		CardID:  cardID,
		UserID:  userID,
		Action:  action,
		Details: details,
	}

	if err := database.DB.Create(&activity).Error; err != nil {
		log.Printf("Failed to create activity log: %v", err)
		return
	}

	// Fetch user details to populate relations for broadcast
	database.DB.Preload("User").First(&activity, "id = ?", activity.ID)

	if hub != nil {
		hub.BroadcastToBoard(boardID.String(), "activity_logged", activity)
	}
}
