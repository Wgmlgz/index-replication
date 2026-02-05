v.0.14.1

# ISS Queries

[/iss/securities](./205)

Список бумаг торгуемых на московской бирже.

[/iss/securities/[security]](./193)

Получить спецификацию инструмента.
Например: https://iss.moex.com/iss/securities/IMOEX.xml

[/iss/securities/[security]/indices](./199)

Список индексов в которые входит бумага

[/iss/securities/[security]/aggregates](./201)

Агрегированные итоги торгов за дату по рынкам

[/iss/index](./543)

Получить глобальные справочники ISS.
Например: https://iss.moex.com/iss/index.xml

[/iss/turnovers](./227)

Получить сводные обороты по рынкам.
Например: https://iss.moex.com/iss/turnovers.xml

[/iss/turnovers/columns](./225)

Получить описание полей для запросов оборотов по рынку/торговой системе.
Например: https://iss.moex.com/iss/engines/stock/turnovers/columns.xml

[/iss/engines/[engine]/markets/[market]/secstats](./403)

Промежуточные "Итоги дня".
Только для фондового рынка

[/iss/engines/[engine]/turnovers](./413)

Получить текущее значение оборотов торговой сессии по рынкам торговой системы

[/iss/engines/[engine]/markets/[market]/turnovers](./399)

Получить текущее значение оборота по рынку

[/iss/engines/[engine]/markets/zcyc](./405)

Получить данные по кривой бескупонной доходности
(Прекращены расчеты с 2018-01-03)

[/iss/engines/[engine]/zcyc](./417)

[/iss/history/otc/providers/nsd/markets](./499)

Обобщенные данные ОТС ПФИ и РЕПО - список рынков.

[/iss/history/otc/providers/nsd/markets/[market]/daily](./447)

Ежедневные обобщенные данные ОТС ПФИ и РЕПО.

[/iss/history/otc/providers/nsd/markets/[market]/monthly](./517)

Ежедневные обобщенные данные ОТС ПФИ и РЕПО.

[/iss/engines](./391)

Получить доступные торговые системы.
Например: https://iss.moex.com/iss/engines.xml

[/iss/engines/[engine]](./397)

Получить описание и режим работы торговой системы.
Например: https://iss.moex.com/iss/engines/stock.xml

[/iss/engines/[engine]/markets/[market]/.*?orderbook/columns](./411)

Получить описание полей для запросов стакана котировок для рынка.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/orderbook/columns.xml

[/iss/engines/[engine]/markets/[market]/.*?securities/columns](./381)

Получить описание полей для запросов публикуемых бумаг для рынка.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/securities/columns.xml

[/iss/engines/[engine]/markets](./343)

Получить список рынков торговой системы.
Например: https://iss.moex.com/iss/engines/stock/markets.xml

[/iss/engines/[engine]/markets/[market]/.*?trades/columns](./345)

Получить описание полей для запроса сделок по рынку.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/trades/columns.xml

[/iss/engines/[engine]/markets/[market]](./351)

Получить описание: словарь доступных режимов торгов, описание полей публикуемых таблиц данных и т.д.
Например: https://iss.moex.com/iss/engines/stock/markets/shares.xml

[/iss/engines/[engine]/markets/[market]/securities](./419)

Получить таблицу инструментов торговой сессии по рынку в целом.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/securities.xml

[/iss/engines/[engine]/markets/[market]/securities/[security]](./347)

Получить данные по конкретному инструменту рынка.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/securities/AFLT.xml

[/iss/engines/[engine]/markets/[market]/securities/[security]/trades](./425)

Получить сделки по инструменту.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/securities/AFLT/trades.xml

[/iss/engines/[engine]/markets/[market]/securities/[security]/orderbook](./357)

Получить стакан заявок по инструменту.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/securities/AFLT/orderbook.xml

[/iss/engines/[engine]/markets/[market]/orderbook](./317)

Получить стаканы заявок всех инструментов рынка.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/orderbook.xml

[/iss/engines/[engine]/markets/[market]/trades](./379)

Получить все сделки рынка.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/trades.xml

[/iss/engines/[engine]/markets/[market]/boards](./723)

Получить справочник режимов торгов рынка.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/boards.xml

[/iss/engines/[engine]/markets/[market]/boards/[board]](./361)

Получить описание режима торгов.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR.xml

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities](./353)

Получить таблицу инструментов по режиму торгов.
Например: https://iss.moex.com/iss/engines/stock/markets/shares/boards/TQBR/securities.xml

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]](./359)

Получить данные по указанному инструменту на выбранном режиме торгов.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/trades](./323)

Получить все сделки указанного инструмента по выбранному режиму торгов.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/orderbook](./371)

Получить стакан котировок указанного инструмента по выбранному режиму торгов.

[/iss/engines/[engine]/markets/[market]/securities/[security]/candles](./341)

