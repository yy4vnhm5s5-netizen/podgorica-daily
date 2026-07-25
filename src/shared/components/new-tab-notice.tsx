import type { Locale } from "@/shared/config/locale";

import { getNewTabNotice } from "./external-link";

function NewTabNotice({ locale }: { locale: Locale }) {
  return <span className="sr-only"> {getNewTabNotice(locale)}</span>;
}

export { NewTabNotice };
