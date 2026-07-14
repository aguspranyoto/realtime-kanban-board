package utils

import (
	"encoding/json"
	"log"

	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/models"
	"github.com/aguspranyoto/realtime-kanban-board/ws"
	"github.com/google/uuid"
)

// TriggerPayload represents context passed to the automation engine when an event occurs.
type TriggerPayload struct {
	TriggerType string
	CardID      uuid.UUID
	BoardID     uuid.UUID
	ListID      uuid.UUID // Relevant for move/create triggers
}

// TriggerChecklistCompleteParams represents params for checklist trigger (empty for now, triggered on 100% completion)
type TriggerParams struct {
	ListID string `json:"list_id,omitempty"`
}

// ActionParams represents params for the action
type ActionParams struct {
	ListID  string `json:"list_id,omitempty"`
	LabelID string `json:"label_id,omitempty"`
}

// RunAutomations evaluates and runs all active rules on the board for the given trigger payload.
func RunAutomations(payload TriggerPayload, hub *ws.Hub) {
	// Find all active rules for this board and trigger type
	var rules []models.AutomationRule
	err := database.DB.Where("board_id = ? AND trigger = ? AND is_active = ?", payload.BoardID, payload.TriggerType, true).Find(&rules).Error
	if err != nil {
		log.Printf("Automation Engine: Error fetching rules: %v", err)
		return
	}

	if len(rules) == 0 {
		return
	}

	for _, rule := range rules {
		// Evaluate Trigger Parameters
		var tParams TriggerParams
		if err := json.Unmarshal([]byte(rule.TriggerParams), &tParams); err != nil {
			log.Printf("Automation Engine: Error parsing trigger params for rule %s: %v", rule.ID, err)
			continue
		}

		shouldTrigger := false

		switch rule.Trigger {
		case models.TriggerChecklistComplete:
			// TriggerChecklistComplete: When checklist is 100% completed.
			// Let's verify if the card's checklist is indeed 100% complete.
			var card models.Card
			if err := database.DB.Preload("Checklists.Items").First(&card, "id = ?", payload.CardID).Error; err != nil {
				log.Printf("Automation Engine: Error fetching card: %v", err)
				continue
			}

			totalItems := 0
			checkedItems := 0
			for _, checklist := range card.Checklists {
				for _, item := range checklist.Items {
					totalItems++
					if item.IsChecked {
						checkedItems++
					}
				}
			}

			// We trigger if there is at least one item, and all are checked.
			if totalItems > 0 && checkedItems == totalItems {
				shouldTrigger = true
			}

		case models.TriggerCardMovedToList:
			// TriggerCardMovedToList: When card is moved to a specific list.
			// Check if list_id parameter matches the payload's destination list.
			if tParams.ListID == "" || tParams.ListID == payload.ListID.String() {
				shouldTrigger = true
			}

		case models.TriggerCardCreatedInList:
			// TriggerCardCreatedInList: When card is created in a specific list.
			if tParams.ListID == "" || tParams.ListID == payload.ListID.String() {
				shouldTrigger = true
			}
		}

		if shouldTrigger {
			// Parse action params
			var aParams ActionParams
			if err := json.Unmarshal([]byte(rule.ActionParams), &aParams); err != nil {
				log.Printf("Automation Engine: Error parsing action params for rule %s: %v", rule.ID, err)
				continue
			}

			executeAction(rule, aParams, payload, hub)
		}
	}
}

