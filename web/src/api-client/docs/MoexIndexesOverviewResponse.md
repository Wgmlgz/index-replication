# MoexIndexesOverviewResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**collections** | [**Array&lt;MoexIndexCollection&gt;**](MoexIndexCollection.md) |  | [optional] [default to undefined]
**indexes** | [**Array&lt;MoexIndex&gt;**](MoexIndex.md) |  | [optional] [default to undefined]
**memberships** | **{ [key: string]: Array&lt;string&gt;; }** |  | [optional] [default to undefined]

## Example

```typescript
import { MoexIndexesOverviewResponse } from './api';

const instance: MoexIndexesOverviewResponse = {
    collections,
    indexes,
    memberships,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
