# PortfolioSummaryResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**capabilities** | [**PortfolioCapabilities**](PortfolioCapabilities.md) |  | [optional] [default to undefined]
**daily_yield** | **number** |  | [optional] [default to undefined]
**daily_yield_relative** | **number** |  | [optional] [default to undefined]
**money** | [**Array&lt;PortfolioSummaryMoneyBalance&gt;**](PortfolioSummaryMoneyBalance.md) |  | [optional] [default to undefined]
**name** | **string** |  | [optional] [default to undefined]
**portfolio_id** | **number** |  | [optional] [default to undefined]
**positions** | [**Array&lt;PortfolioSummaryPosition&gt;**](PortfolioSummaryPosition.md) |  | [optional] [default to undefined]
**provider** | **string** |  | [optional] [default to undefined]
**total_amount_currency** | **string** |  | [optional] [default to undefined]
**total_amount_portfolio** | **number** |  | [optional] [default to undefined]

## Example

```typescript
import { PortfolioSummaryResponse } from './api';

const instance: PortfolioSummaryResponse = {
    capabilities,
    daily_yield,
    daily_yield_relative,
    money,
    name,
    portfolio_id,
    positions,
    provider,
    total_amount_currency,
    total_amount_portfolio,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
