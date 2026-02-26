# VerificationApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**meVerificationTelegramConnectPost**](#meverificationtelegramconnectpost) | **POST** /me/verification/telegram/connect | Create Telegram connect link|
|[**meVerificationTelegramDelete**](#meverificationtelegramdelete) | **DELETE** /me/verification/telegram | Unlink Telegram verification|
|[**meVerificationTelegramGet**](#meverificationtelegramget) | **GET** /me/verification/telegram | Get Telegram verification status|
|[**meVerificationTelegramPatch**](#meverificationtelegrampatch) | **PATCH** /me/verification/telegram | Update Telegram verification settings|

# **meVerificationTelegramConnectPost**
> TelegramConnectResponse meVerificationTelegramConnectPost()

Generates a one-time Telegram connect link for the current user

### Example

```typescript
import {
    VerificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VerificationApi(configuration);

const { status, data } = await apiInstance.meVerificationTelegramConnectPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**TelegramConnectResponse**

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
|**503** | Service Unavailable |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meVerificationTelegramDelete**
> TelegramStatusResponse meVerificationTelegramDelete()

Removes Telegram connection and disables Telegram login verification for the current user

### Example

```typescript
import {
    VerificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VerificationApi(configuration);

const { status, data } = await apiInstance.meVerificationTelegramDelete();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**TelegramStatusResponse**

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

# **meVerificationTelegramGet**
> TelegramStatusResponse meVerificationTelegramGet()

Returns Telegram connection status and whether login verification is enabled

### Example

```typescript
import {
    VerificationApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new VerificationApi(configuration);

const { status, data } = await apiInstance.meVerificationTelegramGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**TelegramStatusResponse**

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

# **meVerificationTelegramPatch**
> TelegramStatusResponse meVerificationTelegramPatch(payload)

Updates Telegram login verification settings for the current user

### Example

```typescript
import {
    VerificationApi,
    Configuration,
    TelegramPatchRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new VerificationApi(configuration);

let payload: TelegramPatchRequest; //Telegram verification settings

const { status, data } = await apiInstance.meVerificationTelegramPatch(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **TelegramPatchRequest**| Telegram verification settings | |


### Return type

**TelegramStatusResponse**

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

