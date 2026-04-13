# PortfolioRebalanceSchedulePreviewRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**business_day_adjustment** | **string** |  | [optional] [default to undefined]
**dtstart** | **string** | RFC3339 datetime | [default to undefined]
**from** | **string** | optional lower bound (default now) | [optional] [default to undefined]
**limit** | **number** | optional max event count | [optional] [default to undefined]
**rrule** | **string** | RFC5545 RRULE (without DTSTART) | [default to undefined]
**to** | **string** | optional upper bound | [optional] [default to undefined]

## Example

```typescript
import { PortfolioRebalanceSchedulePreviewRequest } from './api';

const instance: PortfolioRebalanceSchedulePreviewRequest = {
    business_day_adjustment,
    dtstart,
    from,
    limit,
    rrule,
    to,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