Получить свечи указанного инструмента по дефолтной группе режимов.

[/iss/engines/[engine]/markets/[market]/securities/[security]/candleborders](./389)

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/candleborders](./369)

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/candles](./427)

Получить свечи указанного инструмента по выбранной группе режимов торгов.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/candles](./409)

Получить свечи указанного инструмента по выбранному режиму торгов.

[/iss/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/candleborders](./333)

Получить период дат рассчитанных свечей.

[/iss/engines/[engine]/markets/[market]/boards/[board]/trades](./325)

Получить все сделки по выбранному режиму торгов.

[/iss/engines/[engine]/markets/[market]/boards/[board]/orderbook](./395)

Получить все лучшие котировки по выбранному режиму торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups](./393)

Получить справочник групп режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]](./367)

Получить описание группы режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities](./385)

Получить список всех инструментов, торгуемых на выбранной группе режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]](./387)

Получить данные по указанному инструменту, торгуемому на выбранной группе режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/trades](./329)

Получить сделки выбранного инструмента, торгуемого на выбранной группе режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/orderbook](./315)

Получить лучшие заявки выбранного инструмента, торгуемого на выбранной группе режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/trades](./355)

Получить сделки инструментов, торгуемых на выбранной группе режимов торгов.

[/iss/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/orderbook](./313)

Получить лучшие заявки всех инструментов, торгуемых на выбранной группе режимов торгов.

[/iss/history/engines/[engine]/markets/[market]/.*?listing/columns](./461)

Получить описание полей для запросов торгуемости бумаг (листинга)

[/iss/history/engines/[engine]/markets/[market]/listing](./489)

Список неторгуемых инструментов с указанием интервалов торгуемости по режимам

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/listing](./459)

Получить данные по листингу бумаг в историческом разрезе по указанному режиму

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/listing](./479)

Получить данные по листингу бумаг в историческом разрезе по указанной группе режимов

[/iss/history/engines/[engine]/markets/[market]/sessions](./519)

Список сессий доступных в итогах торгов.
Только для фондового рынка!

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/securities](./467)

Получить историю по всем бумагам на рынке за одну дату.
Например: https://iss.moex.com/iss/history/engines/stock/markets/index/securities.xml?date=2010-11-22

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/securities/[security]](./435)

Получить историю по одной бумаге на рынке за интервал дат.

[/iss/history/engines/[engine]/markets/[market]/session/[session]/boardgroups/[boardgroup]/securities](./521)

Получить историю торгов для всех бумаг на указанной группе режимов торгов за указанную дату.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/boardgroups/[boardgroup]/securities/[security]](./469)

Получить историю торгов для указанной бумаги на выбранной группе режимов торгов за указанный интервал дат.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/boards/[board]/securities](./529)

Получить историю торгов для всех бумаг на указанном режиме торгов отфильтрованных по дате.

[/iss/history/engines/[engine]/markets/[market]/sessions/[session]/boards/[board]/securities/[security]](./445)

Получить историю торгов для указанной бумаги на указанном режиме торгов за указанный интервал дат.

[/iss/history/engines/[engine]/markets/[market]/.*?[securities]/columns](./441)

Получить описание полей для запросов исторических данных по бумагам для рынка.

[/iss/history/engines/stock/markets/shares/securities/changeover](./477)

Информация по техническому изменению торговых кодов

[/iss/history/engines/stock/zcyc](./475)

История изменения параметров КБД (Кривая Бескупоной Доходности).

[/iss/history/engines/[engine]/markets/[market]/securities](./497)

Получить историю по всем бумагам на рынке за одну дату.
Например: https://iss.moex.com/iss/history/engines/stock/markets/index/securities.xml?date=2010-11-22

[/iss/history/engines/[engine]/markets/[market]/yields](./513)

Получить историю рассчитанных доходностей для всех бумаг на указанном режиме торгов отфильтрованных по дате.

[/iss/history/engines/[engine]/markets/[market]/dates](./463)

Получить даты, за которые доступны данные на указанных рынке и торговой системе.

[/iss/history/engines/[engine]/markets/[market]/securities/[security]](./439)

Получить историю по одной бумаге на рынке за интервал дат.

[/iss/history/engines/[engine]/markets/[market]/yields/[security]](./501)

Получить историю доходностей по одной бумаге на рынке за интервал дат.

[/iss/history/engines/[engine]/markets/[market]/securities/[security]/dates](./433)

Получить интервал дат в истории для указанного рынка и бумаги.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/dates](./503)

Получить интервал дат, доступных в истории для рынка по заданному режиму торгов.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/securities](./491)

Получить историю торгов для всех бумаг на указанном режиме торгов отфильтрованных по дате.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/yields](./443)

Получить историю доходностей для всех бумаг на указанном режиме торгов отфильтрованных по дате.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/securities/[security]](./531)

