import { hash } from "@/lib/engine/random";

// Generated crests for the simulated clubs and competitions.
const PALETTES = [
  ["#0C7A4D", "#F2F1EC"], ["#1D3A8A", "#F5C518"], ["#B4232B", "#FFFFFF"], ["#121A16", "#CBEA4E"],
  ["#5B2A86", "#F2F1EC"], ["#E36414", "#1B1B1B"], ["#0F4C5C", "#E9D8A6"], ["#7A1F3D", "#F7E1D7"],
  ["#2D6A4F", "#FFD166"], ["#023E8A", "#90E0EF"], ["#9D0208", "#FFBA08"], ["#264653", "#E76F51"],
];

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s.]/gu, "").split(/\s+/).filter((w) => w && !/^(fc|cf|cd|ud|sc|sv|us|ac|as|rc|afc|vfb|tsv|fsv|1\.)$/i.test(w));
  if (!words.length) return name.slice(0, 2).toUpperCase();
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function escape(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get("name") ?? "").slice(0, 60);
  const kind = searchParams.get("kind") === "league" ? "league" : "team";
  const h = hash(name);
  const [primary, secondary] = PALETTES[h % PALETTES.length];
  const pattern = (h >> 4) % 3;
  const label = escape(initials(name));

  const shield = "M32 3 L58 11 V30 C58 46 46 56 32 61 C18 56 6 46 6 30 V11 Z";
  const stripe =
    pattern === 0
      ? `<path d="M32 3 L58 11 V30 C58 46 46 56 32 61 Z" fill="${secondary}" opacity="0.22"/>`
      : pattern === 1
        ? `<path d="M6 24 H58 V34 H6 Z" fill="${secondary}" opacity="0.22"/>`
        : `<path d="M22 4 H42 V61 H22 Z" fill="${secondary}" opacity="0.2"/>`;

  const svg =
    kind === "league"
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="${primary}"/><text x="32" y="40" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="22" fill="${secondary}">${label}</text></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><clipPath id="s"><path d="${shield}"/></clipPath><path d="${shield}" fill="${primary}"/><g clip-path="url(#s)">${stripe}</g><path d="${shield}" fill="none" stroke="#121A16" stroke-opacity="0.18" stroke-width="2"/><text x="32" y="38" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="19" fill="${secondary}">${label}</text></svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
