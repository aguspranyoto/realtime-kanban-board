package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
	"time"

	"github.com/aguspranyoto/realtime-kanban-board/config"
	"github.com/aguspranyoto/realtime-kanban-board/database"
	"github.com/aguspranyoto/realtime-kanban-board/routes"
	"github.com/aguspranyoto/realtime-kanban-board/storage"
	"github.com/aguspranyoto/realtime-kanban-board/workers"
	"github.com/aguspranyoto/realtime-kanban-board/ws"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	database.Connect(cfg)

	// Initialize Cloudflare R2 client
	r2, err := storage.NewR2Client(cfg)
	if err != nil {
		log.Printf("Warning: R2 client initialization failed: %v", err)
		r2 = nil
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName:   "Realtime Kanban Board API",
		BodyLimit: cfg.BodyLimit,
	})

	// Middleware
	app.Use(fiberlogger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: true,
	}))
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
	}))

	// Start WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Start Due Date background worker
	workers.StartDueDateWorker(cfg, hub)

	// Setup routes
	routes.Setup(app, cfg, hub, r2)

	// Start server
	log.Fatal(app.Listen(":8080"))
}

