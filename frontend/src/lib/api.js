import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
  withCredentials: true,
});

export function apiError(e) {
  const d = e?.response?.data?.detail;
  if (d == null) return e?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (d.message) return d.message;
  if (d.code) return d.code;
  return String(d);
}

export function apiErrorCode(e) {
  const d = e?.response?.data?.detail;
  return d && typeof d === "object" ? d.code : null;
}

export default api;
