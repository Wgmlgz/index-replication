# PortfolioRebalanceSchedulePreviewCandidate


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**candidate_at** | **string** | RFC3339 datetime | [optional] [default to undefined]
**included** | **boolean** | true when candidate is returned in events | [optional] [default to undefined]
**is_work_day** | **boolean** | from MOEX schedule row when available | [optional] [default to undefined]
**reason** | **string** | accepted|no_schedule_for_day|non_working_day|missing_trading_time|outside_trading_hours | [optional] [default to undefined]
**source** | **string** | dailytable|timetable|none | [optional] [default to undefined]
**start_time** | **string** | MOEX window start (HH:mm[:ss]) | [optional] [default to undefined]
**stop_time** | **string** | MOEX window stop (HH:mm[:ss]) | [optional] [default to undefined]

## Example

```typescript
import { PortfolioRebalanceSchedulePreviewCandidate } from './api';

const instance: PortfolioRebalanceSchedulePreviewCandidate = {
    candidate_at,
    included,
    is_work_day,
    reason,
    source,
    start_time,
    stop_time,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
