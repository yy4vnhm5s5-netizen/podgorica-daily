"use client";

import type { FormEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";

import type {
  ContactInquiryField,
  ContactInquiryFieldErrors,
} from "@/modules/contact/domain/contact-inquiry";
import { Button } from "@/shared/components/ui/button";
import type { Locale } from "@/shared/config/locale";

import { getContactFormErrorSummaryItems, type ContactFormFieldIds } from "./contact-form-errors";
import { getContactTranslations } from "./contact-translations";

type ContactFormStatus = "idle" | "loading" | "success" | "error";

function ContactForm({ locale }: { locale: Locale }) {
  const translations = getContactTranslations(locale);
  const formId = useId();
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const shouldFocusErrorSummary = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<ContactInquiryFieldErrors>({});
  const [status, setStatus] = useState<ContactFormStatus>("idle");
  const fieldIds: ContactFormFieldIds = {
    company: `${formId}-company`,
    email: `${formId}-email`,
    fullName: `${formId}-full-name`,
    message: `${formId}-message`,
    phone: `${formId}-phone`,
  };
  const errorSummaryItems = getContactFormErrorSummaryItems(fieldErrors, fieldIds);

  useEffect(() => {
    if (!shouldFocusErrorSummary.current || errorSummaryItems.length === 0) return;

    errorSummaryRef.current?.focus();
    shouldFocusErrorSummary.current = false;
  }, [errorSummaryItems.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setFieldErrors({});

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      company: getFormValue(formData, "company"),
      email: getFormValue(formData, "email"),
      fullName: getFormValue(formData, "fullName"),
      locale,
      message: getFormValue(formData, "message"),
      phone: getFormValue(formData, "phone"),
      website: getFormValue(formData, "website"),
    };

    try {
      const response = await fetch("/api/contact", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as ContactResponse | null;

      if (response.status === 201 && body?.status === "sent") {
        form.reset();
        setStatus("success");
        return;
      }

      if (response.status === 422 && body?.fields) {
        shouldFocusErrorSummary.current = true;
        setFieldErrors(body.fields);
      }
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {errorSummaryItems.length > 0 ? (
        <div
          aria-labelledby={`${formId}-error-summary-heading`}
          className="rounded-md border border-red-200 bg-red-50 p-4 text-red-950"
          id={`${formId}-error-summary`}
          ref={errorSummaryRef}
          role="alert"
          tabIndex={-1}
        >
          <h2 className="font-semibold" id={`${formId}-error-summary-heading`}>
            {translations.validationSummary}
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {errorSummaryItems.map(({ field, href, message }) => (
              <li key={field}>
                <a
                  className="rounded-sm underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={href}
                >
                  {message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FormField
        autoComplete="name"
        error={fieldErrors.fullName}
        id={fieldIds.fullName}
        label={translations.fullName}
        name="fullName"
        required
      />
      <FormField
        autoComplete="email"
        error={fieldErrors.email}
        id={fieldIds.email}
        label={translations.email}
        name="email"
        required
        type="email"
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          autoComplete="organization"
          error={fieldErrors.company}
          id={fieldIds.company}
          label={translations.company}
          name="company"
          optionalLabel={translations.optional}
        />
        <FormField
          autoComplete="tel"
          error={fieldErrors.phone}
          id={fieldIds.phone}
          label={translations.phone}
          name="phone"
          optionalLabel={translations.optional}
          type="tel"
        />
      </div>
      <FormField
        error={fieldErrors.message}
        id={fieldIds.message}
        label={translations.message}
        name="message"
        required
        textarea
      />
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
      >
        <label htmlFor={`${formId}-website`}>{translations.honeypot}</label>
        <input
          autoComplete="off"
          id={`${formId}-website`}
          name="website"
          tabIndex={-1}
          type="text"
        />
      </div>
      <Button disabled={status === "loading"} type="submit">
        {status === "loading" ? translations.loading : translations.submit}
      </Button>
      <p aria-live="polite" className="min-h-5 text-sm" role="status">
        {status === "success" ? (
          <span className="text-emerald-800">{translations.success}</span>
        ) : status === "error" ? (
          <span className="text-destructive">{translations.error}</span>
        ) : null}
      </p>
    </form>
  );
}

function FormField({
  autoComplete,
  error,
  id,
  label,
  name,
  optionalLabel,
  required = false,
  textarea = false,
  type = "text",
}: {
  autoComplete?: string;
  error?: string;
  id: string;
  label: string;
  name: ContactInquiryField;
  optionalLabel?: string;
  required?: boolean;
  textarea?: boolean;
  type?: "email" | "tel" | "text";
}) {
  const errorId = `${id}-error`;
  const className =
    "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div>
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
        {optionalLabel ? (
          <span className="ml-1 font-normal text-muted-foreground">({optionalLabel})</span>
        ) : null}
      </label>
      {textarea ? (
        <textarea
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={`${className} min-h-32 resize-y`}
          id={id}
          name={name}
          required={required}
        />
      ) : (
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className={className}
          id={id}
          name={name}
          required={required}
          type={type}
        />
      )}
      {error ? (
        <p className="text-destructive mt-1.5 text-sm" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

interface ContactResponse {
  fields?: ContactInquiryFieldErrors;
  status?: string;
}

export { ContactForm };
