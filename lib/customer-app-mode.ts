// Older app builds can open the root URL without the native query parameter.
export function isCustomerAppUserAgent(userAgent: string): boolean {
  return /\bAvenynTaxiCustomer\b/i.test(userAgent)
    || (/Android/i.test(userAgent) && /; wv\)/i.test(userAgent))
    || (/(iPhone|iPad|iPod)/i.test(userAgent) && /AppleWebKit/i.test(userAgent)
      && /Mobile\//i.test(userAgent) && !/(Safari|CriOS|FxiOS|EdgiOS|OPiOS)\//i.test(userAgent));
}

export function isCustomerAppBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const native = (window as any).Capacitor;
  return new URLSearchParams(window.location.search).get("native") === "customer"
    || window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as any).standalone)
    || Boolean(native?.isNativePlatform?.())
    || ["android", "ios"].includes(native?.getPlatform?.())
    || isCustomerAppUserAgent(navigator.userAgent);
}
