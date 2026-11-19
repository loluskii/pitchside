export class CalculatedGroup {
  Grouping: number;
  Combinations: number;
  StakeForCombination: number;
  MinPercentageBonus: number;
  MaxPercentageBonus: number;
  MinWinForUnit: number;
  MaxWinForUnit: number;
  MinBonusForUnit: number;
  MaxBonusForUnit: number;

  constructor(
    grouping: number,
    combinations = 0,
    stakeForCombination = 0,
    minPercentageBonus = 0,
    maxPercentageBonus = 0,
    minWinForUnit = 0,
    maxWinForUnit = 0,
    minBonusForUnit = 0,
    maxBonusForUnit = 0,
  ) {
    this.Grouping = grouping;
    this.Combinations = combinations;
    this.StakeForCombination = stakeForCombination;
    this.MinPercentageBonus = minPercentageBonus;
    this.MaxPercentageBonus = maxPercentageBonus;
    this.MinWinForUnit = minWinForUnit;
    this.MaxWinForUnit = maxWinForUnit;
    this.MinBonusForUnit = minBonusForUnit;
    this.MaxBonusForUnit = maxBonusForUnit;
  }

  MinWin(): number {
    return this.MinWinForUnit * this.StakeForCombination;
  }

  NetStakeMinWin(): number {
    return this.MinWinForUnit * this.StakeForCombination;
  }

  MaxWin(): number {
    return this.MaxWinForUnit * this.StakeForCombination;
  }

  NetStakeMaxWin(): number {
    return this.MaxWinForUnit * this.StakeForCombination;
  }

  MinBonus(): number {
    return this.MinBonusForUnit * this.StakeForCombination;
  }

  MaxBonus(): number {
    return this.MaxBonusForUnit * this.StakeForCombination;
  }
}
