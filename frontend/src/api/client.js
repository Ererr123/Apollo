const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000";

// Token lives in localStorage so a page refresh doesn't log you out.
function getToken() {
  return localStorage.getItem("apollo_token");
}

export function setToken(token) {
  if (token) localStorage.setItem("apollo_token", token);
  else localStorage.removeItem("apollo_token");
}

// Single fetch wrapper so every call gets the same base URL, JSON headers,
// auth header, and error handling - avoids repeating this in every component.
async function request(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
   
  // Use fetch instead of axios to avoid adding a dependency for a single call.
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

    // If the response is 204 No Content, return null instead of trying to parse JSON.
    if (response.status === 204) return null;
    
    const data = await response.json().catch(() => null);

    // If the response is not ok, throw an error with the message from the response.
    if (!response.ok) {
      const message = data?.error
        ? typeof data.error === "string"
          ? data.error
          : JSON.stringify(data.error)
        : `Request failed (${response.status})`;
      throw new Error(message);
    }
    // Return the parsed JSON data from the response.
    return data;
}

// Export an object with methods for each API endpoint, using the request function to make the calls.
export const client = {
    // Auth endpoints
    register: (email, password, name) =>
    request("/auth/register", { method: "POST", body: { email, password, name } }),
    login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password } }),

    // World endpoints
    listWorlds: () => request("/worlds"),
    createWorld: (title, description) =>
    request("/worlds", { method: "POST", body: { title, description } }),
    getWorld: (id) => request(`/worlds/${id}`),
    deleteWorld: (id) => request(`/worlds/${id}`, { method: "DELETE" }),

    // Document endpoints
    listDocuments: (worldId) => request(`/worlds/${worldId}/documents`),
    createDocument: (worldId, title, docType) =>
    request(`/worlds/${worldId}/documents`, {
      method: "POST",
      body: { title, docType },
    }),
    getDocument: (id) => request(`/documents/${id}`),
    updateDocument: (id, data) =>
    request(`/documents/${id}`, { method: "PATCH", body: data }),
   deleteDocument: (id) => request(`/documents/${id}`, { method: "DELETE" }),
};