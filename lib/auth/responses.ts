type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return Boolean(value) && typeof value === "object";
}

function getResponseValue(payload: unknown, key: string): unknown {
  if (!isRecord(payload)) return undefined;

  if (key in payload) {
    return payload[key];
  }

  if (!isRecord(payload.data)) return undefined;
  return payload.data[key];
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return null;

  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function extractAuthToken(payload: unknown): string | null {
  return (
    asString(getResponseValue(payload, "token")) ??
    asString(getResponseValue(payload, "access_token"))
  );
}

export function extractResponseMessage(payload: unknown): string | null {
  return (
    asString(getResponseValue(payload, "message")) ??
    asString(getResponseValue(payload, "error")) ??
    asString(getResponseValue(payload, "responseMessage"))
  );
}

export function extractResponseSuccess(payload: unknown): boolean {
  const explicitSuccess =
    asBoolean(getResponseValue(payload, "success")) ??
    asBoolean(getResponseValue(payload, "status"));

  if (explicitSuccess !== null) {
    return explicitSuccess;
  }

  const responseMessage = asString(getResponseValue(payload, "responseMessage"));
  return responseMessage?.trim().toUpperCase() === "SUCCESSFUL";
}

export function isExistingUsernameResponse(payload: unknown): boolean {
  const responseMessage = asString(getResponseValue(payload, "responseMessage"));
  if (responseMessage) {
    return responseMessage.trim().toUpperCase() === "SUCCESSFUL";
  }

  return extractResponseSuccess(payload);
}
