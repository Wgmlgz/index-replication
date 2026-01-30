import createClient from "openapi-fetch";
import type { paths } from "./types";

const baseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://api.app123.localhost";

const api = createClient<paths>({
  baseUrl,
  credentials: "include",
});

export default api;
