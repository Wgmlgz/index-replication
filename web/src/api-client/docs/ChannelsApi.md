# ChannelsApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**meChannelsTelegramConnectPost**](#mechannelstelegramconnectpost) | **POST** /me/channels/telegram/connect | Create Telegram channel connect link|
|[**meChannelsTelegramDelete**](#mechannelstelegramdelete) | **DELETE** /me/channels/telegram | Unlink Telegram channel|
|[**meChannelsTelegramGet**](#mechannelstelegramget) | **GET** /me/channels/telegram | Get Telegram channel status|
|[**meChannelsTelegramPatch**](#mechannelstelegrampatch) | **PATCH** /me/channels/telegram | Update Telegram channel settings|

# **meChannelsTelegramConnectPost**
> TelegramConnectResponse meChannelsTelegramConnectPost()

Generates a one-time Telegram channel connect link for the current user

### Example

```typescript
import {
    ChannelsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChannelsApi(configuration);

const { status, data } = await apiInstance.meChannelsTelegramConnectPost();
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

# **meChannelsTelegramDelete**
> TelegramStatusResponse meChannelsTelegramDelete()

Removes Telegram channel connection and disables Telegram login approval for the current user

### Example

```typescript
import {
    ChannelsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChannelsApi(configuration);

const { status, data } = await apiInstance.meChannelsTelegramDelete();
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

# **meChannelsTelegramGet**
> TelegramStatusResponse meChannelsTelegramGet()

Returns Telegram channel connection status and whether login approval is enabled

### Example

```typescript
import {
    ChannelsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ChannelsApi(configuration);

const { status, data } = await apiInstance.meChannelsTelegramGet();
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

# **meChannelsTelegramPatch**
> TelegramStatusResponse meChannelsTelegramPatch(payload)

Updates Telegram login approval settings for the current user

### Example

```typescript
import {
    ChannelsApi,
    Configuration,
    TelegramPatchRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new ChannelsApi(configuration);

let payload: TelegramPatchRequest; //Telegram channel settings

const { status, data } = await apiInstance.meChannelsTelegramPatch(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **TelegramPatchRequest**| Telegram channel settings | |


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

