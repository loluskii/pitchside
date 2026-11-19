import { PitchsideLogo } from "@/components/brand/Logo";

export function AppLoadingScreen() {
  return (
    <div className="app-loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-content">
        <PitchsideLogo size={34} />
        <div className="loading-bar-container">
          <div className="loading-bar-progress" />
        </div>
      </div>
    </div>
  );
}
