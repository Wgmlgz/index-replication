# PortfolioOperationsHistoryResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**has_next** | **boolean** |  | [optional] [default to undefined]
**items** | [**Array&lt;PortfolioOperationHistoryItem&gt;**](PortfolioOperationHistoryItem.md) |  | [optional] [default to undefined]
**next_cursor** | **string** |  | [optional] [default to undefined]
**portfolio_id** | **number** |  | [optional] [default to undefined]
**provider** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { PortfolioOperationsHistoryResponse } from './api';

const instance: PortfolioOperationsHistoryResponse = {
    has_next,
    items,
    next_cursor,
    portfolio_id,
    provider,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
