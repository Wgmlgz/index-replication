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
  environment?: "sandbox" | "production" | string;
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

  async testBuy(payload: TBankTestBuyRequest): Promise<TBankTestBuyResponse> {
    const response = await axiosClient.post<TBankTestBuyResponse>(
      `${getApiUrl()}/me/tbank/test-buy`,
      payload
    );
    return response.data;
  },
};

