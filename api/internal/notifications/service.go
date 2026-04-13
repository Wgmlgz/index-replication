package notifications

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrNoChannelsConfigured = errors.New("no notification channels configured")
	ErrChannelNotFound      = errors.New("notification channel not found")
	ErrNoMessage            = errors.New("notification message is empty")
)

type Message struct {
	Subject string
	Body    string
}

func (m Message) Text() string {
	subject := strings.TrimSpace(m.Subject)
	body := strings.TrimSpace(m.Body)
	if subject == "" {
		return body
	}
	if body == "" {
		return subject
	}
	return subject + "\n\n" + body
}

type SendRequest struct {
	UserID   int
	Message  Message
	Channels []string
}

type Channel interface {
	Key() string
	Send(ctx context.Context, userID int, message Message) error
}

type Service struct {
	channels map[string]Channel
}

func NewService(channels ...Channel) *Service {
	indexed := make(map[string]Channel, len(channels))
	for _, channel := range channels {
		if channel == nil {
			continue
		}
		key := strings.TrimSpace(strings.ToLower(channel.Key()))
		if key == "" {
			continue
		}
		indexed[key] = channel
	}
	return &Service{
		channels: indexed,
	}
}

func (s *Service) Send(ctx context.Context, req SendRequest) error {
	if s == nil || len(s.channels) == 0 {
		return ErrNoChannelsConfigured
	}
	if req.UserID <= 0 {
		return errors.New("invalid user id")
	}
	if strings.TrimSpace(req.Message.Text()) == "" {
		return ErrNoMessage
	}

	targets := make([]string, 0, len(req.Channels))
	if len(req.Channels) == 0 {
		for key := range s.channels {
			targets = append(targets, key)
		}
	} else {
		for _, key := range req.Channels {
			trimmed := strings.TrimSpace(strings.ToLower(key))
			if trimmed == "" {
				continue
			}
			targets = append(targets, trimmed)
		}
	}
	if len(targets) == 0 {
		return ErrNoChannelsConfigured
	}

	var lastErr error
	attempted := 0
	for _, key := range targets {
		channel, ok := s.channels[key]
		if !ok {
			lastErr = fmt.Errorf("%w: %s", ErrChannelNotFound, key)
			continue
		}
		attempted++
		if err := channel.Send(ctx, req.UserID, req.Message); err != nil {
			lastErr = fmt.Errorf("send via %s: %w", key, err)
			continue
		}
		return nil
	}

	if attempted == 0 && lastErr == nil {
		return ErrNoChannelsConfigured
	}
	if lastErr == nil {
		return errors.New("notification delivery failed")
	}
	return lastErr
}
