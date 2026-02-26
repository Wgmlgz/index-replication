# TBankConnectionStatusResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**accounts** | [**Array&lt;TBankAccount&gt;**](TBankAccount.md) |  | [optional] [default to undefined]
**connected** | **boolean** |  | [optional] [default to undefined]
**connection_error** | **string** |  | [optional] [default to undefined]
**default_account_id** | **string** |  | [optional] [default to undefined]
**environment** | **string** |  | [optional] [default to undefined]
**token_masked** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { TBankConnectionStatusResponse } from './api';

const instance: TBankConnectionStatusResponse = {
    accounts,
    connected,
    connection_error,
    default_account_id,
    environment,
    token_masked,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
