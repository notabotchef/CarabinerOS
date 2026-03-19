let csrfToken: string | null = null;
let runtimeId: string | null = null;
let csrfPromise: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = fetch("/csrf_token", { credentials: "include" })
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        csrfToken = data.token;
        runtimeId = data.runtime_id;

        // Agent Zero's WebSocket handler checks for this cookie by name
        // Its own frontend (api.js) sets it the same way
        document.cookie = `csrf_token_${runtimeId}=${csrfToken}; SameSite=Strict; Path=/`;

        return data.token;
      }
      throw new Error(data.error || "Failed to get CSRF token");
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

export function getRuntimeId(): string | null {
  return runtimeId;
}

export function clearCsrfToken() {
  csrfToken = null;
  runtimeId = null;
}
