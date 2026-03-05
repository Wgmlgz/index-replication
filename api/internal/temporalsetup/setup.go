package temporalsetup

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	enumspb "go.temporal.io/api/enums/v1"
	operatorservice "go.temporal.io/api/operatorservice/v1"
	"go.temporal.io/api/serviceerror"
	workflowservice "go.temporal.io/api/workflowservice/v1"
	"go.temporal.io/sdk/client"
	"google.golang.org/protobuf/types/known/durationpb"
)

type SetupOptions struct {
	Address                 string
	Namespace               string
	TaskQueue               string
	TimeZone                string
	EnableSearchAttributes  bool
	EnableMonthlyDeepResync bool
	NamespaceRetentionDays  int
	WaitTimeout             time.Duration
	WaitInterval            time.Duration
}

func Run(ctx context.Context, options SetupOptions) error {
	if options.Address == "" {
		return errors.New("temporal address is required")
	}
	if options.Namespace == "" {
		return errors.New("temporal namespace is required")
	}
	if options.TaskQueue == "" {
		return errors.New("temporal task queue is required")
	}
	if options.TimeZone == "" {
		return errors.New("temporal schedule timezone is required")
	}
	if options.NamespaceRetentionDays <= 0 {
		options.NamespaceRetentionDays = 3
	}
	if options.WaitTimeout <= 0 {
		options.WaitTimeout = 2 * time.Minute
	}
	if options.WaitInterval <= 0 {
		options.WaitInterval = 3 * time.Second
	}

	adminClient, err := client.Dial(client.Options{
		HostPort: options.Address,
	})
	if err != nil {
		return fmt.Errorf("temporal admin dial failed: %w", err)
	}
	defer adminClient.Close()

	if err := waitForServerReady(ctx, adminClient, options.WaitTimeout, options.WaitInterval); err != nil {
		return err
	}
	if err := ensureNamespace(ctx, adminClient, options.Namespace, options.NamespaceRetentionDays); err != nil {
		return err
	}
	if err := waitForNamespaceReady(ctx, adminClient, options.Namespace, options.WaitTimeout, options.WaitInterval); err != nil {
		return err
	}

	ensureSearchAttributes(ctx, adminClient, options.Namespace)

	namespaceClient, err := client.Dial(client.Options{
		HostPort:  options.Address,
		Namespace: options.Namespace,
	})
	if err != nil {
		return fmt.Errorf("temporal namespace dial failed: %w", err)
	}
	defer namespaceClient.Close()

	if err := ApplySchedules(ctx, namespaceClient, ScheduleOptions{
		TaskQueue:               options.TaskQueue,
		TimeZone:                options.TimeZone,
		EnableSearchAttributes:  options.EnableSearchAttributes,
		EnableMonthlyDeepResync: options.EnableMonthlyDeepResync,
	}); err != nil {
		return err
	}

	return nil
}

func waitForServerReady(ctx context.Context, temporalClient client.Client, timeout, retryInterval time.Duration) error {
	workflowService := temporalClient.WorkflowService()
	deadline := time.Now().Add(timeout)
	attempt := 0

	for {
		attempt++
		_, err := workflowService.GetSystemInfo(ctx, &workflowservice.GetSystemInfoRequest{})
		if err == nil {
			log.Printf("Temporal is ready after %d attempt(s)", attempt)
			return nil
		}

		if time.Now().After(deadline) {
			return fmt.Errorf("temporal server did not become ready within %s: %w", timeout, err)
		}

		log.Printf("Temporal not ready yet (attempt %d): %v", attempt, err)
		time.Sleep(retryInterval)
	}
}

