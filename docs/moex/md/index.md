v.0.14.1

# ISS Queries

[/iss/securities](./205.md)

Moscow exchange securities list

[/iss/securities/[security]](./193.md)

Get security specifications.
Example: https://iss.moex.com/iss/securities/IMOEX.xml?lang=en

[/iss/securities/[security]/indices](./199.md)

[/iss/securities/[security]/aggregates](./201.md)

[/iss/index](./543.md)

Get initial ISS reference.
Example: https://iss.moex.com/iss/index.xml?lang=en

[/iss/turnovers](./227.md)

Get current turnover on all the markets.
Example: https://iss.moex.com/iss/turnovers.xml?lang=en

[/iss/turnovers/columns](./225.md)

Get the description of columns in requests for market/engine turnover.
Example: https://iss.moex.com/iss/engines/stock/turnovers/columns.xml?lang=en

[/iss/engines/[engine]/markets/[market]/secstats](./403.md)

[/iss/engines/[engine]/turnovers](./413.md)

Get current turnover for a trading engine

[/iss/engines/[engine]/markets/[market]/turnovers](./399.md)

Get current turnover for a market

[/iss/engines/[engine]/markets/zcyc](./405.md)

Get data for the zero-coupon yield curve.
(Calculations stopped at 2018-01-03)

[/iss/engines/[engine]/zcyc](./417.md)

[/iss/history/otc/providers/nsd/markets](./499.md)

[/iss/history/otc/providers/nsd/markets/[market]/daily](./447.md)

[/iss/history/otc/providers/nsd/markets/[market]/monthly](./517.md)

[/iss/engines](./391.md)

Get available trading systems.
Example: https://iss.moex.com/iss/engines.xml?lang=en

[/iss/engines/[engine]](./397.md)

Get description and availability time of a trading system.
Example: https://iss.moex.com/iss/engines/stock.xml

[/iss/engines/[engine]/markets/[market]/.*?orderbook/columns](./411.md)

Get the description of columns in requests for market orderbooks.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/boardgroups/6/orderbook/columns.xml?lang=en

[/iss/engines/[engine]/markets/[market]/.*?securities/columns](./381.md)

Get the description of columns in requests for securities.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/securities/columns.xml?lang=en

[/iss/engines/[engine]/markets](./343.md)

Get the list of markets for the trading system.
Example: https://iss.moex.com/iss/engines/stock/markets.xml?lang=en

[/iss/engines/[engine]/markets/[market]/.*?trades/columns](./345.md)

Get the description of columns in requests for market trades
Example: https://iss.moex.com/iss/engines/stock/markets/shares/trades/columns.xml?lang=en

[/iss/engines/[engine]/markets/[market]](./351.md)

Get the list of boards, board groups and metadata for all the table fields returned by other requests.
Example: https://iss.moex.com/iss/engines/stock/markets/shares.xml?lang=en

[/iss/engines/[engine]/markets/[market]/securities](./419.md)

Get metadata and market data for all the securities on the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/securities.xml?lang=en

[/iss/engines/[engine]/markets/[market]/securities/[security]](./347.md)

Get metadata and market data for the specified security on the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/securities/AFLT.xml?lang=en

[/iss/engines/[engine]/markets/[market]/securities/[security]/trades](./425.md)

Get all trades with the specified security on the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/securities/AFLT/trades.xml

[/iss/engines/[engine]/markets/[market]/securities/[security]/orderbook](./357.md)

Get orderbook for the specified security on the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/securities/AFLT/orderbook.xml

[/iss/engines/[engine]/markets/[market]/orderbook](./317.md)

Get orderbooks for all the securities on the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/orderbook.xml?lang=en

[/iss/engines/[engine]/markets/[market]/trades](./379.md)

Get all trades from the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/trades.xml

[/iss/engines/[engine]/markets/[market]/boards](./723.md)

Get the list of boards on the specified market.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/boards.xml?lang=en

[/iss/engines/[engine]/markets/[market]/boards/[board]](./361.md)

Get description of the specified board.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR.xml?lang=en

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities](./353.md)

Get metadata and market data for the specified security traded on the specified board.
Example: https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities.xml?lang=en

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]](./359.md)

Get data for the specified security on the specified board.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/trades](./323.md)

Get all trades with the specified security on the specified board.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/orderbook](./371.md)

Get the best quotes for the specified security on the specified board.

[/iss/engines/[engine]/markets/[market]/securities/[security]/candles](./341.md)

Get data for candlestick charts for the specified security.

