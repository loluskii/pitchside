"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Activity,
  Clock3,
  Dice5,
  FileText,
  Gift,
  Menu,
  QrCode,
  ReceiptText,
  Search,
  Send,
  Target,
  Trophy,
  Wallet,
  X,
} from "lucide-react";
import { FeaturedMatchCardSkeleton } from "@/components/home/FeaturedMatchCardSkeleton";
import { FixtureSkeleton } from "@/components/fixtures/FixtureSkeleton";
import { CasinoBand } from "@/components/home/CasinoBand";
import { HomeHero } from "@/components/home/HomeHero";
import { SportIconBadge } from "@/components/ui/SportIconBadge";
import { useSportsMenu } from "@/lib/query/hooks/useSports";
import { cn } from "@/lib/utils";

const FeaturedGamesContainer = dynamic(
  () => import("@/components/home/FeaturedGamesContainer").then((mod) => mod.FeaturedGamesContainer),
  {
    ssr: false,
    loading: () => (
      <div className="featured-scroll" aria-hidden="true">
        <FeaturedMatchCardSkeleton />
        <FeaturedMatchCardSkeleton />
      </div>
    ),
  },
);

const LiveContainer = dynamic(
  () => import("@/components/home/LiveContainer").then((mod) => mod.LiveContainer),
  {
    ssr: false,
    loading: () => (
      <div className="live-matches-container" aria-hidden="true">
        <FixtureSkeleton variant="live" />
        <FixtureSkeleton variant="live" />
      </div>
    ),
  },
);

const HighlightsContainer = dynamic(
  () => import("@/components/home/HighlightsContainer").then((mod) => mod.HighlightsContainer),
  {
    ssr: false,
    loading: () => (
      <div className="pre-matches-container" aria-hidden="true">
        <FixtureSkeleton />
        <FixtureSkeleton />
      </div>
    ),
  },
);

const QUICK_LINKS = [
  { id: 2, label: "Today's Football", icon: "today", kind: "today" },
  { id: 3, label: "Football in Next 3 Hours", icon: "three-hours", kind: "hours" },
] as const;

const MENU_TABS = ["All", "Sports", "Others"] as const;

const MORE_GAMES = [
  { label: "Liftoff", icon: "plane", href: "/casino/liftoff" },
  { label: "Spot Kick", icon: "target", href: "/casino/spot-kick" },
  { label: "Dice Duel", icon: "activity", href: "/casino/dice" },
  { label: "Hi-Lo", icon: "activity", href: "/casino/hi-lo" },
] as const;

const OTHER_MENU_ITEMS = [
  { label: "Load code", icon: "code", href: "/load-code" },
  { label: "Results", icon: "results", href: "/results" },
  { label: "Livescore", icon: "livescore", href: "/live" },
  { label: "Transactions", icon: "transactions", href: "/transactions" },
] as const;

const PAYMENT_MENU_ITEMS = [
  { label: "Deposit", icon: "deposit", href: "/deposit" },
  { label: "Withdraw", icon: "withdraw", href: "/withdraw" },
  { label: "Transactions", icon: "transactions", href: "/transactions" },
] as const;

type MenuTab = (typeof MENU_TABS)[number];
type DrawerIconKind =
  | (typeof MORE_GAMES)[number]["icon"]
  | (typeof OTHER_MENU_ITEMS)[number]["icon"]
  | (typeof PAYMENT_MENU_ITEMS)[number]["icon"];
type DrawerActionItem = {
  key: string;
  label: string;
  icon: DrawerIconKind;
  href?: string;
};
type DrawerSportItem = {
  key: string;
  label: string;
  slug: string;
  sport: string;
};
type DrawerItem = DrawerSportItem | DrawerActionItem;
type DrawerGroup = {
  key: MenuTab;
  items: DrawerItem[];
};

