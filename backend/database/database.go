package database

import (
	"fmt"
	"log"

	"github.com/aguspranyoto/realtime-kanban-board/config"
	"github.com/aguspranyoto/realtime-kanban-board/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// DB is the global database instance.
var DB *gorm.DB

// Connect initializes the PostgreSQL database connection and runs auto-migrations.
func Connect(cfg *config.Config) {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Jakarta",
		cfg.DBHost, cfg.DBUser, cfg.DBPassword, cfg.DBName, cfg.DBPort,
	)

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix: "realtime_kanban_board_", // Prefix khusus untuk project Realtime Kanban Board
		},
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("✅ Database connected successfully")

	// Auto migrate all models
	err = DB.AutoMigrate(
		&models.User{},
		&models.Workspace{},
		&models.WorkspaceMember{},
		&models.Board{},
		&models.List{},
		&models.Card{},
		&models.Label{},
		&models.CardLabel{},
		&models.Checklist{},
		&models.ChecklistItem{},
		&models.CardMember{},
		&models.Comment{},
		&models.Activity{},
		&models.Notification{},
		&models.Attachment{},
		&models.AutomationRule{},
	)
	if err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	log.Println("✅ Database migrated successfully")
}