Получить историю торгов для указанной бумаги на указанном режиме торгов за указанный интервал дат.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/yields/[security]](./495)

Получить историю доходностей для указанной бумаги на указанном режиме торгов за указанный интервал дат.

[/iss/history/engines/[engine]/markets/[market]/boards/[board]/securities/[security]/dates](./457)

Получить интервал дат в истории, за которые доступна указанная бумага на рынке на указанном режиме торгов.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/dates](./465)

Получить интервал дат для указанной группы режимов торгов.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities](./453)

Получить историю аукционов даркпул отфильтрованных по дате.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]](./487)

Получить историю аукционов даркпул за интервал дат.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities](./493)

Получить историю торгов для всех бумаг на указанной группе режимов торгов за указанную дату.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/yields](./455)

Получить доходности торгов для всех бумаг на указанной группе режимов торгов за указанную дату.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]](./483)

Получить историю торгов для указанной бумаги на выбранной группе режимов торгов за указанный интервал дат.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/yields/[security]](./473)

Получить историю доходностей для указанной бумаги на выбранной группе режимов торгов за указанный интервал дат.

[/iss/history/engines/[engine]/markets/[market]/boardgroups/[boardgroup]/securities/[security]/dates](./451)

Получить интервал дат для указанной бумаги на заданной группе режимов торгов.

[/iss/archives/engines/[engine]/markets/[market]/[datatype]/years](./247)

Список годов, за которые существуют ссылки на файлы с архивом сделок и исторической биржевой информацией.
datatype может принимать значения securities или trades.

[/iss/archives/engines/[engine]/markets/[market]/[datatype]/[period]](./249)

Получить список ccылок на годовые/месячные/дневные файлы с архивом сделок и исторической биржевой информацией.
datatype может принимать значения securities или trades.
period может принимать значения yearly, monthly или daily.
Помесячные данные доступны только за последние 30 дней.

[/iss/archives/engines/[engine]/markets/[market]/[datatype]/years/[year]/months](./253)

Список месяцев в году, за которые существуют ссылки на файлы с архивом сделок и исторической биржевой информацией.
datatype может принимать значения securities или trades.

[/iss/securitygroups](./181)

Группы ценных бумаг

[/iss/securitygroups/[securitygroup]](./189)

Группа ценных бумаг

[/iss/securitygroups/[securitygroup]/collections](./187)

Коллекции ценных бумаг входящие в группу

[/iss/securitygroups/[securitygroup]/collections/[collection]](./185)

Коллекция ценных бумаг входящие в группу

[/iss/securitygroups/[securitygroup]/collections/[collection]/securities](./183)

Описание инструментов

[/iss/statistics/engines/futures/promo](./763)

Суммарная комиссия по срочному рынку

[/iss/statistics/engines/futures/markets/options/assets](./111)

Опционные серии

[/iss/statistics/engines/futures/markets/options/assets/[asset]](./81)

Опционные серии

[/iss/statistics/engines/futures/markets/options/assets/[asset]/volumes](./119)

Объем торгов для опционной серии

[/iss/statistics/engines/futures/markets/options/assets/[asset]/optionboard](./9)

Доска опционов

[/iss/statistics/engines/futures/markets/options/assets/[asset]/openpositions](./145)

Открытые позиции по опционной серии

[/iss/statistics/engines/futures/markets/options/assets/[asset]/turnovers](./49)

Объем торгов для опционной серии

[/iss/statistics/engines/futures/markets/forts/series](./151)

Список фьючерсов

[/iss/statistics/engines/futures/markets/options/series](./173)

Опционные серии

[/iss/statistics/engines/futures/markets/options/series/[series_name]/securities](./43)

Опционные серии

[/iss/statistics/engines/futures/markets/[market]/openpositions](./155)

Список базовых активов для запроса открытых позиций для фьючерсов и опционов

[/iss/statistics/engines/futures/markets/[market]/openpositions/[asset]](./59)

Список базовых активов для запроса открытых позиций для фьючерсов и опционов

[/iss/statistics/complex/securities](./95)

Маркировка сложных финансовых инструментов

[/iss/statistics/complex/securities/[security]](./11)

Маркировка сложных финансовых инструментов - Инструмент

[/iss/statistics/engines/stock/markets/shares/correlations](./153)

Коэффициенты корелляции фондового рынка

[/iss/statistics/engines/currency/markets/selt/rates](./169)

Курсы ЦБРФ

[/iss/statistics/engines/stock/splits](./17)

Справочник дроблений и консолидаций бумаг фондового рынка

[/iss/statistics/engines/stock/splits/[security]](./57)

[/iss/statistics/engines/state/markets/repo/mirp](./45)

[/iss/statistics/engines/state/markets/repo/dealers](./113)

[/iss/statistics/engines/state/markets/repo/cboper](./69)