[/iss/engines/[engine]/markets/[market]/securities/[security]/candleborders](./389.md)

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/candleborders](./369.md)

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/candles](./427.md)

Get data for candlestick charts for the specified security on the specified group of boards.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/candles](./409.md)

Get data for candlestick charts for the specified security on the specified board.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/candleborders](./333.md)

Get available intervals and dates for candlestick charts.

[/iss/engines/[engine]/markets/[market]/boards/[board]/trades](./325.md)

Get all trades from the specified board.

[/iss/engines/[engine]/markets/[market]/boards/[board]/orderbook](./395.md)

Get the best quotes for the specified board.

[/iss/engines/[engine]/markets/[market]/boardgroups](./393.md)

Get the list of board groups

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]](./367.md)

Get description of the board group

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities](./385.md)

Get the list of all securities traded on the specified board group.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]](./387.md)

Get metadata and market data for the specified security traded on the specified board group.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/trades](./329.md)

Get all trades for the specified security traded on the specified board group.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/orderbook](./315.md)

Get the best quotes for the specified security traded on the specified board group.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/trades](./355.md)

Get all trades from the specified board group.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/orderbook](./313.md)

Get the best quotes for the specified board group

[/iss/history/engines/[engine]/markets/[market]/.*?listing/columns](./461.md)

Get the description of columns for listing requests

[/iss/history/engines/[engine]/markets/[market]/listing](./489.md)

Get information on when securities were traded on which boards

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/listing](./459.md)

Get security listing information for a given board

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/listing](./479.md)

Get security listing information for a given boardgroup

[/iss/history/engines/[engine]/markets/[market]/sessions](./519.md)

Available sessions list in history.
For stock market only.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/securities](./467.md)

Get trade results for all the securities on the specified market on the specified date.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/securities/[security]](./435.md)

Get trade results for one security for the specified date range.

[/iss/history/engines/[engine]/markets/[market]/session/[session]/boardgroups/[boardgroup]/securities](./521.md)

Get trade results for all the securities on the specified board group for the specified date.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/boardgroups/[boardgroup]/securities/[security]](./469.md)

Get trade results for the specified security on the specified board group for the specified date.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/boards/[board]/securities](./529.md)

Get trade results for all the securities on the specified board for the specified date.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/boards/[board]/securities/[security]](./445.md)

Get trade results for the specified security on the specified board for the specified date interval.

[/iss/history/engines/[engine]/markets/[market]/.*?[securities]/columns](./441.md)

Get the description of columns in requests for security historical data.

[/iss/history/engines/stock/markets/shares/securities/changeover](./477.md)

Security ID change log

[/iss/history/engines/stock/zcyc](./475.md)

[/iss/history/engines/[engine]/markets/[market]/securities](./497.md)

Get trade results for all the securities on the specified market on the specified date.

[/iss/history/engines/[engine]/markets/[market]/yields](./513.md)

Get trade yields for all the securities on the specified board for the specified date.

[/iss/history/engines/[engine]/markets/[market]/dates](./463.md)

Get dates for which history on the specified market is available.

[/iss/history/engines/[engine]/markets/[market]/securities/[security]](./439.md)

Get trade results for one security for the specified date range.

[/iss/history/engines/[engine]/markets/[market]/yields/[security]](./501.md)

Get trade yields for one security for the specified date range.

[/iss/history/engines/[engine]/markets/[market]/securities/[security]/dates](./433.md)

Get dates for which history for the specified security on the specified market is available.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/dates](./503.md)

Get dates for which history for the board is available.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/securities](./491.md)

Get trade results for all the securities on the specified board for the specified date.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/yields](./443.md)

Get trade yields for all the securities on the specified board for the specified date.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/securities/[security]](./531.md)

Get trade results for the specified security on the specified board for the specified date interval.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/yields/[security]](./495.md)

Get trade yields for the specified security on the specified board for the specified date interval.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/dates](./457.md)

Get dates for which history for the specified security on the specified board is available.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/dates](./465.md)

Get dates for which history for the specified board group is available.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities](./453.md)

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]](./487.md)

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities](./493.md)

Get trade results for all the securities on the specified board group for the specified date.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/yields](./455.md)

Get trade results for all the securities on the specified board group for the specified date.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]](./483.md)

Get trade results for the specified security on the specified board group for the specified date.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/yields/[security]](./473.md)

Get trade yields for the specified security on the specified board group for the specified date.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/dates](./451.md)

Get dates for which history for the specified security on the specified board group is available.

