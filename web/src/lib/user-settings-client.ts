import { settingsApi } from '@/lib/api';
import type {
  ModelsUserSettingsPatchRequest,
  ModelsUserSettingsResponse,
} from '@/api-client';

export type UserSettings = ModelsUserSettingsResponse;
export type UserSettingsPatch = ModelsUserSettingsPatchRequest;

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
