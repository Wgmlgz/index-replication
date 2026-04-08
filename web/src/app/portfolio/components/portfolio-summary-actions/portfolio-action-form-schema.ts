import type { TFunction } from "i18next";

import {
  DEFAULT_SANDBOX_TOP_UP_UNITS,
} from "@/app/portfolio/components/portfolio-formatting";
import type { FormValidation, RJSFSchema, UiSchema } from "@rjsf/utils";

export type PortfolioActionFormData = Record<string, unknown>;

export type PortfolioActionFormConfig = {
  schema: RJSFSchema;
  uiSchema?: UiSchema<PortfolioActionFormData, RJSFSchema>;
  getDefaultFormData?: () => PortfolioActionFormData;
  buildPayload: (formData: PortfolioActionFormData) => Record<string, unknown>;
  isSubmitDisabled?: (formData: PortfolioActionFormData) => boolean;
  customValidate?: (
    formData: PortfolioActionFormData,
    errors: FormValidation<PortfolioActionFormData>,
  ) => FormValidation<PortfolioActionFormData>;
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function readNumberWithFallback(
  value: unknown,
  fallback: number,
  min: number,
): number {
  const numeric = readNumber(value);
  return Math.max(min, numeric ?? fallback);
}

function currentTimestampISO(): string {
  return new Date().toISOString();
}

function createSandboxPayInConfig(t: TFunction): PortfolioActionFormConfig {
  return {
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["currency", "units"],
      properties: {
        currency: {
          type: "string",
          title: t("portfolio.card.sandboxCurrency"),
          minLength: 1,
          default: "RUB",
        },
        units: {
          type: "integer",
          title: t("portfolio.card.sandboxUnits"),
          minimum: 1,
          default: DEFAULT_SANDBOX_TOP_UP_UNITS,
        },
      },
    },
    buildPayload: (formData) => ({
      currency: readString(formData.currency).toUpperCase() || "RUB",
      units: readNumberWithFallback(formData.units, DEFAULT_SANDBOX_TOP_UP_UNITS, 1),
    }),
  };
}

function createSandboxPayOutConfig(t: TFunction): PortfolioActionFormConfig {
  return {
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["currency", "units"],
      properties: {
        currency: {
          type: "string",
          title: t("portfolio.card.sandboxCurrency"),
          minLength: 1,
          default: "RUB",
        },
        units: {
          type: "integer",
          title: t("portfolio.card.sandboxUnits"),
          minimum: 1,
          default: DEFAULT_SANDBOX_TOP_UP_UNITS,
        },
      },
    },
    buildPayload: (formData) => ({
      currency: readString(formData.currency).toUpperCase() || "RUB",
      units: readNumberWithFallback(formData.units, DEFAULT_SANDBOX_TOP_UP_UNITS, 1),
    }),
  };
}

function createDepositCashConfig(t: TFunction): PortfolioActionFormConfig {
  return {
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["currency", "amount"],
      properties: {
        currency: {
          type: "string",
          title: t("portfolio.card.virtualTradeCurrency"),
          minLength: 1,
          default: "RUB",
        },
        amount: {
          type: "number",
          title: t("portfolio.card.virtualDepositAmount"),
          default: 10000,
        },
        executed_at: {
          type: "string",
          title: t("portfolio.card.virtualTradeDateTime"),
          format: "date-time",
        },
      },
    },
    getDefaultFormData: () => ({
      currency: "RUB",
      amount: 10000,
      executed_at: currentTimestampISO(),
    }),
    buildPayload: (formData) => ({
      currency: readString(formData.currency).toUpperCase() || "RUB",
      amount: readNumber(formData.amount) ?? 0,
      executed_at: readString(formData.executed_at) || undefined,
    }),
    isSubmitDisabled: (formData) => (readNumber(formData.amount) ?? 0) === 0,
  };
}

function createTradeConfig(t: TFunction): PortfolioActionFormConfig {
  return {
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["quantity", "price", "currency"],
      properties: {
        ticker: {
          type: "string",
          title: t("portfolio.card.virtualTradeTicker"),
        },
        instrument_id: {
          type: "string",
          title: t("portfolio.card.virtualTradeInstrumentID"),
        },
        quantity: {
          type: "number",
          title: t("portfolio.card.virtualTradeQuantity"),
          minimum: 0.0001,
          default: 1,
        },
        price: {
          type: "number",
          title: t("portfolio.card.virtualTradePrice"),
          minimum: 0.0001,
          default: 100,
        },
        commission: {
          type: "number",
          title: t("portfolio.card.virtualTradeCommission"),
          minimum: 0,
          default: 0,
        },
        currency: {
          type: "string",
          title: t("portfolio.card.virtualTradeCurrency"),
          minLength: 1,
          default: "RUB",
        },
        executed_at: {
          type: "string",
          title: t("portfolio.card.virtualTradeDateTime"),
          format: "date-time",
        },
      },
    },
    getDefaultFormData: () => ({
      ticker: "",
      instrument_id: "",
      quantity: 1,
      price: 100,
      commission: 0,
      currency: "RUB",
      executed_at: currentTimestampISO(),
    }),
    buildPayload: (formData) => {
      const ticker = readString(formData.ticker);
      const instrumentID = readString(formData.instrument_id);

      return {
        ticker: ticker || undefined,
        instrument_id: instrumentID || undefined,
        quantity: readNumberWithFallback(formData.quantity, 0.0001, 0.0001),
        price: readNumberWithFallback(formData.price, 0.0001, 0.0001),
        commission: readNumberWithFallback(formData.commission, 0, 0),
        currency: readString(formData.currency).toUpperCase() || "RUB",
        executed_at: readString(formData.executed_at) || undefined,
      };
    },
  };
}

export function getPortfolioActionFormConfig(
  actionID: string | undefined,
  t: TFunction,
): PortfolioActionFormConfig | null {
  switch (actionID) {
    case "sandbox_pay_in":
      return createSandboxPayInConfig(t);
    case "sandbox_pay_out":
      return createSandboxPayOutConfig(t);
    case "deposit_cash":
      return createDepositCashConfig(t);
    case "buy":
    case "sell":
      return createTradeConfig(t);
    default:
      return null;
  }
}
