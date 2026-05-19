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

	"github.com/aguspranyoto/trello-clone/config"
	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/models"
	"github.com/aguspranyoto/trello-clone/utils"
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

	// TODO: Send verification email via Resend

	// Generate JWT
	token, err := utils.GenerateJWT(user.ID, user.Email, h.Config.JWTSecret)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	// Set HTTP-only cookie for web clients
	c.Cookie(&fiber.Cookie{
		Name:     "token",
		Value:    token,
		HTTPOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: "Lax",
		Expires:  time.Now().Add(time.Hour * 24 * 7),
	})

	return c.Status(fiber.StatusCreated).JSON(AuthResponse{
		Token: token,
		User:  toUserResponse(user),
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
