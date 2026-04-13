# PortfolioRebalanceScheduleConfigResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**business_day_adjustment** | **string** |  | [optional] [default to undefined]
**dtstart** | **string** | RFC3339 datetime | [optional] [default to undefined]
**is_enabled** | **boolean** |  | [optional] [default to undefined]
**last_error** | **string** |  | [optional] [default to undefined]
**last_run_at** | **string** |  | [optional] [default to undefined]
**last_run_id** | **number** |  | [optional] [default to undefined]
**next_run_at** | **string** |  | [optional] [default to undefined]
**rrule** | **string** | RFC5545 RRULE (without DTSTART) | [optional] [default to undefined]
**updated_at** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { PortfolioRebalanceScheduleConfigResponse } from './api';

const instance: PortfolioRebalanceScheduleConfigResponse = {
    business_day_adjustment,
    dtstart,
    is_enabled,
    last_error,
    last_run_at,
    last_run_id,
    next_run_at,
    rrule,
    updated_at,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
