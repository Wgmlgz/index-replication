package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"server/internal/api/dto"
	"server/internal/repository"
	"server/internal/usersettings"
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
//	@Success		200	{object}	dto.UserSettingsResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/settings [get]
func (h *UserSettingsHandler) GetSettings(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	favorites, err := h.repo.GetFavoriteIndexes(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	values, err := h.repo.GetSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, dto.UserSettingsResponse{
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
//	@Param			payload	body		dto.UserSettingsPatchRequest	true	"Settings payload"
//	@Success		200	{object}	dto.UserSettingsResponse
//	@Failure		400	{object}	dto.ErrorResponse
//	@Failure		500	{object}	dto.ErrorResponse
//	@Router			/me/settings [patch]
func (h *UserSettingsHandler) PatchSettings(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req dto.UserSettingsPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "Invalid payload"})
		return
	}

	if req.Values != nil {
		if err := h.repo.UpsertSettings(userID, usersettings.NormalizePatchValues(*req.Values)); err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
			return
		}
	}

	if req.Favorites != nil {
		normalized := normalizeFavorites(*req.Favorites)
		if err := h.repo.ReplaceFavoriteIndexes(userID, normalized); err != nil {
			c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
			return
		}
	}

	favorites, err := h.repo.GetFavoriteIndexes(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	values, err := h.repo.GetSettings(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "Database error"})
		return
	}

	c.JSON(http.StatusOK, dto.UserSettingsResponse{
		Favorites: favorites,
		Values:    values,
	})
}

func normalizeFavorites(favorites []string) []string {
	seen := make(map[string]struct{}, len(favorites))
	result := make([]string, 0, len(favorites))
	for _, secid := range favorites {
		if secid == "" {
			continue
		}
		if _, exists := seen[secid]; exists {
			continue
		}
		seen[secid] = struct{}{}
		result = append(result, secid)
	}
	return result
}
