/** Bound the entire price request, including a stalled response body. */
export async function fetchPriceQuote(url: string, requestKey: string, signal: AbortSignal, timeoutMs = 15000, headers:Record<string,string> = {}) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException("Request cancelled", "AbortError"));
    };
    signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("price_timeout"));
    }, timeoutMs);
    if (signal.aborted) cancel();
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store", headers });
        if (!response.ok) { const error=await response.json().catch(()=>({})); throw new Error(error.error||"price_unavailable"); }
        const data = await response.json();
        if (data?.requestKey !== requestKey) throw new Error("price_response_mismatch");
        return data;
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
