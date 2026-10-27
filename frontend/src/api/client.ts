import axios from "axios";

// Keeps the HTTP status and response body so callers can act on structured errors
export class ApiError extends Error {
  status?: number;
  data?: Record<string, unknown>;

  constructor(message: string, status?: number, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const data = err.response?.data;
    let msg = data?.error ?? err.message ?? "Unknown error";
    // Validation errors list what's wrong in `detail`
    if (Array.isArray(data?.detail) && data.detail.length) msg += `: ${data.detail.join("; ")}`;
    return Promise.reject(new ApiError(msg, err.response?.status, err.response?.data));
  }
);

export default client;
