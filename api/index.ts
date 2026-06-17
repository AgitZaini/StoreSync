import { app } from "../server/src/app";

export default function handler(request: Parameters<typeof app>[0], response: Parameters<typeof app>[1]) {
  if (request.url && !request.url.startsWith("/api")) {
    request.url = `/api${request.url}`;
  }

  return app(request, response);
}
