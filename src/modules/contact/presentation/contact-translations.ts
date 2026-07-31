const contactTranslations = {
  description:
    "Partnerstva sa Gradom.me za pouzdane lokalne informacije, javne servise, događaje i sadržaje važne građanima.",
  email: "E-mail",
  emailPlaceholder: "ime@organizacija.me",
  error: "Upit trenutno nije moguće poslati. Pokušajte ponovo kasnije.",
  formDescription:
    "Ostavite osnovne kontakt podatke i ukratko opišite temu. Gradom.me će se javiti u roku od par radnih dana.",
  formHeading: "Pošaljite upit",
  fullName: "Ime i prezime",
  fullNamePlaceholder: "Ime i prezime",
  heading: "Povežimo građane sa informacijama koje su im zaista važne.",
  honeypot: "Web stranica",
  intro:
    "Gradom.me sarađuje sa opštinama, turističkim organizacijama, javnim ustanovama, komunalnim preduzećima, organizatorima događaja i lokalnim kompanijama kako bi važne gradske informacije bile tačne, ažurne i lako dostupne građanima.",
  loading: "Slanje…",
  message: "Kako možemo pomoći?",
  messagePlaceholder:
    "Opišite vašu organizaciju, projekat ili ideju i navedite kako Gradom.me može pomoći.",
  metadataTitle: "Partnerstva i saradnja | Gradom.me",
  partnershipLabel: "PARTNERSTVA",
  submit: "Pošalji upit",
  success: "Hvala na upitu. Javićemo vam se u roku od par radnih dana.",
  trustItems: [
    "Odgovor u roku od par radnih dana",
    "Partnerstva sa gradovima, institucijama i lokalnim organizacijama",
    "Promocija događaja, kulturnih programa i lokalnih sadržaja",
    "Integracija javnih servisa, obavještenja i korisnih gradskih informacija",
  ],
  validationSummary: "Ispravite označena polja prije slanja upita.",
} as const;

function getContactTranslations() {
  return contactTranslations;
}

export { getContactTranslations };