func ensureNamespace(ctx context.Context, temporalClient client.Client, namespace string, retentionDays int) error {
	workflowService := temporalClient.WorkflowService()

	_, err := workflowService.DescribeNamespace(ctx, &workflowservice.DescribeNamespaceRequest{
		Namespace: namespace,
	})
	if err == nil {
		log.Printf("Namespace %q already exists", namespace)
		return nil
	}

	var notFoundErr *serviceerror.NamespaceNotFound
	if !errors.As(err, &notFoundErr) {
		return fmt.Errorf("failed to describe namespace %q: %w", namespace, err)
	}

	_, err = workflowService.RegisterNamespace(ctx, &workflowservice.RegisterNamespaceRequest{
		Namespace:                        namespace,
		WorkflowExecutionRetentionPeriod: durationpb.New(time.Duration(retentionDays) * 24 * time.Hour),
	})
	if err != nil {
		var alreadyExistsErr *serviceerror.NamespaceAlreadyExists
		if errors.As(err, &alreadyExistsErr) {
			log.Printf("Namespace %q already exists", namespace)
			return nil
		}
		return fmt.Errorf("failed to register namespace %q: %w", namespace, err)
	}

	log.Printf("Namespace %q created", namespace)
	return nil
}

func waitForNamespaceReady(ctx context.Context, temporalClient client.Client, namespace string, timeout, retryInterval time.Duration) error {
	workflowService := temporalClient.WorkflowService()
	deadline := time.Now().Add(timeout)
	attempt := 0

	for {
		attempt++
		_, err := workflowService.DescribeNamespace(ctx, &workflowservice.DescribeNamespaceRequest{
			Namespace: namespace,
		})
		if err == nil {
			return nil
		}

		var notFoundErr *serviceerror.NamespaceNotFound
		if !errors.As(err, &notFoundErr) {
			return fmt.Errorf("failed while waiting for namespace %q: %w", namespace, err)
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("namespace %q did not become available within %s", namespace, timeout)
		}

		log.Printf("Namespace %q not available yet (attempt %d)", namespace, attempt)
		time.Sleep(retryInterval)
	}
}

func ensureSearchAttributes(ctx context.Context, temporalClient client.Client, namespace string) {
	operatorService := temporalClient.OperatorService()
	desired := map[string]enumspb.IndexedValueType{
		"MoexDataset":   enumspb.INDEXED_VALUE_TYPE_KEYWORD,
		"MoexSecid":     enumspb.INDEXED_VALUE_TYPE_KEYWORD,
		"MoexMode":      enumspb.INDEXED_VALUE_TYPE_KEYWORD,
		"MoexProgress":  enumspb.INDEXED_VALUE_TYPE_KEYWORD,
		"MoexProcessed": enumspb.INDEXED_VALUE_TYPE_INT,
		"MoexTotal":     enumspb.INDEXED_VALUE_TYPE_INT,
	}

	currentAttrs := map[string]enumspb.IndexedValueType{}
	listResp, err := operatorService.ListSearchAttributes(ctx, &operatorservice.ListSearchAttributesRequest{
		Namespace: namespace,
	})
	if err != nil {
		log.Printf("Search attribute list failed (will still try adds): %v", err)
	} else {
		for name, valueType := range listResp.GetCustomAttributes() {
			currentAttrs[name] = valueType
		}
	}

	for attrName, attrType := range desired {
		if _, exists := currentAttrs[attrName]; exists {
			log.Printf("Search attribute %q already exists", attrName)
			continue
		}

		_, err := operatorService.AddSearchAttributes(ctx, &operatorservice.AddSearchAttributesRequest{
			Namespace: namespace,
			SearchAttributes: map[string]enumspb.IndexedValueType{
				attrName: attrType,
			},
		})
		if err != nil {
			var alreadyExistsErr *serviceerror.AlreadyExists
			if errors.As(err, &alreadyExistsErr) {
				log.Printf("Search attribute %q already exists", attrName)
				continue
			}
			log.Printf("Search attribute %q registration skipped: %v", attrName, err)
			continue
		}

		log.Printf("Search attribute %q registered", attrName)
	}
}
