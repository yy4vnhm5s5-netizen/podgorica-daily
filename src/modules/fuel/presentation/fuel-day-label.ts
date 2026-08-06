import { formatDateTime } from "@/shared/lib/date";

// One definition of "how a fuel date is written", imported by both the server-rendered page and the
// client chart. It replaced a `formatDay` callback prop: functions are not serializable, so passing
// one from a Server Component into the client trend crashed the route at render time. A plain
// module both sides import keeps a single date semantics without anything crossing the boundary.
//
// Always an effective date (the day prices start applying), never a publication date. Noon UTC
// pins the instant safely inside the Podgorica day, so the label cannot slide to the day before.
function formatFuelDay(effectiveDate: string, localeTag: string) {
  return formatDateTime(new Date(`${effectiveDate}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "long", timeStyle: undefined },
    locale: localeTag,
  }).label;
}

export { formatFuelDay };
