package dto

import "time"

type LoginRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	RememberMe bool   `json:"remember_me"`
} //@name LoginRequest

type PasswordChangeRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
} //@name PasswordChangeRequest

type LoginVerifyRequest struct {
	ChallengeID string `json:"challenge_id"`
} //@name LoginVerifyRequest

type LoginVerificationPendingResponse struct {
	VerificationRequired bool      `json:"verification_required"`
	ChallengeID          string    `json:"challenge_id"`
	ExpiresAt            time.Time `json:"expires_at"`
} //@name LoginVerificationPendingResponse

type LoginVerifyStatusResponse struct {
	Status string `json:"status"`
} //@name LoginVerifyStatusResponse
