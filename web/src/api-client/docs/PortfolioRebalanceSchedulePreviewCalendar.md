# PortfolioRebalanceSchedulePreviewCalendar


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**date** | **string** | YYYY-MM-DD | [optional] [default to undefined]
**day_code** | **string** | isdayoff code: 0|1|2|4|8 | [optional] [default to undefined]
**day_type** | **string** | workday|non_working_day|shortened_workday|special_workday|public_holiday | [optional] [default to undefined]
**is_work_day** | **boolean** | nil when date has no resolved status | [optional] [default to undefined]
**source** | **string** | isdayoff | [optional] [default to undefined]
**start_time** | **string** | trading window start (HH:mm) | [optional] [default to undefined]
**stop_time** | **string** | trading window stop (HH:mm) | [optional] [default to undefined]

## Example

```typescript
import { PortfolioRebalanceSchedulePreviewCalendar } from './api';

const instance: PortfolioRebalanceSchedulePreviewCalendar = {
    date,
    day_code,
    day_type,
    is_work_day,
    source,
    start_time,
    stop_time,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
