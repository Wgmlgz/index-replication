package handler

import (
	"encoding/json"
	"errors"
	"io"

	"github.com/gin-gonic/gin"

	"index-replication/api/internal/api"
)

func WriteJSON(c *gin.Context, status int, payload interface{}) {
	c.JSON(status, payload)
}

func WriteError(c *gin.Context, status int, message string) {
	WriteJSON(c, status, api.ErrorResponse{Message: message})
}

func DecodeJSON(c *gin.Context, dst interface{}) error {
	if c.Request.Body == nil {
		return errors.New("empty body")
	}

	decoder := json.NewDecoder(io.LimitReader(c.Request.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return errors.New("unexpected additional data")
	}
	return nil
}

func readCookie(c *gin.Context, name string) (string, error) {
	return c.Cookie(name)
}
