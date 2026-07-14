import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { type NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";

async function bootstrap(): Promise<void> {
  const env = loadEnv(); // fail fast on invalid environment

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy / load balancer the client IP arrives in
  // X-Forwarded-For; trusting one hop keeps req.ip (rate limiting)
  // correct without letting clients spoof arbitrary addresses.
  if (env.TRUST_PROXY) app.set("trust proxy", 1);

  // Every app route lives under `/api` — the path is preserved end to end
  // (dev Next rewrite, prod Caddy) so the refresh cookie's `/api/auth/refresh`
  // path matches the browser-visible URL. The health probe is excluded so
  // infra can hit `http://traveller-api:4000/healthz` without the prefix.
  app.setGlobalPrefix("api", { exclude: ["healthz"] });

  // Web-independent JSON API: a deny-all CSP (nothing is ever rendered),
  // no framing, no MIME sniffing. helmet's defaults cover the rest.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
          "base-uri": ["'none'"],
          "form-action": ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.use(cookieParser());

  // CORS locked to the single web origin, cookies allowed, and only the
  // methods/headers the web client actually sends.
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
    maxAge: 600,
  });

  await app.listen(env.PORT);
  console.log(`api listening on http://localhost:${env.PORT}`);
}

void bootstrap();
