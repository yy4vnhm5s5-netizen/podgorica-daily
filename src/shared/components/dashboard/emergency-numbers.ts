interface EmergencyNumbersTranslations {
  ambulance: string;
  fireService: string;
  police: string;
}

interface EmergencyNumber {
  href: "tel:122" | "tel:123" | "tel:124";
  id: "ambulance" | "fireService" | "police";
  label: string;
  number: "122" | "123" | "124";
}

const emergencyNumbersStripLayout = {
  item: "min-w-0",
  link: "flex min-h-12 flex-col items-center justify-center gap-1 px-2 py-1 text-center focus-visible:relative focus-visible:z-10 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  list: "grid grid-cols-3 divide-x divide-blue-200/80",
} as const;

function getEmergencyNumbers(
  translations: EmergencyNumbersTranslations,
): readonly EmergencyNumber[] {
  return [
    { href: "tel:124", id: "ambulance", label: translations.ambulance, number: "124" },
    { href: "tel:122", id: "police", label: translations.police, number: "122" },
    { href: "tel:123", id: "fireService", label: translations.fireService, number: "123" },
  ];
}

export {
  emergencyNumbersStripLayout,
  getEmergencyNumbers,
  type EmergencyNumber,
  type EmergencyNumbersTranslations,
};
