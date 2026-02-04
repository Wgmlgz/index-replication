# RecognitionApi

All URIs are relative to *http://localhost:8080/api*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**botsRecognitionGet**](#botsrecognitionget) | **GET** /bots/recognition | WebSocket endpoint for recognition service|
|[**recognitionDetectPost**](#recognitiondetectpost) | **POST** /recognition/detect | Detect objects in an image|
|[**recognitionRecognizePost**](#recognitionrecognizepost) | **POST** /recognition/recognize | Recognize Sku from image|
|[**recognitionStatusGet**](#recognitionstatusget) | **GET** /recognition/status | Get recognizer connection status|

# **botsRecognitionGet**
> botsRecognitionGet()

Python recognition stub connects here to receive images and send results

### Example

```typescript
import {
    RecognitionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RecognitionApi(configuration);

const { status, data } = await apiInstance.botsRecognitionGet();
```

### Parameters
This endpoint does not have any parameters.


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
|**101** | Switching Protocols |  -  |
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **recognitionDetectPost**
> ModelsDetectResponse recognitionDetectPost(body)

Upload a base64-encoded image to detect objects and get their bounding boxes

### Example

```typescript
import {
    RecognitionApi,
    Configuration,
    ModelsDetectRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new RecognitionApi(configuration);

let body: ModelsDetectRequest; //Base64-encoded image (JPEG/PNG, max 40MB)

const { status, data } = await apiInstance.recognitionDetectPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsDetectRequest**| Base64-encoded image (JPEG/PNG, max 40MB) | |


### Return type

**ModelsDetectResponse**

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
|**503** | Service Unavailable |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **recognitionRecognizePost**
> ModelsRecognitionResponse recognitionRecognizePost(body)

Upload a base64-encoded product image to get Sku and confidence via one-shot recognition

### Example

```typescript
import {
    RecognitionApi,
    Configuration,
    ModelsRecognizeRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new RecognitionApi(configuration);

let body: ModelsRecognizeRequest; //Base64-encoded product photo (JPEG/PNG, max 40MB)
let isSingle: boolean; //Is run single detect & embed (optional) (default to undefined)
let isSingleEmbed: boolean; //Is run single embed (optional) (default to undefined)

const { status, data } = await apiInstance.recognitionRecognizePost(
    body,
    isSingle,
    isSingleEmbed
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **ModelsRecognizeRequest**| Base64-encoded product photo (JPEG/PNG, max 40MB) | |
| **isSingle** | [**boolean**] | Is run single detect &amp; embed | (optional) defaults to undefined|
| **isSingleEmbed** | [**boolean**] | Is run single embed | (optional) defaults to undefined|


### Return type

**ModelsRecognitionResponse**

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
|**503** | Service Unavailable |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **recognitionStatusGet**
> ModelsRecognitionStatus recognitionStatusGet()

Returns whether Python recognizer is connected and some metadata

### Example

```typescript
import {
    RecognitionApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RecognitionApi(configuration);

const { status, data } = await apiInstance.recognitionStatusGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**ModelsRecognitionStatus**

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

