# SettingsApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**meSettingsGet**](#mesettingsget) | **GET** /me/settings | Get current user settings|
|[**meSettingsPatch**](#mesettingspatch) | **PATCH** /me/settings | Update current user settings|

# **meSettingsGet**
> UserSettingsResponse meSettingsGet()

Returns settings for the current user, including favorites

### Example

```typescript
import {
    SettingsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SettingsApi(configuration);

const { status, data } = await apiInstance.meSettingsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**UserSettingsResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meSettingsPatch**
> UserSettingsResponse meSettingsPatch(payload)

Updates settings for the current user, including favorites

### Example

```typescript
import {
    SettingsApi,
    Configuration,
    UserSettingsPatchRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SettingsApi(configuration);

let payload: UserSettingsPatchRequest; //Settings payload

const { status, data } = await apiInstance.meSettingsPatch(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **UserSettingsPatchRequest**| Settings payload | |


### Return type

**UserSettingsResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

