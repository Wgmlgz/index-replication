import { useMemo, useState } from "react";
import type { IChangeEvent } from "@rjsf/core";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import { useTranslation } from "react-i18next";

import type {
  PortfolioActionFormConfig,
  PortfolioActionFormData,
} from "@/app/portfolio/components/portfolio-summary-actions/portfolio-action-form-schema";
import type { PortfolioSimpleActionProps } from "@/app/portfolio/components/portfolio-summary-actions/types";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";

type PortfolioActionRJSFFormProps = PortfolioSimpleActionProps & {
  config: PortfolioActionFormConfig;
};

export function PortfolioActionRJSFForm({
  action,
  working,
  onRunAction,
  config,
}: PortfolioActionRJSFFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<PortfolioActionFormData>(
    () => config.getDefaultFormData?.() ?? {},
  );

  const submitDisabled = working || (config.isSubmitDisabled?.(formData) ?? false);

  const uiSchema = useMemo<UiSchema<PortfolioActionFormData, RJSFSchema>>(
    () => ({
      ...(config.uiSchema ?? {}),
      "ui:submitButtonOptions": {
        submitText: action.label || t("portfolio.card.runAction"),
        props: {
          disabled: submitDisabled,
        },
      },
    }),
    [action.label, config.uiSchema, submitDisabled, t],
  );

  const actionID = action.id || "";

  const handleChange = ({ formData: nextFormData }: IChangeEvent<PortfolioActionFormData>) => {
    const normalizedFormData = nextFormData ?? {};
    setFormData(normalizedFormData);
  };

  const handleSubmit = ({ formData: nextFormData }: IChangeEvent<PortfolioActionFormData>) => {
    if (!actionID) {
      return;
    }

    const normalizedFormData = nextFormData ?? {};
    void onRunAction(
      actionID,
      config.buildPayload(normalizedFormData),
    );
  };

  return (
    <Form
      schema={config.schema}
      uiSchema={uiSchema}
      formData={formData}
      onChange={handleChange}
      onSubmit={handleSubmit}
      customValidate={config.customValidate}
      showErrorList={false}
      disabled={working}
      noHtml5Validate
      validator={validator}
    />
  );
}
