# PortfolioApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**mePortfoliosGet**](#meportfoliosget) | **GET** /me/portfolios | List portfolio profiles|
|[**mePortfoliosIdActionsActionPost**](#meportfoliosidactionsactionpost) | **POST** /me/portfolios/{id}/actions/{action} | Run provider action|
|[**mePortfoliosIdCompositionGet**](#meportfoliosidcompositionget) | **GET** /me/portfolios/{id}/composition | Get portfolio composition snapshot|
|[**mePortfoliosIdCompositionSeriesGet**](#meportfoliosidcompositionseriesget) | **GET** /me/portfolios/{id}/composition/series | Get portfolio composition series|
|[**mePortfoliosIdDelete**](#meportfoliosiddelete) | **DELETE** /me/portfolios/{id} | Delete portfolio profile|
|[**mePortfoliosIdHistoryGet**](#meportfoliosidhistoryget) | **GET** /me/portfolios/{id}/history | Get portfolio history|
|[**mePortfoliosIdOperationsGet**](#meportfoliosidoperationsget) | **GET** /me/portfolios/{id}/operations | Get portfolio operations|
|[**mePortfoliosIdPatch**](#meportfoliosidpatch) | **PATCH** /me/portfolios/{id} | Update portfolio profile|
|[**mePortfoliosIdRebalancesGet**](#meportfoliosidrebalancesget) | **GET** /me/portfolios/{id}/rebalances | List rebalance drafts|
|[**mePortfoliosIdRebalancesPost**](#meportfoliosidrebalancespost) | **POST** /me/portfolios/{id}/rebalances | Create rebalance draft|
|[**mePortfoliosIdRebalancesRebalanceIdDelete**](#meportfoliosidrebalancesrebalanceiddelete) | **DELETE** /me/portfolios/{id}/rebalances/{rebalanceId} | Delete rebalance draft|
|[**mePortfoliosIdRebalancesRebalanceIdExecutePost**](#meportfoliosidrebalancesrebalanceidexecutepost) | **POST** /me/portfolios/{id}/rebalances/{rebalanceId}/execute | Execute rebalance draft|
|[**mePortfoliosIdRebalancesRebalanceIdExecutionGet**](#meportfoliosidrebalancesrebalanceidexecutionget) | **GET** /me/portfolios/{id}/rebalances/{rebalanceId}/execution | Get rebalance execution status|
|[**mePortfoliosIdRebalancesRebalanceIdGet**](#meportfoliosidrebalancesrebalanceidget) | **GET** /me/portfolios/{id}/rebalances/{rebalanceId} | Get rebalance draft detail|
|[**mePortfoliosIdReplicationDelete**](#meportfoliosidreplicationdelete) | **DELETE** /me/portfolios/{id}/replication | Delete portfolio replication config|
|[**mePortfoliosIdReplicationPut**](#meportfoliosidreplicationput) | **PUT** /me/portfolios/{id}/replication | Upsert portfolio replication config|
|[**mePortfoliosIdSummaryGet**](#meportfoliosidsummaryget) | **GET** /me/portfolios/{id}/summary | Get portfolio summary|
|[**mePortfoliosPost**](#meportfoliospost) | **POST** /me/portfolios | Create portfolio profile|

# **mePortfoliosGet**
> Array<PortfolioProfile> mePortfoliosGet()

Returns current user portfolio profiles with provider capabilities

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

const { status, data } = await apiInstance.mePortfoliosGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<PortfolioProfile>**

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

# **mePortfoliosIdActionsActionPost**
> PortfolioActionResponse mePortfoliosIdActionsActionPost()

Executes provider-specific action for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration,
    PortfolioActionRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let action: string; //Provider action id (default to undefined)
let payload: PortfolioActionRequest; //Action payload (optional)

const { status, data } = await apiInstance.mePortfoliosIdActionsActionPost(
    id,
    action,
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **PortfolioActionRequest**| Action payload | |
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **action** | [**string**] | Provider action id | defaults to undefined|


### Return type

**PortfolioActionResponse**

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
|**404** | Not Found |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdCompositionGet**
> Array<PortfolioCompositionEntry> mePortfoliosIdCompositionGet()

Returns composition snapshot for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let date: string; //Snapshot date (YYYY-MM-DD) (optional) (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdCompositionGet(
    id,
    date
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **date** | [**string**] | Snapshot date (YYYY-MM-DD) | (optional) defaults to undefined|


### Return type

**Array<PortfolioCompositionEntry>**

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
|**404** | Not Found |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdCompositionSeriesGet**
> { [key: string]: Array<PortfolioCompositionSeriesPoint>; } mePortfoliosIdCompositionSeriesGet()

Returns ticker composition series for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let tickers: string; //Comma-separated tickers (optional) (default to undefined)
let topCount: number; //Top constituents count (0 = all) (optional) (default to undefined)
let selectionMode: string; //Ticker selection mode: fixed|rolling (optional) (default to undefined)
let selectionDate: string; //Selection date (YYYY-MM-DD) (optional) (default to undefined)
let from: string; //Start date (YYYY-MM-DD) (optional) (default to undefined)
let till: string; //End date (YYYY-MM-DD) (optional) (default to undefined)
let intervalDays: number; //Downsample interval in days (optional) (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdCompositionSeriesGet(
    id,
    tickers,
    topCount,
    selectionMode,
    selectionDate,
    from,
    till,
    intervalDays
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **tickers** | [**string**] | Comma-separated tickers | (optional) defaults to undefined|
| **topCount** | [**number**] | Top constituents count (0 &#x3D; all) | (optional) defaults to undefined|
| **selectionMode** | [**string**] | Ticker selection mode: fixed|rolling | (optional) defaults to undefined|
| **selectionDate** | [**string**] | Selection date (YYYY-MM-DD) | (optional) defaults to undefined|
| **from** | [**string**] | Start date (YYYY-MM-DD) | (optional) defaults to undefined|
| **till** | [**string**] | End date (YYYY-MM-DD) | (optional) defaults to undefined|
| **intervalDays** | [**number**] | Downsample interval in days | (optional) defaults to undefined|


### Return type

**{ [key: string]: Array<PortfolioCompositionSeriesPoint>; }**

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
|**404** | Not Found |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdDelete**
> mePortfoliosIdDelete()

Deletes selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | No Content |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdHistoryGet**
> Array<PortfolioHistoryPoint> mePortfoliosIdHistoryGet()

Returns history points for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let from: string; //Start date (YYYY-MM-DD) (optional) (default to undefined)
let till: string; //End date (YYYY-MM-DD) (optional) (default to undefined)
let intervalDays: number; //Downsample interval in days (optional) (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdHistoryGet(
    id,
    from,
    till,
    intervalDays
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **from** | [**string**] | Start date (YYYY-MM-DD) | (optional) defaults to undefined|
| **till** | [**string**] | End date (YYYY-MM-DD) | (optional) defaults to undefined|
| **intervalDays** | [**number**] | Downsample interval in days | (optional) defaults to undefined|


### Return type

**Array<PortfolioHistoryPoint>**

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
|**404** | Not Found |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdOperationsGet**
> PortfolioOperationsHistoryResponse mePortfoliosIdOperationsGet()

Returns portfolio operations history with cursor pagination

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let cursor: string; //Cursor from previous response (optional) (default to undefined)
let limit: number; //Page size (1-200, default 50) (optional) (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdOperationsGet(
    id,
    cursor,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **cursor** | [**string**] | Cursor from previous response | (optional) defaults to undefined|
| **limit** | [**number**] | Page size (1-200, default 50) | (optional) defaults to undefined|


### Return type

**PortfolioOperationsHistoryResponse**

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
|**404** | Not Found |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdPatch**
> PortfolioProfile mePortfoliosIdPatch(payload)

Updates selected portfolio profile (name/default/config/secret)

### Example

```typescript
import {
    PortfolioApi,
    Configuration,
    PortfolioProfilePatchRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let payload: PortfolioProfilePatchRequest; //Portfolio profile patch payload

const { status, data } = await apiInstance.mePortfoliosIdPatch(
    id,
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **PortfolioProfilePatchRequest**| Portfolio profile patch payload | |
| **id** | [**number**] | Portfolio profile id | defaults to undefined|


### Return type

**PortfolioProfile**

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
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdRebalancesGet**
> Array<PortfolioRebalanceRun> mePortfoliosIdRebalancesGet()

Lists persisted rebalances for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let limit: number; //Max number of rows (optional) (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdRebalancesGet(
    id,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **limit** | [**number**] | Max number of rows | (optional) defaults to undefined|


### Return type

**Array<PortfolioRebalanceRun>**

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
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdRebalancesPost**
> PortfolioRebalanceDetailResponse mePortfoliosIdRebalancesPost(payload)

Creates a persisted rebalance draft (planning only, no execution)

### Example

```typescript
import {
    PortfolioApi,
    Configuration,
    PortfolioRebalanceCreateRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let payload: PortfolioRebalanceCreateRequest; //Rebalance draft payload

const { status, data } = await apiInstance.mePortfoliosIdRebalancesPost(
    id,
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **PortfolioRebalanceCreateRequest**| Rebalance draft payload | |
| **id** | [**number**] | Portfolio profile id | defaults to undefined|


### Return type

**PortfolioRebalanceDetailResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdRebalancesRebalanceIdDelete**
> mePortfoliosIdRebalancesRebalanceIdDelete()

Deletes selected rebalance draft and all related records

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let rebalanceId: number; //Rebalance run id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdRebalancesRebalanceIdDelete(
    id,
    rebalanceId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **rebalanceId** | [**number**] | Rebalance run id | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | No Content |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdRebalancesRebalanceIdExecutePost**
> PortfolioRebalanceRun mePortfoliosIdRebalancesRebalanceIdExecutePost()

Starts Temporal workflow to execute planned rebalance transactions

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let rebalanceId: number; //Rebalance run id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdRebalancesRebalanceIdExecutePost(
    id,
    rebalanceId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **rebalanceId** | [**number**] | Rebalance run id | defaults to undefined|


### Return type

**PortfolioRebalanceRun**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**202** | Accepted |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdRebalancesRebalanceIdExecutionGet**
> PortfolioRebalanceExecutionStatusResponse mePortfoliosIdRebalancesRebalanceIdExecutionGet()

Returns pollable execution state with live item statuses and execution links

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let rebalanceId: number; //Rebalance run id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdRebalancesRebalanceIdExecutionGet(
    id,
    rebalanceId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **rebalanceId** | [**number**] | Rebalance run id | defaults to undefined|


### Return type

**PortfolioRebalanceExecutionStatusResponse**

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
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdRebalancesRebalanceIdGet**
> PortfolioRebalanceDetailResponse mePortfoliosIdRebalancesRebalanceIdGet()

Returns run metadata and persisted planning payload (input, output, summary)

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let rebalanceId: number; //Rebalance run id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdRebalancesRebalanceIdGet(
    id,
    rebalanceId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|
| **rebalanceId** | [**number**] | Rebalance run id | defaults to undefined|


### Return type

**PortfolioRebalanceDetailResponse**

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
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdReplicationDelete**
> mePortfoliosIdReplicationDelete()

Deletes replication config for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdReplicationDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: */*


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | No Content |  -  |
|**400** | Bad Request |  -  |
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdReplicationPut**
> PortfolioReplicationConfig mePortfoliosIdReplicationPut(payload)

Creates or updates replication config for selected portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration,
    PortfolioReplicationConfigUpsertRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)
let payload: PortfolioReplicationConfigUpsertRequest; //Replication config payload

const { status, data } = await apiInstance.mePortfoliosIdReplicationPut(
    id,
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **PortfolioReplicationConfigUpsertRequest**| Replication config payload | |
| **id** | [**number**] | Portfolio profile id | defaults to undefined|


### Return type

**PortfolioReplicationConfig**

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
|**404** | Not Found |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosIdSummaryGet**
> PortfolioSummaryResponse mePortfoliosIdSummaryGet()

Returns unified summary (balances and positions) by portfolio profile

### Example

```typescript
import {
    PortfolioApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let id: number; //Portfolio profile id (default to undefined)

const { status, data } = await apiInstance.mePortfoliosIdSummaryGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Portfolio profile id | defaults to undefined|


### Return type

**PortfolioSummaryResponse**

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
|**404** | Not Found |  -  |
|**502** | Bad Gateway |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **mePortfoliosPost**
> PortfolioProfile mePortfoliosPost(payload)

Creates provider-backed portfolio profile for the current user

### Example

```typescript
import {
    PortfolioApi,
    Configuration,
    PortfolioProfileCreateRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new PortfolioApi(configuration);

let payload: PortfolioProfileCreateRequest; //Portfolio profile payload

const { status, data } = await apiInstance.mePortfoliosPost(
    payload
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **payload** | **PortfolioProfileCreateRequest**| Portfolio profile payload | |


### Return type

**PortfolioProfile**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

