export function FeaturedMatchCardSkeleton() {
  return (
    <div className="featured-card featured-card-skeleton">
      <div className="fc-header fc-header-flat">
        <div className="featured-skeleton-header">
          <span className="bp-skeleton featured-skeleton-line short" />
          <span className="bp-skeleton featured-skeleton-line" />
        </div>
      </div>

      <div className="fc-body">
        <div className="fc-team">
          <span className="bp-skeleton featured-skeleton-logo" />
          <span className="bp-skeleton featured-skeleton-team" />
          <span className="bp-skeleton featured-skeleton-team short" />
        </div>

        <div className="fc-score">
          <span className="bp-skeleton featured-skeleton-score-line" />
          <span className="bp-skeleton featured-skeleton-score-line short" />
          <span className="bp-skeleton featured-skeleton-score" />
        </div>

        <div className="fc-team">
          <span className="bp-skeleton featured-skeleton-logo" />
          <span className="bp-skeleton featured-skeleton-team" />
          <span className="bp-skeleton featured-skeleton-team short" />
        </div>
      </div>

      <div className="fc-odds">
        <span className="bp-skeleton featured-skeleton-odd" />
        <span className="bp-skeleton featured-skeleton-odd" />
        <span className="bp-skeleton featured-skeleton-odd" />
      </div>
    </div>
  );
}
