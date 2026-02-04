# AuditLogsApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**auditLogsActionsGet**](#auditlogsactionsget) | **GET** /audit-logs/actions | Get audit log actions and entity types|
|[**auditLogsGet**](#auditlogsget) | **GET** /audit-logs | List audit logs|
|[**auditLogsIdGet**](#auditlogsidget) | **GET** /audit-logs/{id} | Get audit log|

# **auditLogsActionsGet**
> { [key: string]: any; } auditLogsActionsGet()

Returns available actions and entity types for filtering audit logs

### Example

```typescript
import {
    AuditLogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuditLogsApi(configuration);

const { status, data } = await apiInstance.auditLogsActionsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**{ [key: string]: any; }**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **auditLogsGet**
> ModelsAuditLogListResponse auditLogsGet()

Returns a paginated list of audit logs with filters

### Example

```typescript
import {
    AuditLogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuditLogsApi(configuration);

let page: number; //Page number (optional) (default to undefined)
let pageSize: number; //Page size (optional) (default to undefined)
let search: string; //Search term (optional) (default to undefined)
let action: string; //Action filter (optional) (default to undefined)
let entityType: string; //Entity type filter (optional) (default to undefined)
let entityId: string; //Entity id filter (optional) (default to undefined)
let performedBy: number; //Performed by user ID filter (optional) (default to undefined)
let startDate: string; //Start date (RFC3339) (optional) (default to undefined)
let endDate: string; //End date (RFC3339) (optional) (default to undefined)
let organizationId: number; //Filter for org (optional) (default to undefined)

const { status, data } = await apiInstance.auditLogsGet(
    page,
    pageSize,
    search,
    action,
    entityType,
    entityId,
    performedBy,
    startDate,
    endDate,
    organizationId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | Page number | (optional) defaults to undefined|
| **pageSize** | [**number**] | Page size | (optional) defaults to undefined|
| **search** | [**string**] | Search term | (optional) defaults to undefined|
| **action** | [**string**] | Action filter | (optional) defaults to undefined|
| **entityType** | [**string**] | Entity type filter | (optional) defaults to undefined|
| **entityId** | [**string**] | Entity id filter | (optional) defaults to undefined|
| **performedBy** | [**number**] | Performed by user ID filter | (optional) defaults to undefined|
| **startDate** | [**string**] | Start date (RFC3339) | (optional) defaults to undefined|
| **endDate** | [**string**] | End date (RFC3339) | (optional) defaults to undefined|
| **organizationId** | [**number**] | Filter for org | (optional) defaults to undefined|


### Return type

**ModelsAuditLogListResponse**

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

# **auditLogsIdGet**
> ModelsAuditLogResponse auditLogsIdGet()

Returns details of an audit log entry

### Example

```typescript
import {
    AuditLogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new AuditLogsApi(configuration);

let id: number; //Audit Log ID (default to undefined)

const { status, data } = await apiInstance.auditLogsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | Audit Log ID | defaults to undefined|


### Return type

**ModelsAuditLogResponse**

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