[/iss/archives/engines/[engine]/markets/[market]/[datatype]/years](./247.md)

Get the list of years that have archives with trade lists and market data.
datatype can be set to securities or trades.

[/iss/archives/engines/[engine]/markets/[market]/[datatype]/[period]](./249.md)

Get the list of links to the yearly/monthly/daily archives of trade lists and market data.
datatype can be set to securities or trades.
period can be set to yearly, monthly or daily.
Daily data is stored for the last 30 days only.

[/iss/archives/engines/[engine]/markets/[market]/[datatype]/years/[year]/months](./253.md)

Get the list of months in a given year that have archives with trade lists and market data.
datatype can be set to securities or trades.

[/iss/securitygroups](./181.md)

Securities groups

[/iss/securitygroups/[securitygroup]](./189.md)

Securities group

[/iss/securitygroups/[securitygroup]/collections](./187.md)

Securities collections in security group

[/iss/securitygroups/[securitygroup]/collections/[collection]](./185.md)

Securities collection in security group

[/iss/securitygroups/[securitygroup]/collections/[collection]/securities](./183.md)

Securities description

[/iss/statistics/engines/futures/promo](./763.md)

[/iss/statistics/engines/futures/markets/options/assets](./111.md)

[/iss/statistics/engines/futures/markets/options/assets/[asset]](./81.md)

[/iss/statistics/engines/futures/markets/options/assets/[asset]/volumes](./119.md)

[/iss/statistics/engines/futures/markets/options/assets/[asset]/optionboard](./9.md)

[/iss/statistics/engines/futures/markets/options/assets/[asset]/openpositions](./145.md)

[/iss/statistics/engines/futures/markets/options/assets/[asset]/turnovers](./49.md)

[/iss/statistics/engines/futures/markets/forts/series](./151.md)

[/iss/statistics/engines/futures/markets/options/series](./173.md)

[/iss/statistics/engines/futures/markets/options/series/[series_name]/securities](./43.md)

[/iss/statistics/engines/futures/markets/[market]/openpositions](./155.md)

[/iss/statistics/engines/futures/markets/[market]/openpositions/[asset]](./59.md)

[/iss/statistics/complex/securities](./95.md)

No description.

[/iss/statistics/complex/securities/[security]](./11.md)

[/iss/statistics/engines/stock/markets/shares/correlations](./153.md)

[/iss/statistics/engines/currency/markets/selt/rates](./169.md)

[/iss/statistics/engines/stock/splits](./17.md)

[/iss/statistics/engines/stock/splits/[security]](./57.md)

[/iss/statistics/engines/state/markets/repo/mirp](./45.md)

[/iss/statistics/engines/state/markets/repo/dealers](./113.md)

[/iss/statistics/engines/state/markets/repo/cboper](./69.md)

[/iss/statistics/engines/stock/deviationcoeffs](./27.md)

[/iss/statistics/engines/stock/quotedsecurities](./165.md)

[/iss/statistics/engines/stock/currentprices](./53.md)

[/iss/statistics/engines/stock/markets/bonds/monthendaccints](./21.md)

[/iss/statistics/engines/stock/markets/index/analytics/columns](./159.md)

[/iss/statistics/engines/stock/markets/index/bulletins](./93.md)

[/iss/statistics/engines/stock/markets/index/rusfar](./35.md)

[/iss/statistics/engines/stock/markets/index/rusfar/attributes](./761.md)

[/iss/statistics/engines/[engine]/securitieslisting](./37.md)

[/iss/sitenews](./231.md)

Exchange news

[/iss/sitenews/[news_id]](./229.md)

A site news

[/iss/events](./553.md)

Exchange activities

[/iss/events/[event_id]](./555.md)

Exchange activity content

[/iss/statistics/engines/stock/markets/bonds/aggregates](./13.md)

[/iss/statistics/engines/stock/markets/bonds/aggregates/columns](./19.md)

[/iss/statistics/engines/stock/markets/index/analytics](./177.md)

[/iss/statistics/engines/stock/markets/index/analytics/[indexid]](./73.md)

[/iss/statistics/engines/stock/markets/index/analytics/[indexid]/tickers](./141.md)

[/iss/statistics/engines/stock/markets/index/analytics/[indexid]/tickers/[ticker]](./89.md)

[/iss/statistics/engines/stock/capitalization](./105.md)

Stock market capitalization

[/iss/history/engines/stock/totals/boards](./527.md)

[/iss/history/engines/stock/totals/securities](./449.md)

