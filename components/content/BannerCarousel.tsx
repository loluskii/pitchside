"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useBanners } from "@/lib/query/hooks/useBanners";

type BannerItem = {
  bannerType?: string;
  caption?: string;
  content?: string;
  image?: string;
  link?: string;
  name?: string;
  title?: string;
  type?: string;
};

type BannerResponse = {
  data?: BannerItem[] | Record<string, BannerItem>;
};

function getBannerList(payload: unknown, type?: string) {
  const data = (payload as BannerResponse | undefined)?.data;
  const list = Array.isArray(data) ? data : data ? Object.values(data) : [];

  return list.filter((banner) => {
    const bannerType = banner.bannerType ?? banner.type;
    return (
      (!type || bannerType === type) &&
      typeof banner.image === "string" &&
      banner.image.trim().length > 0
    );
  });
}

function getBannerTitle(banner: BannerItem, index: number) {
  return banner.title || banner.name || banner.caption || `Promo ${index + 1}`;
}

function getBannerSubtitle(banner: BannerItem) {
  return banner.content || banner.caption || "";
}

function getBannerHref(value?: string) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

export function BannerCarousel({
  ariaLabel = "Promotions",
  className,
  showSkeleton = false,
  skeletonClassName,
  slideClassName,
  type,
}: {
  ariaLabel?: string;
  className?: string;
  showSkeleton?: boolean;
  skeletonClassName?: string;
  slideClassName?: string;
  type?: string;
}) {
  const { data, isLoading } = useBanners();
  const banners = getBannerList(data, type);
  const carouselBanners =
    type === "casino" && banners.length === 1
      ? [banners[0], banners[0], banners[0]]
      : banners;
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleIndex = carouselBanners.length ? activeIndex % carouselBanners.length : 0;
  const slideWidth = carouselBanners.length ? 100 / carouselBanners.length : 100;

  useEffect(() => {
    if (carouselBanners.length < 2) return undefined;

    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % carouselBanners.length);
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [carouselBanners.length, visibleIndex]);

  if (isLoading && showSkeleton) {
    return (
      <section className={cn("casino-banner-slider mx-1", className)} aria-label={ariaLabel}>
        <div
          className={cn(
            "h-full w-full animate-pulse rounded-xl bg-white/[0.05]",
            skeletonClassName,
          )}
        />
      </section>
    );
  }

  if (!carouselBanners.length) return null;

  return (
    <section
      className={cn(
        "casino-banner-slider relative mx-1 overflow-hidden rounded-xl bg-[#F2F2F0]",
        className,
      )}
      aria-label={ariaLabel}
    >
      <div
        className="casino-banner-track flex h-full transition-transform duration-500 ease-in-out"
        style={{
          width: `${carouselBanners.length * 100}%`,
          transform: `translateX(-${visibleIndex * slideWidth}%)`,
        }}
      >
        {carouselBanners.map((banner, index) => {
          const title = getBannerTitle(banner, index);
          const subtitle = getBannerSubtitle(banner);
          const href = getBannerHref(banner.link);
          const image = banner.image as string;

          return (
            <div
              key={`${image}-${index}`}
              className={cn("casino-banner-slide relative h-full overflow-hidden", slideClassName)}
              style={{
                width: `${slideWidth}%`,
                background: `url(${JSON.stringify(image)}) center/cover no-repeat`,
              }}
            >
              <span className="casino-banner-overlay absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(243, 243, 241, 0.9)_0%,rgba(243, 243, 241, 0.4)_50%,rgba(243, 243, 241, 0.1)_100%)]" />
              <span className="casino-banner-copy absolute z-[2] block">
                <span className="casino-banner-title block whitespace-pre-line text-left font-black uppercase text-white">
                  {title}
                </span>
                {subtitle ? (
                  <span className="casino-banner-subtitle block font-bold leading-tight text-[var(--primary-orange)] [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]">
                    {subtitle}
                  </span>
                ) : null}
                {href ? (
                  <a
                    className="casino-banner-cta inline-flex rounded-full bg-[var(--lime)] font-bold text-white no-underline shadow-[0_4px_12px_rgba(0, 0, 0, 0.135)]"
                    href={href}
                  >
                    PLAY
                  </a>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>

      {carouselBanners.length > 1 ? (
        <div
          className="casino-banner-dots absolute bottom-3 left-0 z-[3] flex w-full justify-center gap-1.5"
          aria-hidden="true"
        >
          {carouselBanners.map((banner, index) => (
            <button
              key={`${banner.image}-dot-${index}`}
              type="button"
              className={cn("casino-banner-dot", index === visibleIndex && "is-active")}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show ${getBannerTitle(banner, index)}`}
              aria-current={index === visibleIndex ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
