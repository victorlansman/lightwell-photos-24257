import { AzureFunction, Context, HttpRequest } from "@azure/functions";

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
): Promise<void> {
  context.log("Version endpoint called");

  const response = {
    service: "lightwell-photos-frontend",
    commit: process.env.COMMIT_SHA || "unknown",
    deployedAt: process.env.DEPLOY_TIME || new Date().toISOString(),
    environment: process.env.ENVIRONMENT || "production",
    status: "healthy",
  };

  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: response,
  };
};

export default httpTrigger;