function QuickLinkIcon({ kind }: { kind: (typeof QUICK_LINKS)[number]["icon"] }) {
  if (kind === "today") {
    return (
      <div className="quick-link-icon-circle quick-link-icon-today">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="quick-link-spark-lines"
        >
          <path d="M0 8h10M2 16h8M0 12h12" stroke="#d946ef" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <SportIconBadge sport="football" size="sm" className="absolute bottom-[3px] right-[3px] h-3.5 w-3.5" />
      </div>
    );
  }

  if (kind === "three-hours") {
    return (
      <div className="quick-link-icon-circle quick-link-icon-three-hours">
        3
      </div>
    );
  }
  return null;
}

function MoreMenuIcon({ kind }: { kind: DrawerIconKind }) {
  if (kind === "activity") return <Activity size={24} color="currentColor" />;
  if (kind === "target") return <Target size={24} color="currentColor" />;
  if (kind === "code") return <QrCode size={24} color="currentColor" />;
  if (kind === "results") return <Trophy size={24} color="currentColor" />;
  if (kind === "livescore") return <Clock3 size={24} color="currentColor" />;
  if (kind === "deposit") return <Wallet size={24} color="currentColor" />;
  if (kind === "withdraw") return <Send size={24} color="currentColor" />;
  if (kind === "transactions") return <ReceiptText size={24} color="currentColor" />;
  return <FileText size={24} color="currentColor" />;
}

