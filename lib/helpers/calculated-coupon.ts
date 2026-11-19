import { CalculatedGroup } from "./calculated-group";
import { arrSum } from "./array-utils";

export class CalculatedCoupon {
  Groups: CalculatedGroup[] = [];

  getMaxAllowedStake(
    lossThreshold: number,
    stakeThreshold: number,
    _maxGrouping: number,
    selectedGroupings: number[],
    totalCouponCombinations: number,
  ): number {
    let totalCurrentLossForUnit =
      this.getTotalWinForUnit(selectedGroupings) +
      this.getTotalBonusForUnit(selectedGroupings);
    if (totalCurrentLossForUnit === 0) totalCurrentLossForUnit = 1;
    let newTotalStake = (lossThreshold / totalCurrentLossForUnit) * totalCouponCombinations;
    if (stakeThreshold > 0) newTotalStake = Math.min(newTotalStake, stakeThreshold);
    return Math.floor(newTotalStake * 100) / 100;
  }

  getTotalWinForUnit(selectedGroupings: number[]): number {
    if (!selectedGroupings.length) return 0;
    return arrSum(
      this.Groups.filter((g) => selectedGroupings.includes(g.Grouping)),
      "MaxWinForUnit",
    );
  }

  getTotalBonusForUnit(selectedGroupings: number[]): number {
    if (!selectedGroupings.length) return 0;
    return arrSum(
      this.Groups.filter((g) => selectedGroupings.includes(g.Grouping)),
      "MaxBonusForUnit",
    );
  }
}
