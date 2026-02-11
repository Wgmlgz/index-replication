# MoexApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**moexIndexesOverviewGet**](#moexindexesoverviewget) | **GET** /moex/indexes/overview | Get MOEX indexes overview|
|[**moexIndexesSecidCompositionGet**](#moexindexessecidcompositionget) | **GET** /moex/indexes/{secid}/composition | Get MOEX index composition|
|[**moexIndexesSecidCompositionSeriesGet**](#moexindexessecidcompositionseriesget) | **GET** /moex/indexes/{secid}/composition/series | Get MOEX index composition series|
|[**moexIndexesSecidHistoryGet**](#moexindexessecidhistoryget) | **GET** /moex/indexes/{secid}/history | Get MOEX index history|

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
let tickers: string; //Comma-separated list of tickers (default to undefined)
let from: string; //Start date (YYYY-MM-DD) (optional) (default to undefined)
let till: string; //End date (YYYY-MM-DD) (optional) (default to undefined)
let intervalDays: number; //Downsample interval in days (optional) (default to undefined)
let lang: string; //Response language (ru/en) (optional) (default to undefined)

const { status, data } = await apiInstance.moexIndexesSecidCompositionSeriesGet(
    secid,
    tickers,
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
| **tickers** | [**string**] | Comma-separated list of tickers | defaults to undefined|
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