Средневзвешенные ставки по операциям центрального банка

[/iss/statistics/engines/stock/deviationcoeffs](./27)

Показатели для определения критериев существенного отклонения

[/iss/statistics/engines/stock/quotedsecurities](./165)

Cписок акций, по которым рассчитывается рыночная котировка

[/iss/statistics/engines/stock/currentprices](./53)

Текущие цены бумаг

[/iss/statistics/engines/stock/markets/bonds/monthendaccints](./21)

НКД на конец месяца

[/iss/statistics/engines/stock/markets/index/analytics/columns](./159)

[/iss/statistics/engines/stock/markets/index/bulletins](./93)

Бюллетени для индексов

[/iss/statistics/engines/stock/markets/index/rusfar](./35)

RUSFAR расшифровка показателей

[/iss/statistics/engines/stock/markets/index/rusfar/attributes](./761)

RUSFAR

[/iss/statistics/engines/[engine]/securitieslisting](./37)

Таблица соответствия торгуемых ценных бумаг по режимам торгов

[/iss/sitenews](./231)

Новости биржи

[/iss/sitenews/[news_id]](./229)

Новость сайта

[/iss/events](./553)

Мероприятия биржи

[/iss/events/[event_id]](./555)

Контент мероприятия биржи

[/iss/statistics/engines/stock/markets/bonds/aggregates](./13)

Агрегированные показатели рынка облигаций

[/iss/statistics/engines/stock/markets/bonds/aggregates/columns](./19)

[/iss/statistics/engines/stock/markets/index/analytics](./177)

Индексы фондового рынка

[/iss/statistics/engines/stock/markets/index/analytics/[indexid]](./73)

Аналитические показатели за дату

[/iss/statistics/engines/stock/markets/index/analytics/[indexid]/tickers](./141)

Список тикеров за все время торгов

[/iss/statistics/engines/stock/markets/index/analytics/[indexid]/tickers/[ticker]](./89)

Информация по тикеру

[/iss/statistics/engines/stock/capitalization](./105)

Капитализация фондового рынка

[/iss/history/engines/stock/totals/boards](./527)

Список режимов обобщенной информации по фондовому рынку

[/iss/history/engines/stock/totals/securities](./449)

Обобщенная информация по фондовому рынку

[/iss/history/engines/stock/totals/boards/[board]/securities](./471)

Обобщенная информация по фондовому рынку по выбранному режиму

[/iss/history/engines/stock/totals/boards/[board]/securities/[security]](./509)

Обобщенная информация по фондовому рынку по выбранному режиму и инструменту

[/iss/rms/engines/[engine]/objects/irr](./697)

Индикаторы риска

[/iss/rms/engines/[engine]/objects/settlementscalendar](./621)

Календарь расчетных дней

[/iss/rms/engines/[engine]/objects/[object]](./681)

Минимальные ограничительные уровни ставок обеспечения и лимиты концентрации на срочном рынке

[/iss/rms/engines/[engine]/objects/[object]](./729)

[/iss/rms/engines/[engine]/objects/[object]](./657)

Статические параметры

[/iss/rms/engines/[engine]/objects/[object]](./691)

Статические параметры по ключевым срокам

[/iss/rms/engines/[engine]/objects/[object]](./651)

Параметры процентных фьючерсов

[/iss/statistics/engines/state/rates](./107)

[/iss/statistics/engines/state/rates/columns](./97)

[/iss/statistics/engines/[engine]/derivatives/[report_name]](./71)

Еженедельные отчеты по валютным деривативам:

numtrades - Информация о количестве договоров по инструментам, являющимся производными финансовыми инструментами (по валютным парам)
participants - Информация о количестве лиц, имеющих открытые позиции по инструментам, являющимся производными финансовыми инструментами (по валютным парам)
openpositions - Информация об открытых позициях по инструментам, являющимся производными финансовыми инструментами (по валютным парам)
expirationparticipants - Информация о количестве лиц, имеющих открытые позиции по договорам, являющимся производными финансовыми инструментами (по срокам экспирации)
expirationopenpositions - Информация об объеме открытых позиций по договорам, являющимся производными финансовыми инструментами (по срокам экспирации)

[/iss/statistics/engines/[engine]/monthly/[report_name]](./91)

[/iss/statistics/engines/currency/markets/fixing/[security]](./117)

Фиксинги Московской биржи

[/iss/statistics/engines/futures/markets/indicativerates/securities](./25)

Индикативные курсы валют срочного рынка

[/iss/statistics/engines/futures/markets/indicativerates/securities/[security]](./63)

Индикативный курс валют срочного рынка

[/iss/statistics/engines/currency/markets/fixing](./5)

Фиксинги Московской биржи

[/iss/statistics/engines/[engine]/markets/[market]](./167)

Курсы переоценки коллатеральных инструментов

