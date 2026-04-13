# PortfolioRebalanceScheduleConfigUpsertRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**business_day_adjustment** | **string** |  | [optional] [default to undefined]
**dtstart** | **string** | RFC3339 datetime | [default to undefined]
**is_enabled** | **boolean** |  | [optional] [default to undefined]
**rrule** | **string** | RFC5545 RRULE (without DTSTART) | [default to undefined]

## Example

```typescript
import { PortfolioRebalanceScheduleConfigUpsertRequest } from './api';

const instance: PortfolioRebalanceScheduleConfigUpsertRequest = {
    business_day_adjustment,
    dtstart,
    is_enabled,
    rrule,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
