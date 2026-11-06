import { defineConfig } from "@graphql-hive/gateway";
import { unifiedGraphHandler, useQueryPlan } from "@graphql-hive/router-runtime";

export const gatewayConfig = defineConfig({
  // Plan zapytania udostępnia planer z Hive Router (tak opisuje to dokumentacja Hive Gateway).
  unifiedGraphHandler,
  plugins: () => [
    // Plan wraca w `extensions` odpowiedzi, gdy żądanie ma nagłówek `hive-expose-query-plan: true`.
    useQueryPlan({ expose: (request: Request) => request.headers.get("hive-expose-query-plan") === "true" }),
  ],
});
