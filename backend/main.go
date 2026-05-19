package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"

	"github.com/aguspranyoto/trello-clone/config"
	"github.com/aguspranyoto/trello-clone/database"
	"github.com/aguspranyoto/trello-clone/routes"
	"github.com/aguspranyoto/trello-clone/workers"
	"github.com/aguspranyoto/trello-clone/ws"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	database.Connect(cfg)

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Trello Clone API",
	})

	// Middleware
	app.Use(fiberlogger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "http://localhost:3000",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, PATCH, OPTIONS",
		AllowCredentials: true,
	}))

	// Start WebSocket Hub
	hub := ws.NewHub()
	go hub.Run()

	// Start Due Date background worker
	workers.StartDueDateWorker(cfg, hub)

	// Setup routes
	routes.Setup(app, cfg, hub)

	// Start server
	log.Fatal(app.Listen(":8080"))
}
