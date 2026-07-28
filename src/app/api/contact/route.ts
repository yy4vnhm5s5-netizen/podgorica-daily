import { env } from "@/config/env";
import { createInMemoryContactRateLimiter } from "@/modules/contact/application/contact-rate-limiter";
import {
  createResendContactDelivery,
  getContactResendConfiguration,
} from "@/modules/contact/infrastructure/contact-resend-delivery";

import { createContactPostHandler } from "./contact-post-handler";

export const runtime = "nodejs";

const post = createContactPostHandler({
  delivery: createResendContactDelivery(
    getContactResendConfiguration({
      apiKey: env.RESEND_API_KEY,
      contactEmail: env.CONTACT_EMAIL,
      fromEmail: env.CONTACT_FROM_EMAIL,
    }),
  ),
  rateLimiter: createInMemoryContactRateLimiter(),
});

export async function POST(request: Request) {
  return post(request);
}
