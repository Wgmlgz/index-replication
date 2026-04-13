package main

import (
	"log"
	_ "server/docs"
	"server/internal/config"
	"server/internal/migrations"
	"server/internal/repository"
	"server/internal/routes"
	"server/internal/services"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

//	@title			Retail API
//	@version		1.0
//	@description	API for managing retail stuff, users, organizations, and audit logs.
//	@termsOfService	http://swagger.io/terms/

//	@contact.name	API Support
//	@contact.url	http://www.swagger.io/support
//	@contact.email	support@swagger.io

//	@license.name	Apache 2.0
//	@license.url	http://www.apache.org/licenses/LICENSE-2.0.html

//	@host		localhost:8080
//	@BasePath	/api

//	@securityDefinitions.basic	BasicAuth

// @externalDocs.description	OpenAPI
// @externalDocs.url			https://swagger.io/resources/open-api/
func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Initialize database
	db := config.InitDB(cfg)

	repoRegistry := repository.NewRepositoryRegistry(db)

	auditService := services.NewAuditService(db)

	if cfg.RunMigrations {
		sqlDB, err := db.DB()
		if err != nil {
			log.Fatal("Failed to get sql.DB:", err)
		}
		if err := migrations.Up(sqlDB, cfg.MigrationsDir); err != nil {
			log.Fatal("Failed to run migrations:", err)
		}
	}

	// Auto migrate the schema (commented out to avoid foreign key constraint issues)
	// if err := db.AutoMigrate(&models.User{}); err != nil {
	// 	log.Fatal("Failed to migrate database:", err)
	// }

	// Create and run server
	router := routes.SetupRouter(db, cfg, repoRegistry, auditService)
	router.GET("/api/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	log.Fatal(router.Run(":" + cfg.ServerPort))
}
