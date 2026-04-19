# Degree (ВКР по ГОСТ в Docker)

Этот каталог содержит готовый LaTeX-старт для ВКР с Docker и `Taskfile`.

Основа оформления взята из открытого шаблона:

- `weterans/gost` (класс `gost-7-32`, ориентирован на ГОСТ 7.32-2017): https://github.com/weterans/gost

Шаблонные файлы подключены локально в `template/gost-7-32/` для воспроизводимой сборки.

## Структура

- `src/main.tex` — ВКР-документ
- `src/references.bib` — источники
- `template/gost-7-32/` — файлы шаблона
- `Taskfile.yml` — команды сборки
- `Dockerfile` — контейнер для сборки PDF

## Команды

Запускать из `degree/`:

```bash
task build
task watch
```

# Похожие работы

In simular-works folder