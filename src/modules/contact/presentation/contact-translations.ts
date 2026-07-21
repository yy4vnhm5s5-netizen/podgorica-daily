import type { Locale } from "@/shared/config/locale";

const contactTranslations = {
  en: {
    company: "Company",
    description: "Contact Gradom for advertising and business enquiries.",
    email: "Email",
    error: "Your inquiry could not be sent. Please try again later.",
    fullName: "Full name",
    heading: "Contact",
    honeypot: "Website",
    intro:
      "Interested in advertising or working with Gradom? Send us an inquiry through the form and we’ll get back to you as soon as possible.",
    loading: "Sending…",
    message: "Message",
    optional: "optional",
    phone: "Phone",
    submit: "Send inquiry",
    success: "Thank you for your inquiry. We’ll get back to you as soon as possible.",
  },
  me: {
    company: "Kompanija",
    description: "Kontaktirajte Gradom za oglašavanje i poslovne upite.",
    email: "E-mail",
    error: "Upit trenutno nije moguće poslati. Pokušajte ponovo kasnije.",
    fullName: "Ime i prezime",
    heading: "Kontakt",
    honeypot: "Web stranica",
    intro:
      "Zainteresovani ste za oglašavanje ili saradnju sa Gradomom? Pošaljite nam upit putem forme i javićemo vam se u najkraćem roku.",
    loading: "Slanje…",
    message: "Poruka",
    optional: "opcionalno",
    phone: "Telefon",
    submit: "Pošalji upit",
    success: "Hvala na upitu. Javićemo vam se u najkraćem roku.",
  },
} as const;

function getContactTranslations(locale: Locale) {
  return contactTranslations[locale];
}

export { getContactTranslations };
