type FixtureSkeletonProps = {
  variant?: "prematch" | "live";
};

export function FixtureSkeleton({ variant = "prematch" }: FixtureSkeletonProps) {
  const isLive = variant === "live";

  return (
    <div className={isLive ? "fc-match-card fixture-skeleton" : "live-match-row fixture-skeleton"}>
      <div className="lm-header">
        <span className="ps-skeleton fixture-skeleton-time" />
        {isLive ? <span className="ps-skeleton fixture-skeleton-badge" /> : null}
        <span className="ps-skeleton fixture-skeleton-league" />
      </div>

      <div className="lm-body">
        <div className="lm-teams">
          <div className="lm-team-row">
            <span className="ps-skeleton fixture-skeleton-team" />
            {isLive ? <span className="ps-skeleton fixture-skeleton-score" /> : null}
          </div>
          <div className="lm-team-row">
            <span className="ps-skeleton fixture-skeleton-team short" />
            {isLive ? <span className="ps-skeleton fixture-skeleton-score" /> : null}
          </div>
        </div>

        <div className="lm-odds fixture-skeleton-odds">
          <span className="ps-skeleton fixture-skeleton-odd" />
          <span className="ps-skeleton fixture-skeleton-odd" />
          <span className="ps-skeleton fixture-skeleton-odd" />
        </div>
      </div>

      <div className="lm-footer">
        <div className="lm-footer-left">
          <span className="ps-skeleton fixture-skeleton-icon" />
          <span className="ps-skeleton fixture-skeleton-meta" />
        </div>
        <div className="lm-footer-right">
          <span className="ps-skeleton fixture-skeleton-icon" />
          <span className="ps-skeleton fixture-skeleton-icon" />
        </div>
      </div>
    </div>
  );
}
