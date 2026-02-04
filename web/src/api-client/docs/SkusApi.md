# SkusApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**skusGet**](#skusget) | **GET** /skus | List Skus|
|[**skusIdDelete**](#skusiddelete) | **DELETE** /skus/{id} | Delete Sku|
|[**skusIdGet**](#skusidget) | **GET** /skus/{id} | Get Sku|
|[**skusIdImagesPost**](#skusidimagespost) | **POST** /skus/{id}/images | Add image to Sku|
|[**skusIdPut**](#skusidput) | **PUT** /skus/{id} | Update Sku|
|[**skusImagesImageIdDelete**](#skusimagesimageiddelete) | **DELETE** /skus/images/{image_id} | Remove image from Sku|
|[**skusPost**](#skuspost) | **POST** /skus | Create Sku|

# **skusGet**
> ModelsSkuListResponse skusGet()


### Example

```typescript
import {
    SkusApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let page: number; //Page number (optional) (default to undefined)
let pageSize: number; //Page size (optional) (default to undefined)
let search: string; //Search term (optional) (default to undefined)
let sortBy: string; //Sort by field (optional) (default to undefined)
let sortDir: string; //Sort direction (asc/desc) (optional) (default to undefined)

const { status, data } = await apiInstance.skusGet(
    page,
    pageSize,
    search,
    sortBy,
    sortDir
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | Page number | (optional) defaults to undefined|
| **pageSize** | [**number**] | Page size | (optional) defaults to undefined|
| **search** | [**string**] | Search term | (optional) defaults to undefined|
| **sortBy** | [**string**] | Sort by field | (optional) defaults to undefined|
| **sortDir** | [**string**] | Sort direction (asc/desc) | (optional) defaults to undefined|


### Return type

**ModelsSkuListResponse**

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

# **skusIdDelete**
> skusIdDelete()


### Example

```typescript
import {
    SkusApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let id: number; //Sku ID (default to undefined)

const { status, data } = await apiInstance.skusIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Sku ID | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | No Content |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **skusIdGet**
> ModelsSkuResponse skusIdGet()


### Example

```typescript
import {
    SkusApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let id: number; //Sku ID (default to undefined)

const { status, data } = await apiInstance.skusIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Sku ID | defaults to undefined|


### Return type

**ModelsSkuResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **skusIdImagesPost**
> ModelsSkuResponse skusIdImagesPost(body)


### Example

```typescript
import {
    SkusApi,
    Configuration,
    ModelsAddSkuImageRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let id: number; //Sku ID (default to undefined)
let body: ModelsAddSkuImageRequest; //Image info

const { status, data } = await apiInstance.skusIdImagesPost(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsAddSkuImageRequest**| Image info | |
| **id** | [**number**] | Sku ID | defaults to undefined|


### Return type

**ModelsSkuResponse**

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **skusIdPut**
> ModelsSkuResponse skusIdPut(body)


### Example

```typescript
import {
    SkusApi,
    Configuration,
    ModelsUpdateSkuRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let id: number; //Sku ID (default to undefined)
let body: ModelsUpdateSkuRequest; //Sku update info

const { status, data } = await apiInstance.skusIdPut(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsUpdateSkuRequest**| Sku update info | |
| **id** | [**number**] | Sku ID | defaults to undefined|


### Return type

**ModelsSkuResponse**

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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **skusImagesImageIdDelete**
> skusImagesImageIdDelete()


### Example

```typescript
import {
    SkusApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let imageId: number; //Image ID (default to undefined)

const { status, data } = await apiInstance.skusImagesImageIdDelete(
    imageId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **imageId** | [**number**] | Image ID | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | No Content |  -  |
|**400** | Bad Request |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **skusPost**
> ModelsSkuResponse skusPost(body)


### Example

```typescript
import {
    SkusApi,
    Configuration,
    ModelsCreateSkuRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new SkusApi(configuration);

let body: ModelsCreateSkuRequest; //Sku info

const { status, data } = await apiInstance.skusPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsCreateSkuRequest**| Sku info | |


### Return type

**ModelsSkuResponse**

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

