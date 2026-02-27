# TBankOperationsHistoryResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**account_id** | **string** |  | [optional] [default to undefined]
**environment** | **string** |  | [optional] [default to undefined]
**has_next** | **boolean** |  | [optional] [default to undefined]
**items** | [**Array&lt;TBankOperationHistoryItem&gt;**](TBankOperationHistoryItem.md) |  | [optional] [default to undefined]
**next_cursor** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { TBankOperationsHistoryResponse } from './api';

const instance: TBankOperationsHistoryResponse = {
    account_id,
    environment,
    has_next,
    items,
    next_cursor,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