[/iss/history/engines/stock/totals/boards/[board]/securities](./471.md)

[/iss/history/engines/stock/totals/boards/[board]/securities/[security]](./509.md)

[/iss/rms/engines/[engine]/objects/irr](./697.md)

[/iss/rms/engines/[engine]/objects/settlementscalendar](./621.md)

[/iss/rms/engines/[engine]/objects/[object]](./681.md)

[/iss/rms/engines/[engine]/objects/[object]](./729.md)

[/iss/rms/engines/[engine]/objects/[object]](./657.md)

[/iss/rms/engines/[engine]/objects/[object]](./691.md)

[/iss/rms/engines/[engine]/objects/[object]](./651.md)

[/iss/statistics/engines/state/rates](./107.md)

[/iss/statistics/engines/state/rates/columns](./97.md)

[/iss/statistics/engines/[engine]/derivatives/[report_name]](./71.md)

[/iss/statistics/engines/[engine]/monthly/[report_name]](./91.md)

[/iss/statistics/engines/currency/markets/fixing/[security]](./117.md)

[/iss/statistics/engines/futures/markets/indicativerates/securities](./25.md)

[/iss/statistics/engines/futures/markets/indicativerates/securities/[security]](./63.md)

[/iss/statistics/engines/currency/markets/fixing](./5.md)

Moscow Exchange currency fixings

[/iss/statistics/engines/[engine]/markets/[market]](./167.md)

[/iss/statistics/engines/[engine]/markets/[market]/securities](./85.md)

[/iss/statistics/engines/[engine]/markets/[market]/securities/[security]](./99.md)

[/iss/referencedata/engines/[engine]/markets/all/securitieslisting](./559.md)

[/iss/referencedata/engines/stock/markets/all/securities](./557.md)

[/iss/referencedata/engines/stock/markets/all/shorts](./567.md)

[/iss/referencedata/engines/futures/markets/[market]/risks](./569.md)

[/iss/referencedata/engines/futures/markets/[market]/params](./563.md)

[/iss/referencedata/engines/futures/markets/[market]/securities](./561.md)

[/iss/analyticalproducts/netflow2/securities](./309.md)

[/iss/analyticalproducts/netflow2/securities/[security]](./305.md)

[/iss/analyticalproducts/futoi/securities](./307.md)

[/iss/analyticalproducts/futoi/securities/[security]](./311.md)

[/iss/history/statistics/markup/[markup_name]/[markup_type]](./299.md)

[/iss/statistics/markup/[markup_name]/[markup_type]/[markup_view]](./297.md)

[/iss/sdfi/curves/[curveid]](./237.md)

[/iss/sdfi/curves](./235.md)

[/iss/cci/info-nsd/companies](./733.md)

[/iss/cci/info-nsd/companies/[company]](./737.md)

[/iss/cci/reference/guides-treks](./753.md)

[/iss/cci/reference/periods](./755.md)

[/iss/cci/reference/nations](./757.md)

[/iss/cci/reference/sources](./751.md)

[/iss/cci/accounting/msfo-source/reports](./889.md)

[/iss/cci/accounting/msfo-source/periods/[period]/reports](./891.md)

[/iss/cci/accounting/msfo-source/companies/[company]/periods/[period]/reports](./897.md)

[/iss/cci/accounting/msfo-source/companies/[company]/reports](./895.md)

[/iss/cci/accounting/msfo-source/reports/[report_id]](./901.md)

[/iss/cci/accounting/msfo-source/periods/[period]/reports/[report_id]](./887.md)

[/iss/cci/accounting/msfo-source/companies/[company]/periods/[period]/reports/[report_id]](./893.md)

[/iss/cci/accounting/msfo-source/companies/[company]/reports/[report_id]](./899.md)

[/iss/cci/accounting/[accounting_type]/reports](./749.md)

[/iss/cci/accounting/[accounting_type]/periods/[period]/reports](./735.md)

[/iss/cci/accounting/[accounting_type]/companies/[company]/periods/[period]/reports](./745.md)

[/iss/cci/accounting/[accounting_type]/companies/[company]/reports](./747.md)

[/iss/cci/accounting/[accounting_type]/reports/[report_id]](./739.md)

[/iss/cci/accounting/[accounting_type]/periods/[period]/reports/[report_id]](./743.md)

[/iss/cci/accounting/[accounting_type]/companies/[company]/periods/[period]/reports/[report_id]](./759.md)

[/iss/cci/accounting/[accounting_type]/companies/[company]/reports/[report_id]](./741.md)

