# TbankApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**meTbankConnectPost**](#metbankconnectpost) | **POST** /me/tbank/connect | Connect T-Bank account|
|[**meTbankDefaultAccountPost**](#metbankdefaultaccountpost) | **POST** /me/tbank/default-account | Set T-Bank default account|
|[**meTbankDisconnectPost**](#metbankdisconnectpost) | **POST** /me/tbank/disconnect | Disconnect T-Bank account|
|[**meTbankGet**](#metbankget) | **GET** /me/tbank | Get T-Bank integration status|
|[**meTbankInstrumentsLookupGet**](#metbankinstrumentslookupget) | **GET** /me/tbank/instruments/lookup | Find T-Bank instrument id by ticker|
|[**meTbankOperationsGet**](#metbankoperationsget) | **GET** /me/tbank/operations | Get T-Bank account operations history|
|[**meTbankPortfolioGet**](#metbankportfolioget) | **GET** /me/tbank/portfolio | Get T-Bank account balances and portfolio|
|[**meTbankSandboxPayInPost**](#metbanksandboxpayinpost) | **POST** /me/tbank/sandbox/pay-in | Top up T-Bank sandbox account|
|[**meTbankTestBuyPost**](#metbanktestbuypost) | **POST** /me/tbank/test-buy | Create T-Bank test buy order|

# **meTbankConnectPost**
> TBankConnectionStatusResponse meTbankConnectPost(payload)

Saves user token/environment and verifies access by loading accounts

### Example

```typescript
import {
    TbankApi,
    Configuration,
    TBankConnectRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let payload: TBankConnectRequest; //T-Bank connect payload

const { status, data } = await apiInstance.meTbankConnectPost(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **TBankConnectRequest**| T-Bank connect payload | |


### Return type

**TBankConnectionStatusResponse**

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
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meTbankDefaultAccountPost**
> TBankConnectionStatusResponse meTbankDefaultAccountPost(payload)

Sets connected account to use by default for test-buy and portfolio actions

### Example

```typescript
import {
    TbankApi,
    Configuration,
    TBankSetDefaultAccountRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let payload: TBankSetDefaultAccountRequest; //Default account payload

const { status, data } = await apiInstance.meTbankDefaultAccountPost(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **TBankSetDefaultAccountRequest**| Default account payload | |


### Return type

**TBankConnectionStatusResponse**

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
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meTbankDisconnectPost**
> { [key: string]: boolean; } meTbankDisconnectPost()

Removes saved T-Bank credentials for the current user

### Example

```typescript
import {
    TbankApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

const { status, data } = await apiInstance.meTbankDisconnectPost();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**{ [key: string]: boolean; }**

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

# **meTbankGet**
> TBankConnectionStatusResponse meTbankGet()

Returns current user T-Bank connection state and available accounts

### Example

```typescript
import {
    TbankApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

const { status, data } = await apiInstance.meTbankGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**TBankConnectionStatusResponse**

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

# **meTbankInstrumentsLookupGet**
> TBankInstrumentLookupResponse meTbankInstrumentsLookupGet()

Resolves T-Bank instrument candidates by MOEX ticker and optional class code

### Example

```typescript
import {
    TbankApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let ticker: string; //MOEX ticker (default to undefined)
let classCode: string; //MOEX class code (for exact filtering) (optional) (default to undefined)

const { status, data } = await apiInstance.meTbankInstrumentsLookupGet(
    ticker,
    classCode
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ticker** | [**string**] | MOEX ticker | defaults to undefined|
| **classCode** | [**string**] | MOEX class code (for exact filtering) | (optional) defaults to undefined|


### Return type

**TBankInstrumentLookupResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meTbankOperationsGet**
> TBankOperationsHistoryResponse meTbankOperationsGet()

Returns executed account operations (buy/sell/etc.) with cursor pagination

### Example

```typescript
import {
    TbankApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let accountId: string; //Account id (optional) (default to undefined)
let cursor: string; //Cursor from previous response (optional) (default to undefined)
let limit: number; //Page size (1-200, default 50) (optional) (default to undefined)

const { status, data } = await apiInstance.meTbankOperationsGet(
    accountId,
    cursor,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **accountId** | [**string**] | Account id | (optional) defaults to undefined|
| **cursor** | [**string**] | Cursor from previous response | (optional) defaults to undefined|
| **limit** | [**number**] | Page size (1-200, default 50) | (optional) defaults to undefined|


### Return type

**TBankOperationsHistoryResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meTbankPortfolioGet**
> TBankAccountPortfolioResponse meTbankPortfolioGet()

Returns balances and positions for selected account (or default account if omitted)

### Example

```typescript
import {
    TbankApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let accountId: string; //Account id (optional) (default to undefined)

const { status, data } = await apiInstance.meTbankPortfolioGet(
    accountId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **accountId** | [**string**] | Account id | (optional) defaults to undefined|


### Return type

**TBankAccountPortfolioResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meTbankSandboxPayInPost**
> TBankSandboxPayInResponse meTbankSandboxPayInPost(payload)

Adds virtual money to selected sandbox account

### Example

```typescript
import {
    TbankApi,
    Configuration,
    TBankSandboxPayInRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let payload: TBankSandboxPayInRequest; //Sandbox pay-in payload

const { status, data } = await apiInstance.meTbankSandboxPayInPost(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **TBankSandboxPayInRequest**| Sandbox pay-in payload | |


### Return type

**TBankSandboxPayInResponse**

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
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **meTbankTestBuyPost**
> TBankTestBuyResponse meTbankTestBuyPost(payload)

Places a market buy order using the connected user T-Bank account

### Example

```typescript
import {
    TbankApi,
    Configuration,
    TBankTestBuyRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new TbankApi(configuration);

let payload: TBankTestBuyRequest; //T-Bank test buy payload

const { status, data } = await apiInstance.meTbankTestBuyPost(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **TBankTestBuyRequest**| T-Bank test buy payload | |


### Return type

**TBankTestBuyResponse**

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
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

