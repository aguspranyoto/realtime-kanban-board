package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration values for the application.
type Config struct {
	// Database
	DBHost     string
	DBUser     string
	DBPassword string
	DBName     string
	DBPort     string

	// JWT
	JWTSecret string

	// Google OAuth
	GoogleClientID     string
	GoogleClientSecret string

	// Resend
	ResendAPIKey string

	// URLs
	BackendURL  string
	WebURL      string
	CORSOrigins string

	// Cloudflare R2
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2BucketName      string

	// Server Config
	BodyLimit int
}

// Load reads the .env file and returns a Config struct.
func Load() *Config {
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, reading from environment variables")
	}

	return &Config{
		DBHost:             getEnv("DB_HOST", "localhost"),
		DBUser:             getEnv("DB_USER", "postgres"),
		DBPassword:         getEnv("DB_PASSWORD", "password"),
		DBName:             getEnv("DB_NAME", "realtime_kanban_board"),
		DBPort:             getEnv("DB_PORT", "5432"),
		JWTSecret:          getEnv("JWT_SECRET", "default_secret_change_me"),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		ResendAPIKey:       getEnv("RESEND_API_KEY", ""),
		BackendURL:         getEnv("BACKEND_URL", "http://localhost:8080"),
		WebURL:             getEnv("WEB_URL", "http://localhost:3000"),
		CORSOrigins:        getEnv("CORS_ORIGINS", "http://localhost:3000, http://localhost:8081"),
		R2AccountID:        getEnv("R2_ACCOUNT_ID", ""),
		R2AccessKeyID:      getEnv("R2_ACCESS_KEY_ID", ""),
		R2SecretAccessKey:  getEnv("R2_SECRET_ACCESS_KEY", ""),
		R2BucketName:       getEnv("R2_BUCKET_NAME", ""),
		BodyLimit:          getEnvAsInt("BODY_LIMIT", 20*1024*1024),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	if value, ok := os.LookupEnv(key); ok {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return fallback
}
