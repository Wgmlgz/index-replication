# OrganizationsApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**organizationsGet**](#organizationsget) | **GET** /organizations | List organizations|
|[**organizationsIdBlockPost**](#organizationsidblockpost) | **POST** /organizations/{id}/block | Block organization|
|[**organizationsIdDelete**](#organizationsiddelete) | **DELETE** /organizations/{id} | Delete organization|
|[**organizationsIdGet**](#organizationsidget) | **GET** /organizations/{id} | Get organization|
|[**organizationsIdPut**](#organizationsidput) | **PUT** /organizations/{id} | Update organization|
|[**organizationsIdUnblockPost**](#organizationsidunblockpost) | **POST** /organizations/{id}/unblock | Unblock organization|
|[**organizationsPost**](#organizationspost) | **POST** /organizations | Create organization|

# **organizationsGet**
> ModelsOrganizationListResponse organizationsGet()

Returns a paginated list of organizations

### Example

```typescript
import {
    OrganizationsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let page: number; //Page number (optional) (default to undefined)
let pageSize: number; //Page size (optional) (default to undefined)
let search: string; //Search term (optional) (default to undefined)
let sortBy: string; //Sort by field (optional) (default to undefined)
let sortDir: string; //Sort direction (asc/desc) (optional) (default to undefined)
let hideBlocked: boolean; //Don\'t show blocked (optional) (default to undefined)

const { status, data } = await apiInstance.organizationsGet(
    page,
    pageSize,
    search,
    sortBy,
    sortDir,
    hideBlocked
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
| **hideBlocked** | [**boolean**] | Don\&#39;t show blocked | (optional) defaults to undefined|


### Return type

**ModelsOrganizationListResponse**

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

# **organizationsIdBlockPost**
> { [key: string]: string; } organizationsIdBlockPost()

Blocks an organization and its users

### Example

```typescript
import {
    OrganizationsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let id: number; //Organization ID (default to undefined)

const { status, data } = await apiInstance.organizationsIdBlockPost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Organization ID | defaults to undefined|


### Return type

**{ [key: string]: string; }**

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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **organizationsIdDelete**
> organizationsIdDelete()

Deletes an organization

### Example

```typescript
import {
    OrganizationsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let id: number; //Organization ID (default to undefined)

const { status, data } = await apiInstance.organizationsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Organization ID | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **organizationsIdGet**
> ModelsOrganizationResponse organizationsIdGet()

Returns details of a specific organization

### Example

```typescript
import {
    OrganizationsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let id: number; //Organization ID (default to undefined)

const { status, data } = await apiInstance.organizationsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Organization ID | defaults to undefined|


### Return type

**ModelsOrganizationResponse**

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

# **organizationsIdPut**
> ModelsOrganizationResponse organizationsIdPut(body)

Updates an existing organization

### Example

```typescript
import {
    OrganizationsApi,
    Configuration,
    ModelsUpdateOrganizationRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let id: number; //Organization ID (default to undefined)
let body: ModelsUpdateOrganizationRequest; //Organization update info

const { status, data } = await apiInstance.organizationsIdPut(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsUpdateOrganizationRequest**| Organization update info | |
| **id** | [**number**] | Organization ID | defaults to undefined|


### Return type

**ModelsOrganizationResponse**

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

# **organizationsIdUnblockPost**
> { [key: string]: string; } organizationsIdUnblockPost()

Unblocks an organization

### Example

```typescript
import {
    OrganizationsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let id: number; //Organization ID (default to undefined)

const { status, data } = await apiInstance.organizationsIdUnblockPost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Organization ID | defaults to undefined|


### Return type

**{ [key: string]: string; }**

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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **organizationsPost**
> ModelsOrganizationResponse organizationsPost(body)

Creates a new organization

### Example

```typescript
import {
    OrganizationsApi,
    Configuration,
    ModelsCreateOrganizationRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new OrganizationsApi(configuration);

let body: ModelsCreateOrganizationRequest; //Organization info

const { status, data } = await apiInstance.organizationsPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsCreateOrganizationRequest**| Organization info | |


### Return type

**ModelsOrganizationResponse**

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

