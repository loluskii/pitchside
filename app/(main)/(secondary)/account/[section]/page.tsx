import { notFound } from "next/navigation";
import { AccountRestrictionPageView } from "@/components/account/AccountRestrictionPageView";
import { PersonalDetailsPageView } from "@/components/account/PersonalDetailsPageView";

const SECTION_COPY = {
  "about": {
    title: "About Us",
    description:
      "Company background, operator information, and product overview for the Pitchside account experience.",
  },
  "customer-support": {
    title: "Customer Support",
    description:
      "Support channels, response expectations, and escalation guidance for account and betting issues.",
  },
  "download-app": {
    title: "Download App",
    description:
      "Native app distribution, install guidance, and release links can be connected here when the mobile package is ready.",
  },
  "how-to-play": {
    title: "How to Play",
    description:
      "Product rules, stake flow guidance, and sportsbook help content can be published here for users who need onboarding.",
  },
  "personal-details": {
    title: "Personal Details",
    description:
      "Profile editing, contact details, and identity-related account fields can be managed here once the full form is connected.",
  },
  "responsible-gaming": {
    title: "Responsible Gaming",
    description:
      "Safer betting messaging, limits, and responsible gaming controls can be exposed here for account holders.",
  },
  "self-exclusion": {
    title: "Self Exclusion",
    description: "",
  },
  "deactivation": {
    title: "Deactivation",
    description: "",
  },
  "rewards": {
    title: "Rewards",
    description:
      "Loyalty status, points, and reward redemption can be connected here when the rewards backend is available.",
  },
  "refer-and-earn": {
    title: "Refer & Earn",
    description: "",
  },
  "referrals": {
    title: "Referral",
    description: "",
  },
  "terms": {
    title: "Terms & Conditions",
    description:
      "Terms, operator policies, and legal documents can be published here for account and sportsbook usage.",
  },
  "wishlist": {
    title: "Wishlist",
    description:
      "Saved account items and product shortcuts can be surfaced here once the wishlist flow is connected.",
  },
} as const;

type Props = {
  params: Promise<{ section: string }>;
};

export default async function AccountSectionPage({ params }: Props) {
  const { section } = await params;

  if (section === "personal-details") {
    return <PersonalDetailsPageView />;
  }

  if (section === "self-exclusion") {
    return <AccountRestrictionPageView mode="self-exclusion" />;
  }

  if (section === "deactivation") {
    return <AccountRestrictionPageView mode="deactivation" />;
  }

  const content = SECTION_COPY[section as keyof typeof SECTION_COPY];

  if (!content) {
    notFound();
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-8">
      <section className="rounded-2xl border border-white/6 bg-surface-elevated p-5">
        <h1 className="text-4xl font-black text-white">{content.title}</h1>
      </section>
    </div>
  );
}
