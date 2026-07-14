package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/aguspranyoto/realtime-kanban-board/config"
	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/models"
	"github.com/aguspranyoto/realtime-kanban-board/utils"
	"github.com/resend/resend-go/v2"
)

type AuthHandler struct {
	Config *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{Config: cfg}
}

// --- Request / Response DTOs ---

type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string       `json:"token"`
	User  UserResponse `json:"user"`
}

type UserResponse struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	Email           string    `json:"email"`
	AvatarURL       string    `json:"avatar_url"`
	Provider        string    `json:"provider"`
	IsEmailVerified bool      `json:"is_email_verified"`
}

// --- Handlers ---

// Register creates a new user with email and password.
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" || req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name, email and password are required"})
	}

	// Check if user already exists
	var existing models.User
	if result := database.DB.Where("email = ?", req.Email).First(&existing); result.Error == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": "Email already registered"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	// Generate verification token
	verificationToken := uuid.New().String()

	user := models.User{
		Name:              req.Name,
		Email:             req.Email,
		Password:          string(hashedPassword),
		Provider:          "local",
		IsEmailVerified:   false,
		VerificationToken: verificationToken,
	}

	if result := database.DB.Create(&user); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
	}

	// Send verification email via Resend
	client := resend.NewClient(h.Config.ResendAPIKey)
	emailHTML := fmt.Sprintf(`
	<!DOCTYPE html>
	<html>
	<head>
		<style>
			body { margin: 0; padding: 0; background-color: #f4f4f4; }
			.container { max-width: 600px; margin: 0 auto; background-color: #ffffff; font-family: Arial, sans-serif; text-align: center; color: #000000; }
			.logo-area { padding: 10px 20px; }
			.logo-area h1 { margin: 0; font-size: 16px; font-weight: bold; letter-spacing: 1px; color: #000000; }
			.hero { background-color: #000000; color: #ffffff; padding: 50px 20px; }
			.hero-icon { font-size: 32px; margin-bottom: 15px; }
			.hero-sub { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 15px; }
			.hero-title { font-size: 22px; margin: 0; font-weight: normal; }
			.content-area { padding: 50px 40px; }
			.content-area p { font-size: 16px; line-height: 1.5; margin-bottom: 40px; color: #000000; }
			.btn { background-color: #000000; color: #ffffff !important; text-decoration: none; padding: 16px 40px; font-weight: bold; font-size: 14px; display: inline-block; border-radius: 4px; text-transform: uppercase; }
			.signature { font-size: 16px; margin-top: 50px; color: #000000; }
			.signature-name { font-weight: bold; margin-top: 5px; }
		</style>
	</head>
	<body>
		<div class="container">
			<div class="logo-area">
				<h1>AGUSP.COM</h1>
			</div>
			<div class="hero">
				<div class="hero-sub">Thanks for signing up!</div>
				<h2 class="hero-title">Verify Your E-mail Address</h2>
			</div>
			<div class="content-area">
				<p>Hi,<br><br>You're almost ready to get started. Please click on the button below to verify your email address and start organizing your projects with us!</p>
				<a href="%s/api/auth/verify?token=%s" class="btn">Verify Your Email</a>
				<div class="signature">
					<div style="margin-bottom: 5px;">Thanks,</div>
					<div class="signature-name">Realtime Kanban Board Team</div>
				</div>
			</div>
		</div>
	</body>
	</html>
	`, h.Config.BackendURL, verificationToken)

	params := &resend.SendEmailRequest{
		From:    "Realtime Kanban Board <notifier@agusp.com>",
		To:      []string{user.Email},
		Subject: "Verify your email - Realtime Kanban Board",
		Html:    emailHTML,
	}

	_, err = client.Emails.Send(params)
	if err != nil {
		fmt.Printf("Failed to send verification email: %v\n", err)
		// Delete the user since registration failed
		database.DB.Unscoped().Delete(&user)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": fmt.Sprintf("Failed to send verification email: %v", err),
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "Account created successfully. Please check your email to verify your account.",
	})
}

