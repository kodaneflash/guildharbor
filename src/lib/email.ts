import "server-only";

import { Resend } from "resend";

import { env } from "@/lib/env";

type OtpEmail = {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
};

const subjects: Record<OtpEmail["type"], string> = {
  "sign-in": "Your GuildHarbor sign-in code",
  "email-verification": "Verify your GuildHarbor email",
  "forget-password": "Reset your GuildHarbor password",
  "change-email": "Confirm your GuildHarbor email change",
};

export async function sendOtpEmail({ email, otp, type }: OtpEmail) {
  if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM) {
    if (env.NODE_ENV === "production") {
      throw new Error("Transactional email is not configured");
    }

    return;
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: env.AUTH_EMAIL_FROM,
    to: email,
    subject: subjects[type],
    text: `Your GuildHarbor verification code is ${otp}. It expires in five minutes. If you did not request this, you can ignore this email.`,
  });

  if (error) throw new Error("Unable to send authentication email");
}
