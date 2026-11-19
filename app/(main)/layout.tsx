import { AppBootstrap } from "@/components/layout/AppBootstrap";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-120 flex-col bg-[#F6F6F5]">
      <AppBootstrap />
      {children}
    </div>
  );
}
