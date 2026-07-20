import { env } from "@/config/env";
import { createInMemoryContactRateLimiter } from "@/modules/contact/application/contact-rate-limiter";
import {
  createSmtpContactDelivery,
  getContactSmtpConfiguration,
} from "@/modules/contact/infrastructure/contact-smtp-delivery";

import { createContactPostHandler } from "./contact-post-handler";

export const runtime = "nodejs";

const post = createContactPostHandler({
  delivery: createSmtpContactDelivery(
    getContactSmtpConfiguration({
      contactEmail: env.CONTACT_EMAIL,
      from: env.SMTP_FROM,
      host: env.SMTP_HOST,
      password: env.SMTP_PASSWORD,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      username: env.SMTP_USERNAME,
    }),
  ),
  rateLimiter: createInMemoryContactRateLimiter(),
});

export async function POST(request: Request) {
  return post(request);
}
