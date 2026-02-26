import { settingsApi } from '@/lib/api';
import type {
  UserSettingsPatchRequest,
  UserSettingsResponse,
} from '@/api-client';

export type UserSettings = UserSettingsResponse;
export type UserSettingsPatch = UserSettingsPatchRequest;

export const userSettingsClient = {
  async getSettings(): Promise<UserSettings> {
    const response = await settingsApi.meSettingsGet();
    return response.data;
  },

  async patchSettings(payload: UserSettingsPatch): Promise<UserSettings> {
    const response = await settingsApi.meSettingsPatch(payload);
    return response.data;
  },
};