[/iss/statistics/engines/[engine]/markets/[market]/securities](./85)

Курсы переоценки коллатеральных инструментов

[/iss/statistics/engines/[engine]/markets/[market]/securities/[security]](./99)

Курсы переоценки коллатеральных инструментов.
Инструмент за интервал дат.

[/iss/referencedata/engines/[engine]/markets/all/securitieslisting](./559)

Референс дата 2.0 - справочник торгуемости

[/iss/referencedata/engines/stock/markets/all/securities](./557)

Референс дата 2.0 - Полный список инструментов

[/iss/referencedata/engines/stock/markets/all/shorts](./567)

Референс дата 2.0 - Полный список инструментов

[/iss/referencedata/engines/futures/markets/[market]/risks](./569)

Референс дата 2.0 -> Срочный рынок -> Риск параметры

[/iss/referencedata/engines/futures/markets/[market]/params](./563)

Референс дата 2.0 -> Срочный рынок -> Инструменты

[/iss/referencedata/engines/futures/markets/[market]/securities](./561)

Референс дата 2.0 -> Срочный рынок -> Инструменты

[/iss/analyticalproducts/netflow2/securities](./309)

[/iss/analyticalproducts/netflow2/securities/[security]](./305)

[/iss/analyticalproducts/futoi/securities](./307)

[/iss/analyticalproducts/futoi/securities/[security]](./311)

[/iss/history/statistics/markup/[markup_name]/[markup_type]](./299)

Сложные финансовые инструменты исторический срез.

[/iss/statistics/markup/[markup_name]/[markup_type]/[markup_view]](./297)

Сложные финансовые инструменты срез на текущую дату

[/iss/sdfi/curves/[curveid]](./237)

Своп-кривые на рынке СПФИ

[/iss/sdfi/curves](./235)

Своп-кривые на рынке СПФИ: справочник

[/iss/cci/info-nsd/companies](./733)

Сервисы корпоративной информации. Справочная информация по организациям.

[/iss/cci/info-nsd/companies/[company]](./737)

Сервисы корпоративной информации. Справочная информация по организации. Пример: https://iss.moex.com/iss/cci/info-nsd/companies/43558

[/iss/cci/reference/guides-treks](./753)

Сервисы корпоративной информации. Справочная информация по типам и категориям.

[/iss/cci/reference/periods](./755)

Сервисы корпоративной информации. Справочная информация по периодам выхода отчётов.

[/iss/cci/reference/nations](./757)

Сервисы корпоративной информации. Справочная информация по странам.

[/iss/cci/reference/sources](./751)

Сервисы корпоративной информации. Справочная информация по источникам данных.

[/iss/cci/accounting/msfo-source/reports](./889)

Сервисы корпоративной информации. Исходные данные отчётности МСФО.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/reports

[/iss/cci/accounting/msfo-source/periods/[period]/reports](./891)

Сервисы корпоративной информации. Исходные данные отчётности МСФО за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/periods/2024Y4Q/reports

[/iss/cci/accounting/msfo-source/companies/[company]/periods/[period]/reports](./897)

Сервисы корпоративной информации. Исходные данные отчётности МСФО по организации за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/companies/1194/periods/2025Y2Q/reports

[/iss/cci/accounting/msfo-source/companies/[company]/reports](./895)

Сервисы корпоративной информации. Исходные данные отчётности МСФО по организации.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/companies/1194/reports

[/iss/cci/accounting/msfo-source/reports/[report_id]](./901)

Сервисы корпоративной информации. Таблицы исходных данных отчётности МСФО.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/reports/33930

[/iss/cci/accounting/msfo-source/periods/[period]/reports/[report_id]](./887)

Сервисы корпоративной информации. Таблицы исходных данных отчётности МСФО за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/periods/2025Y2Q/reports/33930

[/iss/cci/accounting/msfo-source/companies/[company]/periods/[period]/reports/[report_id]](./893)

Сервисы корпоративной информации. Таблицы исходных данных отчётности МСФО по организации за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/companies/1194/periods/2025Y2Q/reports/33930

[/iss/cci/accounting/msfo-source/companies/[company]/reports/[report_id]](./899)

Сервисы корпоративной информации. Таблицы исходных данных отчётности МСФО по организации.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-source/companies/1194/reports/33930

[/iss/cci/accounting/[accounting_type]/reports](./749)

Сервисы корпоративной информации. Отчётность заданного типа (msfo-short, msfo-full, rsbu).
Пример: https://iss.moex.com/iss/cci/accounting/msfo-short/reports

[/iss/cci/accounting/[accounting_type]/periods/[period]/reports](./735)

Сервисы корпоративной информации. Отчётность заданного типа (msfo-short, msfo-full, rsbu) за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-full/periods/2024Y4Q/reports

