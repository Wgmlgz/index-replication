package notifications

import (
	"bytes"
	"embed"
	"fmt"
	"strings"
	"text/template"

	"server/internal/usersettings"
)

type RebalanceExecutionStartedTemplateData struct {
	RunID        int
	PortfolioID  int
	PlannedItems int
	Provider     string
	AsOfDate     string
}

type RebalanceExecutionFinishedTemplateData struct {
	RunID           int
	PortfolioID     int
	Status          string
	TotalItems      int
	CompletedItems  int
	FailedItems     int
	UnresolvedItems int
	AsOfDate        string
}

//go:embed templates/**/*.tmpl
var rebalanceExecutionTemplateFS embed.FS

var (
	rebalanceExecutionStartedSubjectTemplates = map[string]*template.Template{
		"en": mustParseTemplateFile("templates/en/rebalance_execution_started_subject.tmpl"),
	}
	rebalanceExecutionStartedBodyTemplates = map[string]*template.Template{
		"en": mustParseTemplateFile("templates/en/rebalance_execution_started_body.tmpl"),
	}
	rebalanceExecutionFinishedSubjectTemplates = map[string]*template.Template{
		"en": mustParseTemplateFile("templates/en/rebalance_execution_finished_subject.tmpl"),
	}
	rebalanceExecutionFinishedBodyTemplates = map[string]*template.Template{
		"en": mustParseTemplateFile("templates/en/rebalance_execution_finished_body.tmpl"),
	}
)

func BuildRebalanceExecutionStartedMessage(
	language string,
	data RebalanceExecutionStartedTemplateData,
) (Message, error) {
	key := templateLanguageKey(language)
	subjectTmpl, ok := rebalanceExecutionStartedSubjectTemplates[key]
	if !ok {
		return Message{}, fmt.Errorf("rebalance execution start subject template not found for language %s", key)
	}
	bodyTmpl, ok := rebalanceExecutionStartedBodyTemplates[key]
	if !ok {
		return Message{}, fmt.Errorf("rebalance execution start body template not found for language %s", key)
	}

	subject, err := executeTemplate(subjectTmpl, data)
	if err != nil {
		return Message{}, err
	}
	body, err := executeTemplate(bodyTmpl, data)
	if err != nil {
		return Message{}, err
	}
	return Message{
		Subject: subject,
		Body:    body,
	}, nil
}

func BuildRebalanceExecutionFinishedMessage(
	language string,
	data RebalanceExecutionFinishedTemplateData,
) (Message, error) {
	key := templateLanguageKey(language)
	subjectTmpl, ok := rebalanceExecutionFinishedSubjectTemplates[key]
	if !ok {
		return Message{}, fmt.Errorf("rebalance execution finish subject template not found for language %s", key)
	}
	bodyTmpl, ok := rebalanceExecutionFinishedBodyTemplates[key]
	if !ok {
		return Message{}, fmt.Errorf("rebalance execution finish body template not found for language %s", key)
	}

	subject, err := executeTemplate(subjectTmpl, data)
	if err != nil {
		return Message{}, err
	}
	body, err := executeTemplate(bodyTmpl, data)
	if err != nil {
		return Message{}, err
	}
	return Message{
		Subject: subject,
		Body:    body,
	}, nil
}

func templateLanguageKey(raw string) string {
	return usersettings.NormalizeLanguage(raw)
}

func executeTemplate(tmpl *template.Template, data interface{}) (string, error) {
	var buffer bytes.Buffer
	if err := tmpl.Execute(&buffer, data); err != nil {
		return "", err
	}
	return strings.TrimSpace(buffer.String()), nil
}

func mustParseTemplateFile(path string) *template.Template {
	return template.Must(template.ParseFS(rebalanceExecutionTemplateFS, path))
}