// Login authenticates a user with email and password.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Email and password are required"})
	}

	// Find user
	var user models.User
	if result := database.DB.Where("email = ?", req.Email).First(&user); result.Error != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	// Check if user is a Google-only user
	if user.Provider == "google" && user.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "This account uses Google sign-in. Please login with Google."})
	}

	// Check if email is verified for local provider
	if user.Provider == "local" && !user.IsEmailVerified {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Please verify your email before logging in."})
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid email or password"})
	}

	// Generate JWT
	token, err := utils.GenerateJWT(user.ID, user.Email, h.Config.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	// Set HTTP-only cookie
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    token,
		HTTPOnly: true,
		Secure:   false,
		SameSite: "Lax",
		Expires:  time.Now().Add(time.Hour * 24 * 7),
	})

	return c.JSON(AuthResponse{
		Token: token,
		User:  toUserResponse(user),
	})
}

// GoogleCallback handles the Google OAuth token verification.
func (h *AuthHandler) GoogleCallback(c *fiber.Ctx) error {
	type GoogleRequest struct {
		Token string `json:"token"` // Google ID token or access token
	}

	var req GoogleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Verify Google token by calling Google's userinfo API
	resp, err := http.Get(fmt.Sprintf("https://www.googleapis.com/oauth2/v3/userinfo?access_token=%s", req.Token))
	if err != nil || resp.StatusCode != http.StatusOK {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid Google token"})
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var googleUser struct {
		Sub     string `json:"sub"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(body, &googleUser); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to parse Google response"})
	}

	// Find or create user
	var user models.User
	result := database.DB.Where("email = ?", googleUser.Email).First(&user)

	if result.Error != nil {
		// Create new user from Google data
		user = models.User{
			Name:            googleUser.Name,
			Email:           googleUser.Email,
			AvatarURL:       googleUser.Picture,
			Provider:        "google",
			IsEmailVerified: true, // Google emails are already verified
		}
		if res := database.DB.Create(&user); res.Error != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
		}
	}

	// Generate JWT
	token, err := utils.GenerateJWT(user.ID, user.Email, h.Config.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	// Set HTTP-only cookie
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    token,
		HTTPOnly: true,
		Secure:   false,
		SameSite: "Lax",
		Expires:  time.Now().Add(time.Hour * 24 * 7),
	})

	return c.JSON(AuthResponse{
		Token: token,
		User:  toUserResponse(user),
	})
}

// GetMe returns the current authenticated user.
func (h *AuthHandler) GetMe(c *fiber.Ctx) error {
	userID := c.Locals("userID").(string)

	var user models.User
	if result := database.DB.Where("id = ?", userID).First(&user); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(toUserResponse(user))
}

// Logout clears the authentication cookie.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    "",
		HTTPOnly: true,
		Secure:   false,
		SameSite: "Lax",
		Expires:  time.Now().Add(-time.Hour),
	})

	return c.JSON(fiber.Map{"message": "Logged out successfully"})
}

// VerifyEmail verifies the user's email using the token sent via email.
func (h *AuthHandler) VerifyEmail(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Token is required"})
	}

	var user models.User
	if result := database.DB.Where("verification_token = ?", token).First(&user); result.Error != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid verification token"})
	}

	user.IsEmailVerified = true
	user.VerificationToken = ""
	if result := database.DB.Save(&user); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to verify email"})
	}

	// Redirect to web frontend
	return c.Redirect(fmt.Sprintf("%s/?verified=true", h.Config.WebURL))
}

// --- Helpers ---

func toUserResponse(user models.User) UserResponse {
	return UserResponse{
		ID:              user.ID,
		Name:            user.Name,
		Email:           user.Email,
		AvatarURL:       user.AvatarURL,
		Provider:        user.Provider,
		IsEmailVerified: user.IsEmailVerified,
	}
}
