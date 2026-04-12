# PortfolioRebalanceSchedulePreviewMoexCalendar


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**date** | **string** | YYYY-MM-DD | [optional] [default to undefined]
**is_work_day** | **boolean** | nil for source&#x3D;none | [optional] [default to undefined]
**source** | **string** | dailytable|timetable|none | [optional] [default to undefined]
**start_time** | **string** | MOEX window start (HH:mm[:ss]) | [optional] [default to undefined]
**stop_time** | **string** | MOEX window stop (HH:mm[:ss]) | [optional] [default to undefined]

## Example

```typescript
import { PortfolioRebalanceSchedulePreviewMoexCalendar } from './api';

const instance: PortfolioRebalanceSchedulePreviewMoexCalendar = {
    date,
    is_work_day,
    source,
    start_time,
    stop_time,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
