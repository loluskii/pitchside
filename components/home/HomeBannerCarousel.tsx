"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useBanners } from "@/lib/query/hooks/useBanners";

type HomeBannerItem = {
  caption?: string;
  image?: string;
  link?: string;
  name?: string;
  title?: string;
};

type BannerResponse = {
  data?: HomeBannerItem[] | Record<string, HomeBannerItem>;
};

const STORY_DURATION_MS = 5000;

function getHomeBanners(payload: unknown) {
  const data = (payload as BannerResponse | undefined)?.data;
  const list = Array.isArray(data) ? data : data ? Object.values(data) : [];
  return list.filter((banner) => typeof banner.image === "string" && banner.image.trim().length > 0);
}

function getBannerTitle(banner: HomeBannerItem, index: number) {
  return banner.title || banner.name || banner.caption || `Promo ${index + 1}`;
}

function openBannerLink(link?: string) {
  if (!link) return;
  window.location.href = link.startsWith("http://") || link.startsWith("https://") || link.startsWith("/")
    ? link
    : `/${link}`;
}

export function HomeBannerCarousel() {
  const { data, isLoading } = useBanners();
  const banners = getHomeBanners(data);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const activeBanner = banners[activeIndex] ?? banners[0];

  useEffect(() => {
    if (!isStoryOpen) return undefined;
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [isStoryOpen]);

  useEffect(() => {
    if (!isStoryOpen || !banners.length) return undefined;

    const timerId = window.setTimeout(() => {
      if (activeIndex >= banners.length - 1) {
        setIsStoryOpen(false);
        return;
      }
      setActiveIndex((current) => current + 1);
    }, STORY_DURATION_MS);

    return () => window.clearTimeout(timerId);
  }, [activeIndex, banners.length, isStoryOpen]);

  if (isLoading) {
    return (
      <section className="home-status-banners" aria-label="Loading promotions">
        <div className="home-status-rail no-scrollbar">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="home-status-card animate-pulse bg-white/[0.06]" />
          ))}
        </div>
      </section>
    );
  }

  if (!banners.length) return null;

  return (
    <>
      <section className="home-status-banners" aria-label="Promotions">
        <div className="home-status-rail no-scrollbar">
          {banners.map((banner, index) => (
            <button
              key={`${banner.image}-${index}`}
              type="button"
              className="home-status-card"
              onClick={() => {
                setActiveIndex(index);
                setIsStoryOpen(true);
              }}
            >
              <Image
                src={banner.image as string}
                alt={getBannerTitle(banner, index)}
                fill
                sizes="120px"
                className="object-cover"
                priority={index === 0}
                unoptimized
              />
              <span>{getBannerTitle(banner, index)}</span>
            </button>
          ))}
        </div>
      </section>

      {isStoryOpen && activeBanner ? (
        <div className="home-story-viewer" role="dialog" aria-modal="true" aria-label="Promotion">
          <div className="home-story-progress">
            {banners.map((banner, index) => (
              <span key={`${banner.image}-progress-${index}`}>
                <i
                  className={
                    index < activeIndex
                      ? "is-complete"
                      : index === activeIndex
                        ? "is-active"
                        : ""
                  }
                />
              </span>
            ))}
          </div>

          <button
            type="button"
            className="home-story-close"
            onClick={() => setIsStoryOpen(false)}
            aria-label="Close promotion"
          >
            <X className="app-icon" />
          </button>

          <button
            type="button"
            className="home-story-nav is-prev"
            aria-label="Previous promotion"
            onClick={() => setActiveIndex((current) => Math.max(0, current - 1))}
          />
          <button
            type="button"
            className="home-story-nav is-next"
            aria-label="Next promotion"
            onClick={() => {
              if (activeIndex >= banners.length - 1) {
                setIsStoryOpen(false);
                return;
              }
              setActiveIndex((current) => current + 1);
            }}
          />

          <div className="home-story-content">
            <Image
              src={activeBanner.image as string}
              alt={getBannerTitle(activeBanner, activeIndex)}
              fill
              sizes="100vw"
              className="object-contain"
              priority
              unoptimized
            />
          </div>

          <div className="home-story-caption">
            <span>{getBannerTitle(activeBanner, activeIndex)}</span>
            {activeBanner.link ? (
              <button type="button" onClick={() => openBannerLink(activeBanner.link)}>
                Open
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