[/iss/cci/accounting/[accounting_type]/companies/[company]/periods/[period]/reports](./745)

Сервисы корпоративной информации. Отчётность заданного типа (msfo-short, msfo-full, rsbu) по организации за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-short/companies/3636/periods/2023Y4Q/reports

[/iss/cci/accounting/[accounting_type]/companies/[company]/reports](./747)

Сервисы корпоративной информации. Отчётность заданного типа (msfo-short, msfo-full, rsbu) по организации.
Пример: https://iss.moex.com/iss/cci/accounting/rsbu/companies/1975/reports

[/iss/cci/accounting/[accounting_type]/reports/[report_id]](./739)

Сервисы корпоративной информации. Отчёт заданного типа (msfo-short, msfo-full, rsbu).
Пример: https://iss.moex.com/iss/cci/accounting/msfo-full/reports/1615

[/iss/cci/accounting/[accounting_type]/periods/[period]/reports/[report_id]](./743)

Сервисы корпоративной информации. Отчёт заданного типа (msfo-short, msfo-full, rsbu) за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/rsbu/periods/2024Y4Q/reports/11719

[/iss/cci/accounting/[accounting_type]/companies/[company]/periods/[period]/reports/[report_id]](./759)

Сервисы корпоративной информации. Отчёт заданного типа (msfo-short, msfo-full, rsbu) для указанной организации за указанный период.
Пример: https://iss.moex.com/iss/cci/accounting/rsbu/companies/5459/period/2024Y4Q/reports/9941

[/iss/cci/accounting/[accounting_type]/companies/[company]/reports/[report_id]](./741)

Сервисы корпоративной информации. Отчёт заданного типа (msfo-short, msfo-full, rsbu) для указанной организации.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-short/companies/42955/reports/12570

[/iss/cci/reference/rating-books](./799)

Сервисы корпоративной информации. Справочная информация по типам рейтингов.

[/iss/cci/reference/rating-levels](./765)

Сервисы корпоративной информации. Справочная информация по уровням рейтингов.

[/iss/cci/reference/rating-books-rating-levels](./791)

Сервисы корпоративной информации. Справочная информация по уровням рейтингов в зависимости от их типа.

[/iss/cci/rating/companies/[company_id]/securities](./861)

Сервисы корпоративной информации. Актуальные рейтинги выпусков для компании.

[/iss/cci/rating/companies/[company_id]/securities/[security_id]](./867)

Сервисы корпоративной информации. Актуальные рейтинги выпусков для компании.
Пример: https://iss.moex.com/iss/cci/rating/companies/1113/securities/RU000A1051U1
Пример: https://iss.moex.com/iss/cci/rating/companies/1113/securities/10075651

[/iss/cci/rating/companies](./803)

Сервисы корпоративной информации. Актуальные рейтинги организаций.

[/iss/cci/rating/companies/[company_id]](./785)

Сервисы корпоративной информации. Актуальные рейтинги организации.
Пример: https://iss.moex.com/iss/cci/rating/companies/1444

[/iss/cci/rating/history/companies](./787)

Сервисы корпоративной информации. Архивные данные по рейтингам организаций.

[/iss/cci/rating/history/companies/[company_id]](./771)

Сервисы корпоративной информации. Архивные данные по рейтингам указанной организации. Доступен поиск по ID, inn, ogrn, tax_number компании.
Пример: https://iss.moex.com/iss/cci/rating/history/companies/27204
Пример: https://iss.moex.com/iss/cci/rating/history/companies/1037739085636

[/iss/cci/rating/securities](./781)

Сервисы корпоративной информации. Актуальные рейтинги выпусков.

[/iss/cci/rating/securities/[security_id]](./773)

Сервисы корпоративной информации. Актуальные рейтинги указанного выпуска.
Пример: https://iss.moex.com/iss/cci/rating/securities/10080491
Пример: https://iss.moex.com/iss/cci/rating/securities/RU000A0JNYN1

[/iss/cci/rating/history/securities](./783)

Сервисы корпоративной информации. Архивные данные по рейтингам выпусков.

[/iss/cci/rating/history/securities/[security_id]](./789)

Сервисы корпоративной информации. Архивные данные по рейтингам указанного выпуска.
Пример: https://iss.moex.com/iss/cci/rating/history/securities/10080917
Пример: https://iss.moex.com/iss/cci/rating/history/securities/RU000A0JNYN

[/iss/cci/info-nsd/securitybooks](./767)

Сервисы корпоративной информации. Справочная информация по всем типам выпусков.

[/iss/cci/info-nsd/securities](./805)

Сервисы корпоративной информации. Базовая информация по всем выпускам.

[/iss/cci/info-nsd/securitybooks/[securitybook]/securities](./777)

Сервисы корпоративной информации. Детальная информация по выпускам одного типа.
Пример: https://iss.moex.com/iss/cci/info-nsd/securitybooks/bonds/securities

