import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module";

describe("GET /healthz (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api", { exclude: ["healthz"] }); // matches main.ts
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with { status: 'ok' }", async () => {
    await request(app.getHttpServer())
      .get("/healthz")
      .expect(200)
      .expect({ status: "ok" });
  });
});
