package notifications

import (
	"context"
	"errors"
	"testing"
)

type testChannel struct {
	key     string
	err     error
	calls   int
	lastUID int
	lastMsg Message
}

func (c *testChannel) Key() string {
	return c.key
}

func (c *testChannel) Send(_ context.Context, userID int, message Message) error {
	c.calls++
	c.lastUID = userID
	c.lastMsg = message
	return c.err
}

func TestServiceSend_FirstSuccessfulChannelStops(t *testing.T) {
	first := &testChannel{key: "telegram"}
	second := &testChannel{key: "backup"}
	svc := NewService(first, second)

	err := svc.Send(context.Background(), SendRequest{
		UserID:   42,
		Message:  Message{Subject: "Hello", Body: "World"},
		Channels: []string{"telegram", "backup"},
	})
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if first.calls != 1 {
		t.Fatalf("expected first channel to be called once, got %d", first.calls)
	}
	if second.calls != 0 {
		t.Fatalf("expected second channel not to be called, got %d", second.calls)
	}
}

func TestServiceSend_FallbackToNextChannel(t *testing.T) {
	first := &testChannel{key: "telegram", err: errors.New("down")}
	second := &testChannel{key: "backup"}
	svc := NewService(first, second)

	err := svc.Send(context.Background(), SendRequest{
		UserID:   42,
		Message:  Message{Body: "Only body"},
		Channels: []string{"telegram", "backup"},
	})
	if err != nil {
		t.Fatalf("expected fallback success, got %v", err)
	}
	if first.calls != 1 || second.calls != 1 {
		t.Fatalf("expected both channels to be called once, got first=%d second=%d", first.calls, second.calls)
	}
}

func TestServiceSend_ChannelNotFound(t *testing.T) {
	svc := NewService(&testChannel{key: "telegram"})
	err := svc.Send(context.Background(), SendRequest{
		UserID:   42,
		Message:  Message{Body: "test"},
		Channels: []string{"email"},
	})
	if !errors.Is(err, ErrChannelNotFound) {
		t.Fatalf("expected ErrChannelNotFound, got %v", err)
	}
}