[/iss/cci/reporting/affiliates/reports](./795)

Сервисы корпоративной информации. Отчёты об аффилированных лицах.

[/iss/cci/reporting/affiliates/reports/[report_id]](./779)

Сервисы корпоративной информации. Отчёт об аффилированных лицах.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/reports/14464

[/iss/cci/reporting/affiliates/companies/[company]/periods/[period]/reports](./793)

Сервисы корпоративной информации. Отчёты об аффилированных лицах для указанной организации за указанный период.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/companies/7860/periods/2024Y4Q/reports

[/iss/cci/reporting/affiliates/companies/[company]/periods/[period]/reports/[report_id]](./797)

Сервисы корпоративной информации. Отчёт об аффилированных лицах для указанной организации за указанный период.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/companies/39284/periods/2023Y2Q/reports/14909

[/iss/cci/reporting/affiliates/periods/[period]/reports](./801)

Сервисы корпоративной информации. Отчёты об аффилированных лицах за указанный период.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/periods/2024Y2Q/reports

[/iss/cci/reporting/affiliates/periods/[period]/reports/[report_id]](./775)

Сервисы корпоративной информации. Отчёт об аффилированных лицах за указанный период.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/periods/2023Y4Q/reports/15075

[/iss/cci/reporting/affiliates/companies/[company]/reports](./769)

Сервисы корпоративной информации. Отчёты об аффилированных лицах для указанной организации.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/companies/788/reports

[/iss/cci/reporting/affiliates/companies/[company]/reports/[report_id]](./807)

Сервисы корпоративной информации. Отчёт об аффилированных лицах для указанной организации.
Пример: https://iss.moex.com/iss/cci/reporting/affiliates/companies/1153/reports/16932

[/iss/cci/rating/agg/companies](./829)

Сервисы корпоративной информации. Актуальные агрегированые рейтинги компаний

[/iss/cci/rating/agg/companies/[company_id]](./831)

Сервисы корпоративной информации. Актуальные агрегированые рейтинги компании. Доступен поиск по ID, inn, ogrn, tax_number компании.
Пример: https://iss.moex.com/iss/cci/rating/agg/companies/27204
Пример:https://iss.moex.com/iss/cci/rating/agg/companies/1022301606799

[/iss/cci/reference/industry-codes](./825)

Сервисы корпоративной информации. Актуальные данные по отраслевой классификации.

[/iss/cci/info/companies/industry-codes](./835)

Сервисы корпоративной информации. Список индустриальных кодов компаний.

[/iss/cci/accounting/msfo-full/indicators](./827)

Сервисы корпоративной информации. Отчётность по МСФО индикаторам.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-full/indicators

[/iss/cci/accounting/msfo-full/companies/[company]/indicators](./823)

Сервисы корпоративной информации. Отчётность зпо МСФО индикаторам для организации.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-full/companies/427/indicators

[/iss/cci/accounting/msfo-full/indicators/[report_id]](./833)

Сервисы корпоративной информации. Отчет по МСФО индикаторам для заданного ID отчета.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-full/indicators/155

[/iss/cci/reporting/corp-info/reports](./843)

Сервисы корпоративной информации. Отчётность по корпоративной информации компании.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/reports

[/iss/cci/reporting/corp-info/reports/[report_id]](./841)

Сервисы корпоративной информации. Отчётность по корпоративной информации компании для заданного ID отчета.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/reports/11

[/iss/cci/reporting/corp-info/companies/[company]/periods/[period]/reports](./845)

Сервисы корпоративной информации. Отчётность по корпоративной информации для указанной организации за указанный период.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/companies/952/periods/957/reports

[/iss/cci/reporting/corp-info/companies/[company]/periods/[period]/reports/[report_id]](./839)

Сервисы корпоративной информации. Данные определённого отчёта по корпоративной информации для указанной организации за указанный период.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/companies/952/periods/957/reports/12

[/iss/cci/reporting/corp-info/periods/[period]/reports](./853)

Сервисы корпоративной информации. Отчётность по корпоративной информации компании за период.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/periods/957/reports

[/iss/cci/reporting/corp-info/periods/[period]/reports/[report_id]](./849)

Сервисы корпоративной информации. Отчёт по корпоративной информации компании за период.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/periods/957/reports/12

[/iss/cci/reporting/corp-info/companies/[company]/reports](./837)

Сервисы корпоративной информации. Отчётность по корпоративной информации для организации.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/companies/952/reports

[/iss/cci/reporting/corp-info/companies/[company]/reports/[report_id]](./851)

Сервисы корпоративной информации. Отчёт по корпоратинвой информации для организации.
Пример: https://iss.moex.com/iss/cci/reporting/corp-info/companies/952/reports/12

[/iss/cci/rating/agg/securities](./855)

