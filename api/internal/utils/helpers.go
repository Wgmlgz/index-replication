package utils

import "github.com/gin-gonic/gin"

// CustomContextKey is the key for storing the custom context in gin.Context
const CustomContextKey = "request_context"

// RequestContext holds request-scoped data in a strongly-typed manner.
type RequestContext struct {
	UserID  int
	RoleKey string
}

// GetRequestContext retrieves the custom context from the Gin context.
// It panics if the context is not found, as it should always be present after the auth middleware.
func GetRequestContext(c *gin.Context) *RequestContext {
	ctx, exists := c.Get(CustomContextKey)
	if !exists {
		panic("request context not found")
	}
	return ctx.(*RequestContext)
}
