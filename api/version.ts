import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function version(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("Version endpoint called");

  const response = {
    service: "lightwell-photos-frontend",
    commit: process.env.COMMIT_SHA || "unknown",
    deployedAt: process.env.DEPLOY_TIME || new Date().toISOString(),
    environment: process.env.ENVIRONMENT || "production",
    status: "healthy",
  };

  return {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify(response),
  };
}

app.http("version", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: version,
});