Сервисы корпоративной информации. Актуальные агрегированные рейтинги выпусков.

[/iss/cci/rating/agg/securities/[security_id]](./847)

Сервисы корпоративной информации. Актуальные агрегированные рейтинги указанного выпуска.
Пример: https://iss.moex.com/iss/cci/rating/agg/securities/10080491
Пример: https://iss.moex.com/iss/cci/rating/agg/securities/RU000A0JNYN1

[/iss/cci/accounting/msfo-full/industry-indicators/reports](./859)

Сервисы корпоративной информации. Предоставление средних значений простых индикаторов МСФО по отраслевой классификации компаний.

[/iss/cci/accounting/msfo-full/industry-indicators/reports/[indicator_id]](./857)

Сервисы корпоративной информации. Предоставление средних значений простых индикаторов МСФО по отраслевой классификации компаний.
Пример: https://iss.moex.com/iss/cci/accounting/msfo-full/industry-indicators/reports/10

[/iss/cci/info/companies](./881)

Сервисы корпоративной информации. Справочная информация по организациям.

[/iss/cci/info/companies/[company]](./879)

Сервисы корпоративной информации. Справочная информация по организации. Доступен поиск по идентификатору компанании, ИНН, ОГРН.
Пример: https://iss.moex.com/iss/cci/info/companies/43558
Пример: https://iss.moex.com/iss/cci/info/companies/3801022058
Пример: https://iss.moex.com/iss/cci/info/companies/1023800526056

[/iss/cci/calendars/ir-calendar](./903)

Сервисы корпоративной информации. IR-календари.
Пример: https://iss.moex.com/iss/cci/calendars/ir-calendar

[/iss/cci/corp-actions/meetings](./923)

Сервисы корпоративной информации. Отчётность по корпоративным действиям по встречам.
Пример: https://iss.moex.com/iss/cci/corp-actions/meetings

[/iss/cci/corp-actions/meetings/[corp_action_id]](./905)

Сервисы корпоративной информации. Отчётность по корпоративным действиям по встречам.
Пример: https://iss.moex.com/iss/cci/corp-actions/meetings/2957

[/iss/cci/corp-actions/coupons](./917)

Сервисы корпоративной информации. Отчётность по корпоративным действиям по купонам.
Пример: https://iss.moex.com/iss/cci/corp-actions/coupons

[/iss/cci/corp-actions/coupons/[corp_action_id]](./915)

Сервисы корпоративной информации. Отчётность по корпоративным действиям по купонам.
Пример: https://iss.moex.com/iss/cci/corp-actions/coupons/100

[/iss/cci/corp-actions/dividends](./921)

Сервисы корпоративной информации. Отчётность по корпоративным действиям по дивидендам.
Пример: https://iss.moex.com/iss/cci/corp-actions/dividends

[/iss/cci/corp-actions/dividends/[corp_action_id]](./927)

Сервисы корпоративной информации. Отчётность по корпоративным действиям по дивидендам.
Пример: https://iss.moex.com/iss/cci/corp-actions/dividends/2962

[/iss/cci/corp-actions](./913)

Сервисы корпоративной информации. Отчётность по корпоративным действиям компании.
Пример: https://iss.moex.com/iss/cci/corp-actions

[/iss/cci/corp-actions/[corp_action_id]](./925)

Сервисы корпоративной информации. Отчётность по корпоративным действиям компании.
Пример: https://iss.moex.com/iss/cci/corp-actions/1

[/iss/cci/consensus/shares-price](./909)

Сервисы корпоративной информации. Консенсус-прогнозы.
Пример: https://iss.moex.com/iss/cci/consensus/shares-price

[/iss/cci/consensus/shares-price/[security]](./907)

Сервисы корпоративной информации. Консенсус-прогнозы для ценной бумаги.
Примеры:
https://iss.moex.com/iss/cci/consensus/shares-price/10001312
https://iss.moex.com/iss/cci/consensus/shares-price/TATN
https://iss.moex.com/iss/cci/consensus/shares-price/RU0006944147

[/iss/cci/reference/relations](./919)

Сервисы корпоративной информации. Справочная информация по связям.

[/iss/cci/reference/trek-relations](./911)

Сервисы корпоративной информации. Справочная информация по связям категорий.

[/iss/cci/reporting/group-related-data](./931)

Сервисы корпоративной информации. Данные по связям для группы связанных лиц.
Пример: https://iss.moex.com/iss/cci/reporting/group-related-data

[/iss/cci/reporting/group-related](./929)

Сервисы корпоративной информации. Группы связанных лиц.
Пример: https://iss.moex.com/iss/cci/reporting/group-related

[/iss/cci/reporting/group-related/[group_related_id]](./933)

Сервисы корпоративной информации. Отчетность по группе связанных лиц.
Пример: https://iss.moex.com/iss/cci/reporting/group-related/3391
