const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yahooo.com": "yahoo.com",
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "example.com",
  "example.net",
  "example.org",
  "guerrillamail.com",
  "mailinator.com",
  "temp-mail.org",
  "tempmail.com",
]);

/** Browser-side signup check for a plausible public email domain. */
export function signupEmailError(rawEmail: string): string | null {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!email) return "Email is required";

  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) return "Enter a valid email address";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) {
    return "Enter a valid email address";
  }

  const suggestedDomain = COMMON_DOMAIN_TYPOS[domain];
  if (suggestedDomain) {
    return `Check the email domain — did you mean ${suggestedDomain}?`;
  }
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Use a permanent email address from your school or email provider";
  }

  const labels = domain.split(".");
  const validLabels =
    domain.length <= 253 &&
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
  const tld = labels.at(-1) ?? "";
  if (!validLabels || !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(tld)) {
    return "Enter an email with a real domain, like name@gmail.com";
  }
  return null;
}
