import { axiosClient, getApiUrl } from "@/lib/api";

export type TBankAccount = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  access_level?: string;
  opened_at?: string;
  closed_at?: string;
};

export type TBankConnectionStatusResponse = {
  connected: boolean;
  environment?: string;
  token_masked?: string;
  default_account_id?: string;
  accounts: TBankAccount[];
  connection_error?: string;
};

export type TBankConnectRequest = {
  token: string;
  environment: "sandbox" | "production";
  default_account_id?: string;
};

export type TBankTestBuyRequest = {
  account_id?: string;
  instrument_id: string;
  quantity: number;
};

export type TBankTestBuyResponse = {
  environment: string;
  account_id: string;
  instrument_id: string;
  quantity: number;
  order_id?: string;
  execution_report_status?: string;
  response?: Record<string, unknown>;
};

export type TBankSetDefaultAccountRequest = {
  account_id: string;
};

export type TBankSandboxPayInRequest = {
  account_id?: string;
  currency?: string;
  units?: number;
};

export type TBankSandboxPayInResponse = {
  environment: string;
  account_id: string;
  currency: string;
  units: number;
};

export type TBankMoneyBalance = {
  currency: string;
  available: number;
  blocked: number;
  withdraw_available: number;
  withdraw_blocked: number;
};

export type TBankPortfolioPosition = {
  ticker?: string;
  instrument_id?: string;
  figi?: string;
  name?: string;
  instrument_type?: string;
  quantity: number;
  current_price: number;
  current_value: number;
  expected_yield: number;
  currency?: string;
};

export type TBankAccountPortfolioResponse = {
  environment: string;
  account_id: string;
  total_amount_portfolio: number;
  total_amount_portfolio_currency?: string;
  daily_yield: number;
  daily_yield_relative: number;
  money: TBankMoneyBalance[];
  positions: TBankPortfolioPosition[];
};

export type TBankInstrumentLookupItem = {
  instrument_id: string;
  ticker: string;
  class_code?: string;
  name?: string;
  instrument_type?: string;
  figi?: string;
  uid?: string;
  position_uid?: string;
  isin?: string;
  lot: number;
  api_trade_available: boolean;
  for_iis: boolean;
  for_qual_investor: boolean;
};

export type TBankInstrumentLookupResponse = {
  query: string;
  class_code?: string;
  instruments: TBankInstrumentLookupItem[];
};

export const tbankClient = {
  async getStatus(): Promise<TBankConnectionStatusResponse> {
    const response = await axiosClient.get<TBankConnectionStatusResponse>(
      `${getApiUrl()}/me/tbank`
    );
    return response.data;
  },

  async connect(payload: TBankConnectRequest): Promise<TBankConnectionStatusResponse> {
    const response = await axiosClient.post<TBankConnectionStatusResponse>(
      `${getApiUrl()}/me/tbank/connect`,
      payload
    );
    return response.data;
  },

  async disconnect(): Promise<void> {
    await axiosClient.post(`${getApiUrl()}/me/tbank/disconnect`);
  },

  async setDefaultAccount(payload: TBankSetDefaultAccountRequest): Promise<TBankConnectionStatusResponse> {
    const response = await axiosClient.post<TBankConnectionStatusResponse>(
      `${getApiUrl()}/me/tbank/default-account`,
      payload
    );
    return response.data;
  },

  async getPortfolio(accountID?: string): Promise<TBankAccountPortfolioResponse> {
    const response = await axiosClient.get<TBankAccountPortfolioResponse>(
      `${getApiUrl()}/me/tbank/portfolio`,
      { params: accountID ? { account_id: accountID } : undefined }
    );
    return response.data;
  },

  async sandboxPayIn(payload: TBankSandboxPayInRequest): Promise<TBankSandboxPayInResponse> {
    const response = await axiosClient.post<TBankSandboxPayInResponse>(
      `${getApiUrl()}/me/tbank/sandbox/pay-in`,
      payload
    );
    return response.data;
  },

  async findInstrumentByTicker(ticker: string, classCode?: string): Promise<TBankInstrumentLookupResponse> {
    const response = await axiosClient.get<TBankInstrumentLookupResponse>(
      `${getApiUrl()}/me/tbank/instruments/lookup`,
      { params: { ticker, class_code: classCode || undefined } }
    );
    return response.data;
  },

  async testBuy(payload: TBankTestBuyRequest): Promise<TBankTestBuyResponse> {
    const response = await axiosClient.post<TBankTestBuyResponse>(
      `${getApiUrl()}/me/tbank/test-buy`,
      payload
    );
    return response.data;
  },
};
