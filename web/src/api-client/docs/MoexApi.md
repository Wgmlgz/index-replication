# MoexApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**moexIndexesOverviewGet**](#moexindexesoverviewget) | **GET** /moex/indexes/overview | Get MOEX indexes overview|
|[**moexIndexesSecidCompositionGet**](#moexindexessecidcompositionget) | **GET** /moex/indexes/{secid}/composition | Get MOEX index composition|
|[**moexIndexesSecidCompositionSeriesGet**](#moexindexessecidcompositionseriesget) | **GET** /moex/indexes/{secid}/composition/series | Get MOEX index composition series|
|[**moexIndexesSecidHistoryGet**](#moexindexessecidhistoryget) | **GET** /moex/indexes/{secid}/history | Get MOEX index history|
|[**moexSyncCoverageGet**](#moexsynccoverageget) | **GET** /moex/sync/coverage | Get MOEX coverage rows|
|[**moexSyncRunsGet**](#moexsyncrunsget) | **GET** /moex/sync/runs | Get MOEX sync run history|
|[**moexSyncStateGet**](#moexsyncstateget) | **GET** /moex/sync/state | Get MOEX sync state rows|

# **moexIndexesOverviewGet**
> ModelsMoexIndexesOverviewResponse moexIndexesOverviewGet()

Returns indexes list, collections, and membership map

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let lang: string; //Response language (ru/en) (optional) (default to undefined)

const { status, data } = await apiInstance.moexIndexesOverviewGet(
    lang
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **lang** | [**string**] | Response language (ru/en) | (optional) defaults to undefined|


### Return type

**ModelsMoexIndexesOverviewResponse**

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

# **moexIndexesSecidCompositionGet**
> Array<ModelsMoexIndexCompositionEntry> moexIndexesSecidCompositionGet()

Returns index composition snapshot

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let secid: string; //Index SECID (default to undefined)
let date: string; //Snapshot date (YYYY-MM-DD) (optional) (default to undefined)
let lang: string; //Response language (ru/en) (optional) (default to undefined)

const { status, data } = await apiInstance.moexIndexesSecidCompositionGet(
    secid,
    date,
    lang
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **secid** | [**string**] | Index SECID | defaults to undefined|
| **date** | [**string**] | Snapshot date (YYYY-MM-DD) | (optional) defaults to undefined|
| **lang** | [**string**] | Response language (ru/en) | (optional) defaults to undefined|


### Return type

**Array<ModelsMoexIndexCompositionEntry>**

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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moexIndexesSecidCompositionSeriesGet**
> { [key: string]: Array<ModelsMoexIndexTickerAnalyticsPoint>; } moexIndexesSecidCompositionSeriesGet()

Returns downsampled weight series for index tickers

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let secid: string; //Index SECID (default to undefined)
let tickers: string; //Comma-separated list of tickers (optional; backend can pick top constituents) (optional) (default to undefined)
let topCount: number; //When tickers are omitted: number of top constituents by latest snapshot (0 = all, default 10) (optional) (default to undefined)
let selectionMode: string; //Ticker auto-selection mode when tickers are omitted: fixed|rolling (default fixed) (optional) (default to undefined)
let selectionDate: string; //Top selection date for fixed mode (YYYY-MM-DD, default till/today) (optional) (default to undefined)
let from: string; //Start date (YYYY-MM-DD) (optional) (default to undefined)
let till: string; //End date (YYYY-MM-DD) (optional) (default to undefined)
let intervalDays: number; //Downsample interval in days (optional) (default to undefined)
let lang: string; //Response language (ru/en) (optional) (default to undefined)

const { status, data } = await apiInstance.moexIndexesSecidCompositionSeriesGet(
    secid,
    tickers,
    topCount,
    selectionMode,
    selectionDate,
    from,
    till,
    intervalDays,
    lang
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **secid** | [**string**] | Index SECID | defaults to undefined|
| **tickers** | [**string**] | Comma-separated list of tickers (optional; backend can pick top constituents) | (optional) defaults to undefined|
| **topCount** | [**number**] | When tickers are omitted: number of top constituents by latest snapshot (0 &#x3D; all, default 10) | (optional) defaults to undefined|
| **selectionMode** | [**string**] | Ticker auto-selection mode when tickers are omitted: fixed|rolling (default fixed) | (optional) defaults to undefined|
| **selectionDate** | [**string**] | Top selection date for fixed mode (YYYY-MM-DD, default till/today) | (optional) defaults to undefined|
| **from** | [**string**] | Start date (YYYY-MM-DD) | (optional) defaults to undefined|
| **till** | [**string**] | End date (YYYY-MM-DD) | (optional) defaults to undefined|
| **intervalDays** | [**number**] | Downsample interval in days | (optional) defaults to undefined|
| **lang** | [**string**] | Response language (ru/en) | (optional) defaults to undefined|


### Return type

**{ [key: string]: Array<ModelsMoexIndexTickerAnalyticsPoint>; }**

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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moexIndexesSecidHistoryGet**
> Array<ModelsMoexIndexHistoryPoint> moexIndexesSecidHistoryGet()

Returns downsampled history for a MOEX index

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let secid: string; //Index SECID (default to undefined)
let from: string; //Start date (YYYY-MM-DD) (optional) (default to undefined)
let till: string; //End date (YYYY-MM-DD) (optional) (default to undefined)
let intervalDays: number; //Downsample interval in days (optional) (default to undefined)

const { status, data } = await apiInstance.moexIndexesSecidHistoryGet(
    secid,
    from,
    till,
    intervalDays
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **secid** | [**string**] | Index SECID | defaults to undefined|
| **from** | [**string**] | Start date (YYYY-MM-DD) | (optional) defaults to undefined|
| **till** | [**string**] | End date (YYYY-MM-DD) | (optional) defaults to undefined|
| **intervalDays** | [**number**] | Downsample interval in days | (optional) defaults to undefined|


### Return type

**Array<ModelsMoexIndexHistoryPoint>**

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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moexSyncCoverageGet**
> Array<RepositoryMoexCoverageRow> moexSyncCoverageGet()

Returns rows from moex_data_coverage with optional filters

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let dataset: string; //Dataset filter (optional) (default to undefined)
let entityKey: string; //Entity key filter (optional) (default to undefined)
let from: string; //From date (YYYY-MM-DD) (optional) (default to undefined)
let till: string; //Till date (YYYY-MM-DD) (optional) (default to undefined)
let limit: number; //Result limit (optional) (default to undefined)

const { status, data } = await apiInstance.moexSyncCoverageGet(
    dataset,
    entityKey,
    from,
    till,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dataset** | [**string**] | Dataset filter | (optional) defaults to undefined|
| **entityKey** | [**string**] | Entity key filter | (optional) defaults to undefined|
| **from** | [**string**] | From date (YYYY-MM-DD) | (optional) defaults to undefined|
| **till** | [**string**] | Till date (YYYY-MM-DD) | (optional) defaults to undefined|
| **limit** | [**number**] | Result limit | (optional) defaults to undefined|


### Return type

**Array<RepositoryMoexCoverageRow>**

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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **moexSyncRunsGet**
> Array<RepositoryMoexSyncRunRow> moexSyncRunsGet()

Returns rows from moex_sync_runs with optional filters

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let dataset: string; //Dataset filter (optional) (default to undefined)
let entityKey: string; //Entity key filter (optional) (default to undefined)
let status: string; //Status filter (optional) (default to undefined)
let limit: number; //Result limit (optional) (default to undefined)

const { status, data } = await apiInstance.moexSyncRunsGet(
    dataset,
    entityKey,
    status,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dataset** | [**string**] | Dataset filter | (optional) defaults to undefined|
| **entityKey** | [**string**] | Entity key filter | (optional) defaults to undefined|
| **status** | [**string**] | Status filter | (optional) defaults to undefined|
| **limit** | [**number**] | Result limit | (optional) defaults to undefined|


### Return type

**Array<RepositoryMoexSyncRunRow>**

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

# **moexSyncStateGet**
> Array<RepositoryMoexSyncStateRow> moexSyncStateGet()

Returns rows from moex_sync_state with optional filters

### Example

```typescript
import {
    MoexApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MoexApi(configuration);

let dataset: string; //Dataset filter (optional) (default to undefined)
let entityKey: string; //Entity key filter (optional) (default to undefined)
let limit: number; //Result limit (optional) (default to undefined)

const { status, data } = await apiInstance.moexSyncStateGet(
    dataset,
    entityKey,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **dataset** | [**string**] | Dataset filter | (optional) defaults to undefined|
| **entityKey** | [**string**] | Entity key filter | (optional) defaults to undefined|
| **limit** | [**number**] | Result limit | (optional) defaults to undefined|


### Return type

**Array<RepositoryMoexSyncStateRow>**

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

