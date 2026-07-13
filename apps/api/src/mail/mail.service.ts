import { Injectable } from "@nestjs/common";
import { createTransport, type Transporter } from "nodemailer";

import { loadEnv } from "../config/env";
import { buildTransportOptions, mailFrom } from "./mail.transport";

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor() {
    const env = loadEnv();
    this.transporter = createTransport(buildTransportOptions(env));
    this.from = mailFrom(env);
  }

  /** Send the magic-link sign-in email (Mailpit in dev). */
  async sendMagicLink(to: string, link: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: "Sign in to Traveller",
      text: `Click to sign in to Traveller:\n\n${link}\n\nThis link is valid for 15 minutes and can be used once. If you didn't request it, ignore this email.`,
      html: `<p>Click to sign in to Traveller:</p><p><a href="${link}">Sign in</a></p><p>This link is valid for 15 minutes and can be used once. If you didn't request it, ignore this email.</p>`,
    });
  }
}
