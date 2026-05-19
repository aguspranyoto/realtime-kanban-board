package utils

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

// SendEmail sends an email using the Resend API.
func SendEmail(apiKey string, to string, subject string, htmlContent string) error {
	if apiKey == "" {
		fmt.Println("Warning: RESEND_API_KEY is not set, skipping email dispatch.")
		return nil
	}

	url := "https://api.resend.com/emails"

	// Resend free tier onboarding requires sending from onboarding@resend.dev
	from := "Trello Clone <onboarding@resend.dev>"

	payload := map[string]interface{}{
		"from":    from,
		"to":      []string{to},
		"subject": subject,
		"html":    htmlContent,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("failed to create email request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send email request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("resend API returned non-OK status: %s", resp.Status)
	}

	return nil
}