[/iss/cci/reference/rating-books](./799.md)

[/iss/cci/reference/rating-levels](./765.md)

[/iss/cci/reference/rating-books-rating-levels](./791.md)

[/iss/cci/rating/companies/[company_id]/securities](./861.md)

[/iss/cci/rating/companies/[company_id]/securities/[security_id]](./867.md)

[/iss/cci/rating/companies](./803.md)

[/iss/cci/rating/companies/[company_id]](./785.md)

[/iss/cci/rating/history/companies](./787.md)

[/iss/cci/rating/history/companies/[company_id]](./771.md)

[/iss/cci/rating/securities](./781.md)

[/iss/cci/rating/securities/[security_id]](./773.md)

[/iss/cci/rating/history/securities](./783.md)

[/iss/cci/rating/history/securities/[security_id]](./789.md)

[/iss/cci/info-nsd/securitybooks](./767.md)

[/iss/cci/info-nsd/securities](./805.md)

[/iss/cci/info-nsd/securitybooks/[securitybook]/securities](./777.md)

[/iss/cci/reporting/affiliates/reports](./795.md)

[/iss/cci/reporting/affiliates/reports/[report_id]](./779.md)

[/iss/cci/reporting/affiliates/companies/[company]/periods/[period]/reports](./793.md)

[/iss/cci/reporting/affiliates/companies/[company]/periods/[period]/reports/[report_id]](./797.md)

[/iss/cci/reporting/affiliates/periods/[period]/reports](./801.md)

[/iss/cci/reporting/affiliates/periods/[period]/reports/[report_id]](./775.md)

[/iss/cci/reporting/affiliates/companies/[company]/reports](./769.md)

[/iss/cci/reporting/affiliates/companies/[company]/reports/[report_id]](./807.md)

[/iss/cci/rating/agg/companies](./829.md)

[/iss/cci/rating/agg/companies/[company_id]](./831.md)

[/iss/cci/reference/industry-codes](./825.md)

[/iss/cci/info/companies/industry-codes](./835.md)

[/iss/cci/accounting/msfo-full/indicators](./827.md)

[/iss/cci/accounting/msfo-full/companies/[company]/indicators](./823.md)

[/iss/cci/accounting/msfo-full/indicators/[report_id]](./833.md)

[/iss/cci/reporting/corp-info/reports](./843.md)

[/iss/cci/reporting/corp-info/reports/[report_id]](./841.md)

[/iss/cci/reporting/corp-info/companies/[company]/periods/[period]/reports](./845.md)

[/iss/cci/reporting/corp-info/companies/[company]/periods/[period]/reports/[report_id]](./839.md)

[/iss/cci/reporting/corp-info/periods/[period]/reports](./853.md)

[/iss/cci/reporting/corp-info/periods/[period]/reports/[report_id]](./849.md)

[/iss/cci/reporting/corp-info/companies/[company]/reports](./837.md)

[/iss/cci/reporting/corp-info/companies/[company]/reports/[report_id]](./851.md)

[/iss/cci/rating/agg/securities](./855.md)

[/iss/cci/rating/agg/securities/[security_id]](./847.md)

[/iss/cci/accounting/msfo-full/industry-indicators/reports](./859.md)

[/iss/cci/accounting/msfo-full/industry-indicators/reports/[indicator_id]](./857.md)

[/iss/cci/info/companies](./881.md)

[/iss/cci/info/companies/[company]](./879.md)

[/iss/cci/calendars/ir-calendar](./903.md)

[/iss/cci/corp-actions/meetings](./923.md)

[/iss/cci/corp-actions/meetings/[corp_action_id]](./905.md)

[/iss/cci/corp-actions/coupons](./917.md)

[/iss/cci/corp-actions/coupons/[corp_action_id]](./915.md)

[/iss/cci/corp-actions/dividends](./921.md)

[/iss/cci/corp-actions/dividends/[corp_action_id]](./927.md)

[/iss/cci/corp-actions](./913.md)

[/iss/cci/corp-actions/[corp_action_id]](./925.md)

[/iss/cci/consensus/shares-price](./909.md)

[/iss/cci/consensus/shares-price/[security]](./907.md)

[/iss/cci/reference/relations](./919.md)

[/iss/cci/reference/trek-relations](./911.md)

[/iss/cci/reporting/group-related-data](./931.md)

[/iss/cci/reporting/group-related](./929.md)

[/iss/cci/reporting/group-related/[group_related_id]](./933.md)
