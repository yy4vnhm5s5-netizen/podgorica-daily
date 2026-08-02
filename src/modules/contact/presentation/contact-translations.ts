const contactTranslations = {
  description:
    "Partnerstva sa Gradom.me za pouzdane lokalne informacije, javne servise, događaje i sadržaje važne građanima.",
  email: "E-mail",
  emailPlaceholder: "Upišite Vaš e-mail",
  error: "Upit trenutno nije moguće poslati. Pokušajte ponovo kasnije.",
  formDescription:
    "Ostavite osnovne kontakt podatke i ukratko opišite temu. Gradom.me će se javiti u roku od par radnih dana.",
  formHeading: "Pošaljite upit",
  fullName: "Ime i prezime",
  fullNamePlaceholder: "Ime i prezime",
  heading: "Gradom.me svakog dana prati ono što je važno građanima.",
  honeypot: "Web stranica",
  intro:
    "Lokalne informacije su često rasute između sajtova opština, javnih preduzeća, turističkih organizacija, organizatora događaja i drugih izvora. Gradom.me ih svakodnevno prikuplja, provjerava i objedinjuje kako bi građani na jednom mjestu imali pouzdane i ažurne informacije.",
  loading: "Slanje…",
  message: "Kako možemo pomoći?",
  messagePlaceholder:
    "Pošaljite nam Vaše predloge za saradnju, sugestije, greške koje ste primijetili ili ideje kako Gradom.me možemo dodatno poboljšati.",
  metadataTitle: "Partnerstva i saradnja | Gradom.me",
  partnershipLabel: "JEDNO MJESTO ZA LOKALNE INFORMACIJE",
  submit: "Pošalji upit",
  success: "Hvala na upitu. Javićemo vam se u roku od par radnih dana.",
  trustItems: [
    "Svakodnevno praćenje i osvježavanje podataka",
    "Lokalne informacije objedinjene na jednom mjestu",
    "Provjera i dopuna podataka iz više izvora",
    "Kontinuirano proširivanje pokrivenosti gradova i servisa",
  ],
  validationSummary: "Ispravite označena polja prije slanja upita.",
} as const;

function getContactTranslations() {
  return contactTranslations;
}

export { getContactTranslations };
