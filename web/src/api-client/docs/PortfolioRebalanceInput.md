# PortfolioRebalanceInput


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**as_of_at** | **string** |  | [optional] [default to undefined]
**benchmark** | [**Array&lt;PortfolioRebalanceBenchmarkConstituent&gt;**](PortfolioRebalanceBenchmarkConstituent.md) |  | [optional] [default to undefined]
**holdings** | [**Array&lt;PortfolioRebalanceHolding&gt;**](PortfolioRebalanceHolding.md) |  | [optional] [default to undefined]
**instruments** | [**Array&lt;PortfolioRebalanceInstrumentInfo&gt;**](PortfolioRebalanceInstrumentInfo.md) |  | [optional] [default to undefined]
**investable_capital** | **number** |  | [optional] [default to undefined]
**mode_key** | **string** |  | [optional] [default to undefined]
**mode_params** | **{ [key: string]: any; }** |  | [optional] [default to undefined]
**money** | [**Array&lt;PortfolioRebalanceMoney&gt;**](PortfolioRebalanceMoney.md) |  | [optional] [default to undefined]
**params** | [**PortfolioRebalancePlanningParams**](PortfolioRebalancePlanningParams.md) |  | [optional] [default to undefined]

## Example

```typescript
import { PortfolioRebalanceInput } from './api';

const instance: PortfolioRebalanceInput = {
    as_of_at,
    benchmark,
    holdings,
    instruments,
    investable_capital,
    mode_key,
    mode_params,
    money,
    params,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
