# TBankAccountPortfolioResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**account_id** | **string** |  | [optional] [default to undefined]
**daily_yield** | **number** |  | [optional] [default to undefined]
**daily_yield_relative** | **number** |  | [optional] [default to undefined]
**environment** | **string** |  | [optional] [default to undefined]
**money** | [**Array&lt;TBankMoneyBalance&gt;**](TBankMoneyBalance.md) |  | [optional] [default to undefined]
**positions** | [**Array&lt;TBankPortfolioPosition&gt;**](TBankPortfolioPosition.md) |  | [optional] [default to undefined]
**total_amount_portfolio** | **number** |  | [optional] [default to undefined]
**total_amount_portfolio_currency** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { TBankAccountPortfolioResponse } from './api';

const instance: TBankAccountPortfolioResponse = {
    account_id,
    daily_yield,
    daily_yield_relative,
    environment,
    money,
    positions,
    total_amount_portfolio,
    total_amount_portfolio_currency,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