func executeAction(rule models.AutomationRule, params ActionParams, payload TriggerPayload, hub *ws.Hub) {
	log.Printf("Automation Engine: Executing rule '%s' (%s -> %s) on card %s", rule.Name, rule.Trigger, rule.Action, payload.CardID)

	// User ID to log activity
	systemUserID := rule.CreatedBy // Run as the user who created the rule

	switch rule.Action {
	case models.ActionMoveCardToList:
		// Move card to list
		targetListID, err := uuid.Parse(params.ListID)
		if err != nil {
			log.Printf("Automation Engine: Invalid target list ID '%s': %v", params.ListID, err)
			return
		}

		// Find current max position in target list to append card at the end
		var maxPos int
		database.DB.Model(&models.Card{}).Where("list_id = ?", targetListID).Select("COALESCE(MAX(position), -1)").Scan(&maxPos)

		err = database.DB.Model(&models.Card{}).Where("id = ?", payload.CardID).Updates(map[string]interface{}{
			"list_id":  targetListID,
			"position": maxPos + 1,
		}).Error
		if err != nil {
			log.Printf("Automation Engine: Failed to move card: %v", err)
			return
		}

		// Broadcast card moved / list update
		if hub != nil {
			var card models.Card
			if err := database.DB.Preload("List").First(&card, "id = ?", payload.CardID).Error; err == nil {
				hub.BroadcastToBoard(payload.BoardID.String(), "card_updated", card)
				LogActivity(payload.BoardID, &payload.CardID, systemUserID, "automation_rule", "moved card '"+card.Name+"' via rule: "+rule.Name, hub)
			}
		}

	case models.ActionAddLabel:
		// Add label to card
		labelID, err := uuid.Parse(params.LabelID)
		if err != nil {
			log.Printf("Automation Engine: Invalid label ID '%s': %v", params.LabelID, err)
			return
		}

		// Check if card already has label
		var count int64
		database.DB.Model(&models.CardLabel{}).Where("card_id = ? AND label_id = ?", payload.CardID, labelID).Count(&count)
		if count == 0 {
			cardLabel := models.CardLabel{
				CardID:  payload.CardID,
				LabelID: labelID,
			}
			if err := database.DB.Create(&cardLabel).Error; err != nil {
				log.Printf("Automation Engine: Failed to add label: %v", err)
				return
			}
		}

		// Broadcast card update
		if hub != nil {
			hub.BroadcastToBoard(payload.BoardID.String(), "card_updated", payload.CardID)
			var card models.Card
			if err := database.DB.First(&card, "id = ?", payload.CardID).Error; err == nil {
				LogActivity(payload.BoardID, &payload.CardID, systemUserID, "automation_rule", "added label via rule: "+rule.Name, hub)
			}
		}

	case models.ActionArchiveCard:
		// Archive card (soft delete)
		var card models.Card
		if err := database.DB.First(&card, "id = ?", payload.CardID).Error; err != nil {
			log.Printf("Automation Engine: Card not found for archiving: %v", err)
			return
		}

		if err := database.DB.Delete(&card).Error; err != nil {
			log.Printf("Automation Engine: Failed to archive card: %v", err)
			return
		}

		// Broadcast
		if hub != nil {
			hub.BroadcastToBoard(payload.BoardID.String(), "card_deleted", payload.CardID.String())
			LogActivity(payload.BoardID, nil, systemUserID, "automation_rule", "archived card '"+card.Name+"' via rule: "+rule.Name, hub)
		}

	case models.ActionCompleteAllItems:
		// Complete all checklist items on this card
		var checklists []models.Checklist
		if err := database.DB.Where("card_id = ?", payload.CardID).Find(&checklists).Error; err != nil {
			log.Printf("Automation Engine: Error finding checklists: %v", err)
			return
		}

		for _, ch := range checklists {
			database.DB.Model(&models.ChecklistItem{}).Where("checklist_id = ?", ch.ID).Update("is_checked", true)
		}

		// Broadcast
		if hub != nil {
			hub.BroadcastToBoard(payload.BoardID.String(), "card_updated", payload.CardID)
			LogActivity(payload.BoardID, &payload.CardID, systemUserID, "automation_rule", "completed all items via rule: "+rule.Name, hub)
		}
	}
}

// EvaluateOnChecklistUpdate is a helper to run automation when checklist items are modified.
func EvaluateOnChecklistUpdate(cardID uuid.UUID, hub *ws.Hub) {
	// Find board ID first
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cardID).Error; err != nil {
		return
	}

	payload := TriggerPayload{
		TriggerType: models.TriggerChecklistComplete,
		CardID:      cardID,
		BoardID:     card.List.BoardID,
		ListID:      card.ListID,
	}

	// Trigger automation asynchronously or synchronously
	go RunAutomations(payload, hub)
}

// EvaluateOnCardMoved is a helper to run automation when card is moved.
func EvaluateOnCardMoved(cardID uuid.UUID, destListID uuid.UUID, hub *ws.Hub) {
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cardID).Error; err != nil {
		return
	}

	payload := TriggerPayload{
		TriggerType: models.TriggerCardMovedToList,
		CardID:      cardID,
		BoardID:     card.List.BoardID,
		ListID:      destListID,
	}

	go RunAutomations(payload, hub)
}

// EvaluateOnCardCreated is a helper to run automation when card is created.
func EvaluateOnCardCreated(cardID uuid.UUID, listID uuid.UUID, hub *ws.Hub) {
	var card models.Card
	if err := database.DB.Preload("List").First(&card, "id = ?", cardID).Error; err != nil {
		return
	}

	payload := TriggerPayload{
		TriggerType: models.TriggerCardCreatedInList,
		CardID:      cardID,
		BoardID:     card.List.BoardID,
		ListID:      listID,
	}

	go RunAutomations(payload, hub)
}
