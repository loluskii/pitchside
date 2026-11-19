const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function formatDate(date: string, format: string): string {
  const d = parseApiDateForBrowser(date);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return format
    .replace("YYYY", String(d.getFullYear()))
    .replace("MMMM", MONTHS_FULL[d.getMonth()])
    .replace("MMM", MONTHS_SHORT[d.getMonth()])
    .replace("MM", pad(d.getMonth() + 1))
    .replace("DD", pad(d.getDate()))
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()))
    .replace("ss", pad(d.getSeconds()));
}

export function parseApiDateForBrowser(date?: Date | string | null): Date | null {
  if (!date) return null;
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : date;

  const value = String(date).trim();
  if (!value) return null;

  const hasExplicitTimeZone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
  const isIsoDateTime = /^\d{4}-\d{2}-\d{2}T/.test(value);
  const normalizedValue =
    hasExplicitTimeZone || isIsoDateTime ? value : value.replace(/-/g, "/");
  const parsedDate = new Date(normalizedValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function formatNumber(number: number | string, dp?: number): string {
  return parseFloat(String(number))
    .toFixed(dp ?? 2)
    .replace(/\d(?=(\d{3})+\.)/g, "$&,");
}

export function formatTotalOdds(number: number | string): string {
  const odds = parseFloat(String(number));
  if (odds < 1_000) return odds.toFixed(2);
  if (odds < 1_000_000) return (odds / 1_000).toFixed(1) + "k";
  if (odds < 1_000_000_000) return (odds / 1_000_000).toFixed(1) + "M";
  return (odds / 1_000_000_000).toFixed(1) + "B";
}

export function formatOdd(odd: number): string | number {
  return odd > 0 && odd % 1 === 0 ? odd + ".00" : odd;
}

export function formatString(str: string, pos: "pre" | string): string {
  const ast = "****";
  if (pos === "pre") return ast.concat(str.slice(-4));
  const spaceIndex = str.indexOf(" ");
  return str.substr(0, spaceIndex + 5).concat(ast);
}

export function formattedPhoneNumber(phoneNumber: number | string): string {
  const pNumber = String(phoneNumber).replace(/^0/, "");
  return pNumber.charAt(0) === "0" ? pNumber.substring(1) : pNumber;
}

export function stringIsLink(text: string): boolean {
  return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i.test(text.trim());
}
