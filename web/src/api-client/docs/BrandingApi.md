# BrandingApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**tickersLogoGet**](#tickerslogoget) | **GET** /tickers/logo | Resolve ticker logo URL|

# **tickersLogoGet**
> DtoTickerLogoResolveResponse tickersLogoGet()

Resolves a public logo URL by ticker symbol

### Example

```typescript
import {
    BrandingApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BrandingApi(configuration);

let ticker: string; //Ticker symbol (default to undefined)

const { status, data } = await apiInstance.tickersLogoGet(
    ticker
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **ticker** | [**string**] | Ticker symbol | defaults to undefined|


### Return type

**DtoTickerLogoResolveResponse**

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