export function HomeView() {
  const router = useRouter();
  const [activeMenuTab, setActiveMenuTab] = useState<MenuTab>("All");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const { data: sportsMenu = [], isLoading: isSportsMenuLoading } = useSportsMenu();
  const primarySport =
    sportsMenu.find((sport) => sport.slug === "football" || sport.id === "1") ?? sportsMenu[0];
  const primarySportSlug = primarySport?.slug ?? "football";
  const quickLinks = [
    {
      id: 2,
      label: "Today's Football",
      icon: "today" as const,
      href: `/sports/${primarySportSlug}?period=today`,
    },
    {
      id: 3,
      label: "Football in Next 3 Hours",
      icon: "three-hours" as const,
      href: `/sports/${primarySportSlug}?hours=3`,
    },
  ];
  const menuSports: DrawerSportItem[] = [
    ...(primarySport
      ? [
          {
            key: primarySport.id,
            label: primarySport.name,
            slug: primarySport.slug,
            sport: primarySport.name,
          },
        ]
      : []),
    ...sportsMenu
      .filter((sport) => sport.id !== primarySport?.id)
      .map((sport) => ({
        key: sport.id,
        label: sport.name,
        slug: sport.slug,
        sport: sport.name,
      })),
  ];

  const drawerGroups: DrawerGroup[] = [
    { key: "Sports", items: menuSports },
    {
      key: "Others",
      items: OTHER_MENU_ITEMS.map((item) => ({
        key: item.label,
        label: item.label,
        icon: item.icon,
        href: item.href,
      })),
    },
  ];
  const normalizedMenuSearch = menuSearchQuery.trim().toLowerCase();
  const hasSearchQuery = normalizedMenuSearch.length > 0;
  const activeMenuGroup =
    drawerGroups.find((group) => group.key === activeMenuTab) ?? drawerGroups[0];
  const filterMenuItems = (items: DrawerItem[]) =>
    items.filter((item) => item.label.toLowerCase().includes(normalizedMenuSearch));
  let visibleMenuGroups: DrawerGroup[];

  if (!hasSearchQuery && activeMenuTab === "All") {
    visibleMenuGroups = drawerGroups;
  } else if (hasSearchQuery) {
    visibleMenuGroups = drawerGroups
      .map((group) => ({ ...group, items: filterMenuItems(group.items) }))
      .filter((group) => group.items.length > 0);
  } else {
    visibleMenuGroups = [{ ...activeMenuGroup, items: filterMenuItems(activeMenuGroup.items) }];
  }
  const shouldShowEmptyState =
    visibleMenuGroups.length === 0 &&
    !(activeMenuTab === "Sports" && isSportsMenuLoading && !hasSearchQuery);

  function openFixtureSearch() {
    const query = menuSearchQuery.trim();
    if (!query) return;
    setIsMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
        <HomeHero />

        {/* Alternating bands: dark live, light featured, dark casino, light schedule. */}
        <LiveContainer />
        <FeaturedGamesContainer />
        <CasinoBand />
        <HighlightsContainer />

      {isMenuOpen ? <div className="menu-overlay" onClick={() => setIsMenuOpen(false)} /> : null}
      <div className={cn("menu-drawer", isMenuOpen && "open")}>
        <div className="menu-header">
          <div className="menu-header-row justify-end">
            <button
              type="button"
              aria-label="Close menu"
              className="header-search-button menu-close-button"
              onClick={() => {
                setMenuSearchQuery("");
                setIsMenuOpen(false);
              }}
            >
              <X size={24} color="currentColor" />
            </button>
          </div>
          <form
            className="menu-search-bar"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              openFixtureSearch();
            }}
          >
            <Search size={18} color="var(--text-dim)" />
            <input
              type="search"
              autoComplete="off"
              placeholder="Search sports, menu, or fixtures"
              className="menu-search-input"
              value={menuSearchQuery}
              onChange={(event) => setMenuSearchQuery(event.target.value)}
              aria-label="Search menu items"
            />
          </form>
        </div>

        <div className="menu-tabs">
          {MENU_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn("menu-tab", activeMenuTab === tab && "active")}
              onClick={() => setActiveMenuTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="menu-content">
          {hasSearchQuery ? (
            <button
              type="button"
              className="mb-4 flex w-full items-center justify-between rounded-xl border border-[var(--border-dim)] bg-white/[0.03] px-4 py-3 text-left text-base leading-[1.5] text-[var(--text-dim)] transition-colors hover:bg-white/[0.05]"
              onClick={openFixtureSearch}
            >
              <span>Search sportsbook fixtures for &quot;{menuSearchQuery.trim()}&quot;</span>
              <span className="text-white/70">Open</span>
            </button>
          ) : null}

          {visibleMenuGroups.map((group, groupIndex) => (
            <section key={group.key} className={cn(groupIndex > 0 && "mt-6")}>
              <div className="menu-section-title">{group.key}</div>
              <div className="menu-grid">
                {group.key === "Sports" && isSportsMenuLoading && !hasSearchQuery
                  ? Array.from({ length: 8 }).map((_, index) => (
                      <div key={`menu-sports-skeleton-${index}`} className="menu-grid-item">
                        <div className="menu-grid-icon-wrap animate-pulse bg-white/5" />
                        <span className="menu-grid-label text-white/40">Loading</span>
                      </div>
                    ))
                  : group.items.map((item) =>
                      "sport" in item ? (
                        <button
                          key={item.key}
                          type="button"
                          className="menu-grid-item cursor-pointer"
                          onClick={() => {
                            setIsMenuOpen(false);
                            router.push(`/sports/${item.slug}`);
                          }}
                        >
                          <div className="menu-grid-icon-wrap">
                            <SportIconBadge
                              sport={item.sport}
                              size="lg"
                              className="h-11 w-11"
                            />
                          </div>
                          <span className="menu-grid-label">{item.label}</span>
                        </button>
                      ) : (
                        <button
                          key={item.key}
                          type="button"
                          className={cn(
                            "menu-grid-item",
                            item.href ? "cursor-pointer" : "cursor-default",
                          )}
                          onClick={() => {
                            if (!item.href) return;
                            setIsMenuOpen(false);
                            router.push(item.href);
                          }}
                        >
                          <div className="menu-grid-icon-wrap">
                            <MoreMenuIcon kind={item.icon} />
                          </div>
                          <span className="menu-grid-label">{item.label}</span>
                        </button>
                      ),
                    )}
              </div>
            </section>
          ))}
          {shouldShowEmptyState ? (
            <div className="mt-5 rounded-xl border border-[var(--border-dim)] bg-white/[0.03] px-4 py-3.5 text-center text-base leading-[1.5] text-[var(--text-dim)]">
              No menu items match &quot;{menuSearchQuery.trim()}&quot;.
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
