"use client";

export type SportsbookFeatureIconKind = "cutOne" | "earlyGoals" | "flex" | "oneUp" | "twoUp";

export function SportsbookFeatureIcon({
  className = "",
  kind,
  tone = "default",
  variant = "chip",
}: {
  className?: string;
  kind: SportsbookFeatureIconKind;
  tone?: "active" | "default" | "muted";
  variant?: "chip" | "title";
}) {
  const chipSurfaceFill =
    tone === "active" ? "#ff7a1a" : tone === "muted" ? "#d7dde6" : "#ffffff";
  const chipGlyphFill =
    tone === "active" ? "#fff5eb" : tone === "muted" ? "#8b97a8" : "currentColor";
  const surfaceFill = variant === "chip" ? chipSurfaceFill: "#F9F9F8";
  const glyphFill = variant === "chip" ? chipGlyphFill: "#10100E";
  const flatFill =
    variant === "title"
      ? "#ffffff"
      : tone === "active"
        ? "#ff7a1a"
        : tone === "muted"
          ? "#c6ccd5"
          : "currentColor";

  if (kind === "oneUp") {
    return (
      <svg
        className={className}
        viewBox="0 0 60 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3.2 6.3L11.8 1.5H17.2V27.4H10.2V10.2L6.1 12.5L3.2 6.3Z"
          fill={flatFill}
        />
        <path
          d="M20.5 2.1H27.8V16.7C27.8 19.1 29 20.5 31.3 20.5C33.6 20.5 34.8 19.1 34.8 16.7V2.1H42.1V17C42.1 24.1 38 28 31.3 28C24.6 28 20.5 24.1 20.5 17V2.1Z"
          fill={flatFill}
        />
        <path
          d="M44.7 2.1H52.1C56.7 2.1 59.3 4.7 59.3 8.7C59.3 12.7 56.7 15.3 52.1 15.3H50.7V27.4H44.7V2.1ZM51.4 10.5C52.9 10.5 53.8 9.8 53.8 8.7C53.8 7.5 52.9 6.9 51.4 6.9H50.7V10.5H51.4Z"
          fill={flatFill}
        />
        <circle cx="53.1" cy="8.7" r="1.2" fill={flatFill} />
      </svg>
    );
  }

  if (kind === "twoUp") {
    return (
      <svg
        className={className}
        viewBox="0 0 64 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M3.5 9.2C3.5 4.3 7.3 1.5 13.1 1.5C18.8 1.5 22.2 4.1 22.2 8.4C22.2 11.6 20.5 13.8 16.7 16.1L11.6 19.2H22.5V27.4H3.6V21.1L13.1 15.1C15 13.9 15.7 12.9 15.7 11.5C15.7 10.1 14.6 9.2 12.9 9.2C11 9.2 9.8 10.4 9.8 12.4H3.5V9.2Z"
          fill={flatFill}
        />
        <path
          d="M25.2 2.1H32.5V16.7C32.5 19.1 33.7 20.5 36 20.5C38.3 20.5 39.5 19.1 39.5 16.7V2.1H46.8V17C46.8 24.1 42.7 28 36 28C29.3 28 25.2 24.1 25.2 17V2.1Z"
          fill={flatFill}
        />
        <path
          d="M49.4 2.1H56.8C61.4 2.1 64 4.7 64 8.7C64 12.7 61.4 15.3 56.8 15.3H55.4V27.4H49.4V2.1ZM56.1 10.5C57.6 10.5 58.5 9.8 58.5 8.7C58.5 7.5 58.5 6.9 56.1 6.9H55.4V10.5H56.1Z"
          fill={flatFill}
        />
        <circle cx="57.8" cy="8.7" r="1.2" fill={flatFill} />
      </svg>
    );
  }

  if (kind === "cutOne") {
    return (
      <svg
        className={className}
        viewBox="0 0 256 228"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M256 223V5C256 2.23858 253.762 0 251 0H5C2.23858 0 0 2.23857 0 4.99999V223C0 225.761 2.23858 228 5 228H251C253.762 228 256 225.761 256 223Z"
          fill={surfaceFill}
        />
        <path
          d="M46.5 53.5L69 30H171.5V228H102V89H46.5V53.5Z"
          fill={glyphFill}
        />
      </svg>
    );
  }

  if (kind === "flex") {
    return (
      <svg
        className={className}
        viewBox="0 0 256 228"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M256 228V0H0V228H256Z" fill={surfaceFill} />
        <path
          d="M36 64L71 30H221L201 82.5H92V109.5H206.5L185.5 162H92V228H36V64Z"
          fill={glyphFill}
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 256 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M256 229V1H0V229H256Z" fill={surfaceFill} />
      <path
        d="M162.303 0L51 133.25H111.186L86.8644 230L206 93.2314H137.569L162.303 0Z"
        fill={glyphFill}
      />
    </svg>
  );
}
