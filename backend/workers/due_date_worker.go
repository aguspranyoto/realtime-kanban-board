package workers

import (
	"fmt"
	"log"
	"time"

	"github.com/aguspranyoto/realtime-kanban-board/config"
	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/models"
	"github.com/aguspranyoto/realtime-kanban-board/utils"
	"github.com/aguspranyoto/realtime-kanban-board/ws"
)

// StartDueDateWorker starts a background worker that runs periodically to check for upcoming due dates.
func StartDueDateWorker(cfg *config.Config, hub *ws.Hub) {
	// Run immediately on start, then run every 12 hours
	ticker := time.NewTicker(12 * time.Hour)
	go func() {
		// Run initial check after database migration has fully settled
		time.Sleep(10 * time.Second)
		checkUpcomingDueDates(cfg, hub)

		for range ticker.C {
			checkUpcomingDueDates(cfg, hub)
		}
	}()
}

func checkUpcomingDueDates(cfg *config.Config, hub *ws.Hub) {
	log.Println("⏰ Running background due date check...")
	now := time.Now()
	upcomingLimit := now.Add(24 * time.Hour)

	var cards []models.Card
	// Find cards due in the next 24 hours
	err := database.DB.Preload("Members.User").Preload("List").
		Where("due_date > ? AND due_date <= ?", now, upcomingLimit).
		Find(&cards).Error

	if err != nil {
		log.Printf("Error querying upcoming due cards: %v", err)
		return
	}

	for _, card := range cards {
		for _, member := range card.Members {
			if member.User.Email == "" {
				continue
			}

			// Create a notification record if it doesn't already exist to avoid duplicates
			var existing models.Notification
			err := database.DB.Where("user_id = ? AND card_id = ? AND type = 'due'", member.UserID, card.ID).First(&existing).Error
			if err == nil {
				// Already notified for this card's due date
				continue
			}

			notification := models.Notification{
				UserID:  member.UserID,
				ActorID: member.UserID, // Self/system actor
				CardID:  &card.ID,
				Type:    "due",
				IsRead:  false,
			}
			if err := database.DB.Create(&notification).Error; err != nil {
				log.Printf("Error creating due date notification: %v", err)
				continue
			}

			// Fetch populated notification details to send
			database.DB.Preload("Card.List").First(&notification, "id = ?", notification.ID)

			// Broadcast notification via WebSocket
			if hub != nil {
				hub.BroadcastToBoard(card.List.BoardID.String(), "notification_received", notification)
			}

			// Send email reminder
			subject := fmt.Sprintf("Reminder: Task '%s' is due soon", card.Name)
			body := fmt.Sprintf(`
				<h2>Task Due Reminder</h2>
				<p>Hello %s,</p>
				<p>The task <strong>%s</strong> in list <strong>%s</strong> is due on %s.</p>
				<p>Please review and complete it on your Kanban Board board.</p>
			`, member.User.Name, card.Name, card.List.Name, card.DueDate.Format("2006-01-02 15:04:05"))

			err = utils.SendEmail(cfg.ResendAPIKey, member.User.Email, subject, body)
			if err != nil {
				log.Printf("Failed to send due date email to %s: %v", member.User.Email, err)
			} else {
				log.Printf("Sent due date email reminder for card '%s' to %s", card.Name, member.User.Email)
			}
		}
	}
}
