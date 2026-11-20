// Photography, all free to use under the Unsplash License (https://unsplash.com/license).
// Copies live in public/photos (WebP at 480/960/1600px), written by scripts/fetch-photos.mjs.
// To add a photo: add an entry here and push; the "Fetch photos" workflow commits the files.

type Photo = { id: string; credit: string; page: string };

export const PHOTOS = {
  stadiumNight: {
    id: "photo-1762013315117-1c8005ad2b41",
    credit: "Eduard Delputte",
    page: "https://unsplash.com/photos/65yjpk2HSlA",
  },
  stadiumDusk: {
    id: "photo-1780255440268-294ac67d0d9a",
    credit: "Anton Borzenkov",
    page: "https://unsplash.com/photos/vgRJgkxg_0E",
  },
  crowd: {
    id: "photo-1508782478-2164581d40cd",
    credit: "Alex Korolkoff",
    page: "https://unsplash.com/photos/b_y4wUk6WhE",
  },
  goalkeeper: {
    id: "photo-1518905332052-b6cfda20ee45",
    credit: "Vidar Nordli-Mathisen",
    page: "https://unsplash.com/photos/AQSfmgxGMEA",
  },
  goalNet: {
    id: "photo-1574676581439-89ee9f0a7bf1",
    credit: "Alberto Frías",
    page: "https://unsplash.com/photos/5jU39pgAAiw",
  },
  basketballCourt: {
    id: "photo-1531124042451-f3ba1765072c",
    credit: "Fulvio Ambrosanio",
    page: "https://unsplash.com/photos/zygvOSND4rI",
  },
  basketballGame: {
    id: "photo-1638569779285-3567a2bda2aa",
    credit: "Ludo Poiré",
    page: "https://unsplash.com/photos/_EyfHGHDOQ0",
  },
  tennis: {
    id: "photo-1627314387807-df615e8567de",
    credit: "Matthias David",
    page: "https://unsplash.com/photos/0wbYOLZwDPY",
  },
  hockey: {
    id: "photo-1549956847-f77eb7058468",
    credit: "Markus Spiske",
    page: "https://unsplash.com/photos/W2Hr3CQU8DI",
  },
  roulette: {
    id: "photo-1627831389670-d20f5a01c536",
    credit: "Hush Naidoo Jade Photography",
    page: "https://unsplash.com/photos/ax_jJpHdYjI",
  },
  dice: {
    id: "photo-1659382151328-30c3df37a69a",
    credit: "Leon-Pascal Jc",
    page: "https://unsplash.com/photos/2Axv9DC4Twk",
  },
  poker: {
    id: "photo-1517235990098-397c0e0be4a3",
    credit: "Marc A",
    page: "https://unsplash.com/photos/-J9k4nXYtMw",
  },
  cards: {
    id: "photo-1446669052213-5dcff53f1f3f",
    credit: "Michał Parzuchowski",
    page: "https://unsplash.com/photos/GikVY_KS9vQ",
  },
  slots: {
    id: "photo-1517085908802-f56a43681c18",
    credit: "Steve Sawusch",
    page: "https://unsplash.com/photos/PLfpXxZ9r9A",
  },
  nightFlight: {
    id: "photo-1711175016218-41ed0c24a5e3",
    credit: "Leo_Visions",
    page: "https://unsplash.com/photos/ZRYIdZUMDVg",
  },
  fansCheering: {
    id: "photo-1766756467595-fd3f1f62d562",
    credit: "Josip Ivanković",
    page: "https://unsplash.com/photos/R7lCxjyEVz0",
  },
  fansBanner: {
    id: "photo-1759156207851-ff2c0a158797",
    credit: "Ruben Mavarez",
    page: "https://unsplash.com/photos/L_Z0Sb2xcj0",
  },
  dunk: {
    id: "photo-1689894755862-730f4be37a6d",
    credit: "Yash Jeebaun",
    page: "https://unsplash.com/photos/o_8LV06JioI",
  },
  striker: {
    id: "photo-1748112445699-cb7f94e78ed4",
    credit: "Salah Regouane",
    page: "https://unsplash.com/photos/HNdCQpsRvSA",
  },
  watchParty: {
    id: "photo-1556202696-757728f6d972",
    credit: "Mariana Fernandes",
    page: "https://unsplash.com/photos/0b5nPhD4T3c",
  },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;

const PHOTO_WIDTHS = [480, 960, 1600] as const;

/**
 * Local URL for a photo, at the smallest stored width that covers `width`.
 * `height` is accepted for call-site clarity; cropping is done with CSS object-fit.
 */
export function photo(key: PhotoKey, width = 800, _height?: number) {
  void _height;
  const size = PHOTO_WIDTHS.find((w) => w >= width) ?? PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1];
  return `/photos/${key}-${size}.webp`;
}

export const SPORT_PHOTO: Record<string, PhotoKey> = {
  football: "stadiumNight",
  basketball: "basketballGame",
  "ice-hockey": "hockey",
  tennis: "tennis",
};

/** srcSet covering every stored width, for use with a matching `sizes` attribute. */
export function photoSrcSet(key: PhotoKey) {
  return PHOTO_WIDTHS.map((w) => `/photos/${key}-${w}.webp ${w}w`).join(", ");
}
