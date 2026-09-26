export async function api<T = unknown>(
  action: string,
  data?: Record<string, unknown>,
  query?: Record<string, string>,
): Promise<T> {
  const response = await fetch(
    `/api/platform?${new URLSearchParams({ action, ...query })}`,
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...data }),
        }
      : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "SERVER_ERROR");
  return result;
}
