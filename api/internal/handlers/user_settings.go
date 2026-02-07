package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"server/internal/models"
	"server/internal/repository"
	"server/internal/utils"
)

type UserSettingsHandler struct {
	repo *repository.UserSettingsRepository
}

func NewUserSettingsHandler(repo *repository.UserSettingsRepository) *UserSettingsHandler {
	return &UserSettingsHandler{repo: repo}
}

// GetSettings godoc
//
//	@Summary		Get current user settings
//	@Description	Returns settings for the current user, including favorites
//	@Tags			settings
//	@Produce		json
//	@Success		200	{object}	models.UserSettingsResponse
//	@Failure		500	{object}	models.ErrorResponse
//	@Router			/me/settings [get]
func (h *UserSettingsHandler) GetSettings(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	favorites, err := h.repo.GetFavoriteIndexes(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	values, err := h.repo.GetSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, models.UserSettingsResponse{
		Favorites: favorites,
		Values:    values,
	})
}

// PatchSettings godoc
//
//	@Summary		Update current user settings
//	@Description	Updates settings for the current user, including favorites
//	@Tags			settings
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.UserSettingsPatchRequest	true	"Settings payload"
//	@Success		200	{object}	models.UserSettingsResponse
//	@Failure		400	{object}	models.ErrorResponse
//	@Failure		500	{object}	models.ErrorResponse
//	@Router			/me/settings [patch]
func (h *UserSettingsHandler) PatchSettings(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.UserSettingsPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	if req.Values != nil {
		if err := h.repo.UpsertSettings(userID, *req.Values); err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
			return
		}
	}

	if req.Favorites != nil {
		normalized := normalizeFavorites(*req.Favorites)
		if err := h.repo.ReplaceFavoriteIndexes(userID, normalized); err != nil {
			c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
			return
		}
	}

	favorites, err := h.repo.GetFavoriteIndexes(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	values, err := h.repo.GetSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, models.UserSettingsResponse{
		Favorites: favorites,
		Values:    values,
	})
}

func normalizeFavorites(favorites []string) []string {
	seen := make(map[string]struct{}, len(favorites))
	result := make([]string, 0, len(favorites))
	for _, secid := range favorites {
		trimmed := strings.TrimSpace(secid)
		if trimmed == "" {
			continue
		}
		upper := strings.ToUpper(trimmed)
		if _, exists := seen[upper]; exists {
			continue
		}
		seen[upper] = struct{}{}
		result = append(result, upper)
	}
	return result
}
