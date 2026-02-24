import { axiosClient, getApiUrl } from "@/lib/api";

export type TelegramStatusResponse = {
  connected: boolean;
  login_2fa_enabled: boolean;
  bot_username?: string;
  telegram_username?: string;
};

export type TelegramConnectResponse = {
  connect_url: string;
  expires_at: string;
};

export type LoginVerifyStatusResponse = {
  status: string;
};

export const verificationClient = {
  async getTelegramStatus(): Promise<TelegramStatusResponse> {
    const response = await axiosClient.get<TelegramStatusResponse>(
      `${getApiUrl()}/me/verification/telegram`
    );
    return response.data;
  },

  async createTelegramConnectLink(): Promise<TelegramConnectResponse> {
    const response = await axiosClient.post<TelegramConnectResponse>(
      `${getApiUrl()}/me/verification/telegram/connect`
    );
    return response.data;
  },

  async patchTelegramSettings(payload: { login_2fa_enabled: boolean }): Promise<TelegramStatusResponse> {
    const response = await axiosClient.patch<TelegramStatusResponse>(
      `${getApiUrl()}/me/verification/telegram`,
      payload
    );
    return response.data;
  },

  async unlinkTelegram(): Promise<TelegramStatusResponse> {
    const response = await axiosClient.delete<TelegramStatusResponse>(
      `${getApiUrl()}/me/verification/telegram`
    );
    return response.data;
  },

  async verifyLogin(challengeID: string) {
    return axiosClient.post<LoginVerifyStatusResponse>(`${getApiUrl()}/login-verify`, {
      challenge_id: challengeID,
    });
  },
};
