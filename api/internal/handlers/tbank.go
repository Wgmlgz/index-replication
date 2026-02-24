package handlers

import (
	"errors"
	"net/http"

	"server/internal/models"
	"server/internal/services"
	"server/internal/utils"

	"github.com/gin-gonic/gin"
)

type TBankHandler struct {
	tbankService *services.TBankService
}

func NewTBankHandler(tbankService *services.TBankService) *TBankHandler {
	return &TBankHandler{tbankService: tbankService}
}

// GetStatus godoc
//
//	@Summary		Get T-Bank integration status
//	@Description	Returns current user T-Bank connection state and available accounts
//	@Tags			tbank
//	@Produce		json
//	@Success		200	{object}	models.TBankConnectionStatusResponse
//	@Failure		500	{object}	models.ErrorResponse
//	@Router			/me/tbank [get]
func (h *TBankHandler) GetStatus(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	resp, err := h.tbankService.GetStatus(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to load T-Bank status"})
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Connect godoc
//
//	@Summary		Connect T-Bank account
//	@Description	Saves user token/environment and verifies access by loading accounts
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.TBankConnectRequest	true	"T-Bank connect payload"
//	@Success		200		{object}	models.TBankConnectionStatusResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		502		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/me/tbank/connect [post]
func (h *TBankHandler) Connect(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.TBankConnectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.Connect(c.Request.Context(), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrTBankInvalidEnv), errors.Is(err, services.ErrTBankAuthFailed):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusBadGateway, models.ErrorResponse{Error: err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, resp)
}

// Disconnect godoc
//
//	@Summary		Disconnect T-Bank account
//	@Description	Removes saved T-Bank credentials for the current user
//	@Tags			tbank
//	@Produce		json
//	@Success		200	{object}	map[string]bool
//	@Failure		500	{object}	models.ErrorResponse
//	@Router			/me/tbank/disconnect [post]
func (h *TBankHandler) Disconnect(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID
	if err := h.tbankService.Disconnect(userID); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Error: "Failed to disconnect T-Bank"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// CreateTestBuyOrder godoc
//
//	@Summary		Create T-Bank test buy order
//	@Description	Places a market buy order using the connected user T-Bank account
//	@Tags			tbank
//	@Accept			json
//	@Produce		json
//	@Param			payload	body		models.TBankTestBuyRequest	true	"T-Bank test buy payload"
//	@Success		200		{object}	models.TBankTestBuyResponse
//	@Failure		400		{object}	models.ErrorResponse
//	@Failure		502		{object}	models.ErrorResponse
//	@Failure		500		{object}	models.ErrorResponse
//	@Router			/me/tbank/test-buy [post]
func (h *TBankHandler) CreateTestBuyOrder(c *gin.Context) {
	userID := utils.GetRequestContext(c).UserID

	var req models.TBankTestBuyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: "Invalid payload"})
		return
	}

	resp, err := h.tbankService.CreateTestBuyOrder(c.Request.Context(), userID, &req)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrTBankNotConnected),
			errors.Is(err, services.ErrTBankNoAccountFound),
			errors.Is(err, services.ErrTBankAuthFailed),
			errors.Is(err, services.ErrTBankInvalidEnv):
			c.JSON(http.StatusBadRequest, models.ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusBadGateway, models.ErrorResponse{Error: err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}
