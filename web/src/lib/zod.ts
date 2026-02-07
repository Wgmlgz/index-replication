import { z } from "zod";
import { zodI18nMap } from "zod-i18n-map";
import { initI18n } from "./i18n";

initI18n();
z.setErrorMap(zodI18nMap);

// export configured zod instance
export { z }
