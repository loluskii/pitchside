import { AppBootstrap } from "@/components/layout/AppBootstrap";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-120 flex-col bg-[var(--chalk)]">
      <AppBootstrap />
      {children}
    </div>
  );
}
