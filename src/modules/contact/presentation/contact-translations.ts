import type { Locale } from "@/shared/config/locale";

const contactTranslations = {
  en: {
    description:
      "Contact Gradom.me for advertising, partnerships, or questions about the platform — send an inquiry and we'll reply as soon as possible.",
    email: "Email",
    error: "Your inquiry could not be sent. Please try again later.",
    fullName: "Full name",
    heading: "Contact",
    honeypot: "Website",
    intro:
      "Interested in advertising or working with Gradom? Send us an inquiry through the form and we’ll get back to you as soon as possible.",
    loading: "Sending…",
    message: "Message",
    shortIntro: "Questions, advertising, or partnership ideas — we read every message.",
    submit: "Send inquiry",
    success: "Thank you for your inquiry. We’ll get back to you as soon as possible.",
    validationSummary: "Please correct the highlighted fields before sending your inquiry.",
  },
  me: {
    description:
      "Kontaktirajte Gradom.me za oglašavanje, saradnju ili pitanja o platformi — pošaljite upit i javljamo se u najkraćem roku.",
    email: "E-mail",
    error: "Upit trenutno nije moguće poslati. Pokušajte ponovo kasnije.",
    fullName: "Ime i prezime",
    heading: "Kontakt",
    honeypot: "Web stranica",
    intro:
      "Zainteresovani ste za oglašavanje ili saradnju sa servisom Gradom.me? Pošaljite nam upit putem forme i javićemo vam se u najkraćem roku.",
    loading: "Slanje…",
    message: "Poruka",
    shortIntro: "Pitanja, oglašavanje ili ideje za saradnju — čitamo svaku poruku.",
    submit: "Pošalji upit",
    success: "Hvala na upitu. Javićemo vam se u najkraćem roku.",
    validationSummary: "Ispravite označena polja prije slanja upita.",
  },
} as const;

function getContactTranslations(locale: Locale) {
  return contactTranslations[locale];
}

export { getContactTranslations };
