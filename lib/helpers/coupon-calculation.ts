import { SlotKey } from "./slot-key";
import { CalculatedGroup } from "./calculated-group";
import { CalculatedCoupon } from "./calculated-coupon";
import { Combination, FastCombination } from "./combination";
import {
  arrSum,
  arrMin,
  arrMax,
  arrUnique,
  arrSortAsc,
  arrSortDesc,
  arrRemove,
} from "./array-utils";

const fastCombination = new FastCombination();

export interface BetSelection {
  matchId: number | string;
  odds: number;
  fixed?: boolean;
  Fixed?: boolean;
}

export interface BetCouponGrouping {
  Grouping: number;
  Combinations: number;
  Stake: number;
  MaxBonus?: number;
  maxWin?: number;
  MaxWinNet?: number;
  NetStakeMaxWin?: number;
  MinBonus?: number;
  minWin?: number;
  MinWinNet?: number;
  NetStakeMinWin?: number;
  MinPercentageBonus?: number;
  MaxPercentageBonus?: number;
  NetStake?: number;
}

export interface BetCoupon {
  selections: BetSelection[];
  Groupings: BetCouponGrouping[];
  stake?: number;
  totalStake?: number;
  BetCouponGlobalVariable?: { MaxCouponCombinations: number };
  Odds?: unknown[];
  PossibleMissingGroupings?: BetCouponGrouping[];
  TotalCombinations?: number;
  minWin?: number;
  NetStakeMinWin?: number;
  maxWin?: number;
  NetStakeMaxWin?: number;
  minBonus?: number;
  maxBonus?: number;
  MinPercentageBonus?: number;
  MaxPercentageBonus?: number;
  minOdds?: number;
  maxOdds?: number;
}

export interface BonusItem {
  ticket_length: number;
  bonus: number;
}

function getEnvNumber(key: string, fallback = 1_000_000): number {
  const val = Number(process.env[key]);
  return Number.isFinite(val) && val > 0 ? val : fallback;
}

export default class CouponCalculation {
  getSlotKeyFromString(key: string): SlotKey {
    const parts = key.split("_");
    return new SlotKey(parseInt(parts[0]), parseInt(parts[1]));
  }

  getOddsForSlotKeyMap(coupon: BetCoupon): Record<string, BetSelection[]> {
    const map: Record<string, BetSelection[]> = {};

    for (const odd of coupon.selections) {
      const matchingKeys: SlotKey[] = [];
      for (const key of Object.keys(map)) {
        const sk = this.getSlotKeyFromString(key);
        if (sk.MatchId === Number(odd.matchId) && sk.Index === 0) {
          matchingKeys.push(sk);
        } else if (sk.MatchId === Number(odd.matchId) && sk.Index > 0) {
          throw new Error("Mixed CompatibilityLevel on odds");
        }
      }
      if (matchingKeys.length > 1) throw new Error("Wrong oddsForSlotKeyMap construction");
      if (matchingKeys.length === 0) {
        const sk = new SlotKey(Number(odd.matchId), 0);
        map[sk.getKey()] = [odd];
      } else {
        map[matchingKeys[0].getKey()].push(odd);
      }
    }
    return map;
  }

  calcCombinations(coupon: BetCoupon): CalculatedCoupon {
    const maxCombinationsByGrouping = getEnvNumber("NEXT_PUBLIC_MAX_COMBINATIONS_BY_GROUPING");
    const maxCouponCombinations = getEnvNumber("NEXT_PUBLIC_MAX_COUPON_COMBINATIONS");
    const maxCombinationForCoupon = Math.min(maxCombinationsByGrouping, maxCouponCombinations);

    if (
      coupon.selections.length > 0 &&
      coupon.selections.filter((o) => o.fixed).length === coupon.selections.length
    ) {
      coupon.selections[0].fixed = false;
    }

    const calculatedCouponGroups: (CalculatedGroup | null)[] = [];
    const oddsForSlotKeyMap = this.getOddsForSlotKeyMap(coupon);
    const bankers: BetSelection[] = [];
    const nonBankers: BetSelection[][] = [];
    let slotKeyCount = 0;
    let integrale = false;
    const numSelectionsPerEvent: number[] = [];

    for (const key of Object.keys(oddsForSlotKeyMap)) {
      const currentSK = oddsForSlotKeyMap[key];
      if (currentSK[0].fixed) {
        bankers.push(currentSK[0]);
      } else {
        nonBankers.push(currentSK);
        numSelectionsPerEvent.push(currentSK.length);
      }
      slotKeyCount += 1;
      if (currentSK.length > 1) integrale = true;
    }

    const firstGroup = bankers.length > 0 ? bankers.length : 1;

    for (let groupIndex = 0; groupIndex <= slotKeyCount; groupIndex++) {
      let group: CalculatedGroup | null = null;
      if (groupIndex > 0) {
        group = new CalculatedGroup(groupIndex);
        if (groupIndex < firstGroup) group.Combinations = 0;
      }
      calculatedCouponGroups.push(group);
    }

    if (bankers.length > 0) {
      calculatedCouponGroups[bankers.length]!.Combinations = 1;
    }

    if (!integrale) {
      for (let k = nonBankers.length; k > 0; k--) {
        const n = nonBankers.length;
        const nc = new Combination().choose(n, k);
        const group = calculatedCouponGroups[k + bankers.length];
        if (group) {
          group.Combinations = maxCombinationForCoupon > nc ? nc : -1;
        }
      }
    } else {
      for (let k = nonBankers.length; k > 0; k--) {
        const count = this.calcCombinationsForCrossCombinationsBetGroup(
          k,
          numSelectionsPerEvent,
          maxCombinationForCoupon,
        );
        const group = calculatedCouponGroups[k + bankers.length];
        if (group) group.Combinations = count;
      }
    }

    const maxPossibleGroupings = this.MaxGrouping(coupon.selections);
    for (let i = calculatedCouponGroups.length - 1; i >= 0; i--) {
      const g = calculatedCouponGroups[i];
      if (g == null || g.Grouping > maxPossibleGroupings) {
        calculatedCouponGroups.splice(i, 1);
      }
    }

    const calculatedCoupon = new CalculatedCoupon();
    calculatedCouponGroups.forEach((g) => {
      if (g) calculatedCoupon.Groups.push(g);
    });
    return calculatedCoupon;
  }

  calcCombinationsForCrossCombinationsBetGroup(
    k: number,
    numSelectionsPerEvent: number[],
    maxCombinationForCoupon: number,
  ): number {
    const chosen = fastCombination.chooseFromSets(numSelectionsPerEvent, k);
    return chosen > maxCombinationForCoupon ? -1 : chosen;
  }

  calcPotentialWins(coupon: BetCoupon, bonusList: BonusItem[], MinBonusOdd: number): CalculatedCoupon {
    const maxCombinationsByGrouping = getEnvNumber("NEXT_PUBLIC_MAX_COMBINATIONS_BY_GROUPING");
    const maxCouponCombinations = getEnvNumber("NEXT_PUBLIC_MAX_COUPON_COMBINATIONS");
    const maxCombinationForCoupon = Math.min(maxCombinationsByGrouping, maxCouponCombinations);

    const oddsForSlotKeyMap = this.getOddsForSlotKeyMap(coupon);
    const bankers: BetSelection[] = [];
    const nonBankers: BetSelection[][] = [];

    for (const key of Object.keys(oddsForSlotKeyMap)) {
      const currentSK = oddsForSlotKeyMap[key];
      if (currentSK[0].Fixed) bankers.push(currentSK[0]);
      else nonBankers.push(currentSK);
    }

    const maxCombination: BetSelection[] = [];
    const minCombination: BetSelection[] = [];
    for (let i = 0; i < nonBankers.length; i++) {
      maxCombination[i] = arrSortDesc(nonBankers[i], "odds")[0];
      minCombination[i] = arrSortAsc(nonBankers[i], "odds")[0];
    }

    const calculatedCouponGroups: CalculatedGroup[] = [];
    for (const betCouponGroup of coupon.Groupings) {
      if (betCouponGroup.Combinations > 0) {
        const calculatedGroup = new CalculatedGroup(betCouponGroup.Grouping);
        calculatedGroup.Combinations = betCouponGroup.Combinations;
        calculatedGroup.StakeForCombination = betCouponGroup.Stake;
        calculatedCouponGroups.push(calculatedGroup);
      }
    }

    if (coupon.Groupings.length === 0 && bankers.length + nonBankers.length === 1) {
      const combinations = nonBankers.length > 0 ? nonBankers[0].length : 1;
      const calculatedGroup = new CalculatedGroup(1);
      calculatedGroup.Combinations = combinations;
      calculatedGroup.StakeForCombination = (coupon.stake || 0) / combinations;
      calculatedCouponGroups.push(calculatedGroup);
    }

    let bankersValidEventForBonus = 0;
    let bankersTotalOdds = 1.0;
    for (const b of bankers) {
      bankersTotalOdds *= b.odds;
      bankersTotalOdds = Number(bankersTotalOdds.toFixed(10));
      if (b.odds >= MinBonusOdd) bankersValidEventForBonus++;
    }

    for (const calculatedGroup of calculatedCouponGroups) {
      const n = nonBankers.length;
      const k = calculatedGroup.Grouping - bankers.length;
      const nc = new Combination().choose(n, k);
      let maxWinForUnit = 0.0;
      let maxBonusForUnit = 0.0;

      if (maxCombinationForCoupon > nc) {
        let combination: Combination | null = new Combination(n, k);
        for (let j = 0; j < nc && combination; j++) {
          let validEventsForBonus = bankersValidEventForBonus;
          let winForUnit = bankersTotalOdds;
          const combOdds = combination.applyTo(maxCombination);
          for (const odd of combOdds) {
            winForUnit *= odd.odds;
            winForUnit = Number(winForUnit.toFixed(10));
            if (odd.odds >= MinBonusOdd) validEventsForBonus++;
          }
          const percBonus = this.bonusPercentageFromNumberOfEvents(bonusList, validEventsForBonus);
          maxWinForUnit += winForUnit;
          maxBonusForUnit += winForUnit * percBonus;
          combination = combination.successor();
          calculatedGroup.MaxPercentageBonus = percBonus;
        }
      }

      calculatedGroup.MaxWinForUnit = maxWinForUnit;
      calculatedGroup.MaxBonusForUnit = maxBonusForUnit;

      let minWinForUnit = bankersTotalOdds;
      let minEventForBonus = bankersValidEventForBonus;
      const sortedMinComb = arrSortAsc(minCombination, "odds");
      const subSortedMinComb = sortedMinComb.slice(0, k);

      for (const odd of subSortedMinComb) {
        minWinForUnit *= odd.odds;
        minWinForUnit = Number(minWinForUnit.toFixed(10));
        if (odd.odds >= MinBonusOdd) minEventForBonus++;
      }

      const minPercBonus = this.bonusPercentageFromNumberOfEvents(bonusList, minEventForBonus);
      calculatedGroup.MinWinForUnit = minWinForUnit;
      calculatedGroup.MinBonusForUnit = minWinForUnit * minPercBonus;
      calculatedGroup.MinPercentageBonus = minPercBonus;
    }

    const calculatedCoupon = new CalculatedCoupon();
    calculatedCouponGroups.forEach((g) => calculatedCoupon.Groups.push(g));
    return calculatedCoupon;
  }

  bonusPercentageFromNumberOfEvents(bonusList: BonusItem[], numberOfEvents: number): number {
    try {
      if (!bonusList.length) return 0.0;
      if (numberOfEvents < arrMin(bonusList, "ticket_length")) return 0.0;
      if (numberOfEvents > arrMax(bonusList, "ticket_length")) return 0.0;
      const filtered = bonusList.find((b) => b.ticket_length == numberOfEvents);
      if (filtered) return filtered.bonus / 100.0;
      return 0.0;
    } catch {
      return 0.0;
    }
  }

  updateFromCalculatedCoupon(
    coupon: BetCoupon,
    calculatedCoupon: CalculatedCoupon,
    _globalVar: unknown,
    bonusList: BonusItem[],
  ): BetCoupon {
    const betCoupon = { ...coupon, Groupings: [...coupon.Groupings] };
    const groupings: BetCouponGrouping[] = [];

    if (betCoupon.Groupings.length > 0) {
      for (const calculatedGroup of calculatedCoupon.Groups) {
        const betCouponGroup = betCoupon.Groupings.find(
          (g) => g.Grouping == calculatedGroup.Grouping,
        );
        if (betCouponGroup) {
          groupings.push({
            ...betCouponGroup,
            Combinations: calculatedGroup.Combinations,
            MaxBonus: calculatedGroup.MaxBonus(),
            maxWin: calculatedGroup.MaxWin(),
            MaxWinNet: calculatedGroup.NetStakeMaxWin(),
            NetStakeMaxWin: calculatedGroup.NetStakeMaxWin(),
            MinBonus: calculatedGroup.MinBonus(),
            minWin: calculatedGroup.MinWin(),
            MinWinNet: calculatedGroup.NetStakeMinWin(),
            NetStakeMinWin: calculatedGroup.NetStakeMinWin(),
            MinPercentageBonus: calculatedGroup.MinPercentageBonus,
            MaxPercentageBonus: calculatedGroup.MaxPercentageBonus,
            NetStake: calculatedGroup.StakeForCombination,
          });
        }
      }
    }

    betCoupon.Groupings = groupings;
    betCoupon.TotalCombinations = this.getTotalCombinations(betCoupon);
    betCoupon.minWin = this.getMinWin(betCoupon);
    betCoupon.NetStakeMinWin = this.getNetStakeMinWin(betCoupon);
    betCoupon.maxWin = this.getMaxWin(betCoupon);
    betCoupon.NetStakeMaxWin = this.getNetStakeMaxWin(betCoupon);
    betCoupon.minBonus = this.getMinBonus(betCoupon, bonusList);
    betCoupon.maxBonus = this.getMaxBonus(betCoupon);
    betCoupon.maxWin = (betCoupon.maxBonus || 0) + (betCoupon.maxWin || 0);
    betCoupon.minWin = this.getMinBonus(betCoupon, bonusList) + (betCoupon.minWin || 0);
    betCoupon.MinPercentageBonus = this.getMinPercentageBonus(betCoupon);
    betCoupon.MaxPercentageBonus = this.getMaxPercentageBonus(betCoupon);
    betCoupon.minOdds = this.getMinOdd(betCoupon);
    betCoupon.maxOdds = this.getMaxOdd(betCoupon);
    return betCoupon;
  }

  MaxGrouping(selections: BetSelection[]): number {
    const incompatibleMarketsEventCount = arrUnique(selections, "matchId").length;
    return incompatibleMarketsEventCount;
  }

  getTotalCombinations(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0 ? arrSum(betCoupon.Groupings, "Combinations") : 0;
  }

  getMinWin(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0 ? arrMin(betCoupon.Groupings, "minWin" as keyof BetCouponGrouping) : 0;
  }

  getNetStakeMinWin(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0
      ? arrMin(betCoupon.Groupings, "MinWinNet" as keyof BetCouponGrouping)
      : 0;
  }

  getMinOdd(betCoupon: BetCoupon): number {
    if (!betCoupon.Groupings?.length) return 0;
    const withStake = betCoupon.Groupings.filter((g) => g.Stake > 0);
    if (!withStake.length) return 0;
    const minWinGroup = arrSortAsc(withStake, "minWin" as keyof BetCouponGrouping)[0];
    if (!minWinGroup) return 0;
    return parseFloat(((minWinGroup.minWin || 0) / minWinGroup.Stake).toFixed(2));
  }

  getMaxOdd(betCoupon: BetCoupon): number {
    if (!betCoupon.Groupings?.length) return 0;
    const withStake = betCoupon.Groupings.filter((g) => g.Stake > 0);
    if (!withStake.length) return 0;
    const maxOddSum = withStake.reduce((acc, g) => acc + (g.maxWin || 0) / g.Stake, 0);
    return parseFloat(maxOddSum.toFixed(2));
  }

  getMaxWin(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0 ? arrSum(betCoupon.Groupings, "maxWin" as keyof BetCouponGrouping) : 0;
  }

  getNetStakeMaxWin(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0
      ? arrSum(betCoupon.Groupings, "MaxWinNet" as keyof BetCouponGrouping)
      : 0;
  }

  getMinBonus(betCoupon: BetCoupon, bonusList: BonusItem[]): number {
    const minGroup = this.getMinGroup(betCoupon);
    const minBonus = this.getMinBonusLength(bonusList);
    return minGroup >= minBonus ? betCoupon.minBonus || 0 : 0;
  }

  getMaxBonus(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0
      ? arrSum(betCoupon.Groupings, "MaxBonus" as keyof BetCouponGrouping)
      : 0;
  }

  getMinGroup(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0 ? arrMin(betCoupon.Groupings, "Grouping") : 0;
  }

  getMinBonusLength(bonusList: BonusItem[]): number {
    return bonusList.length > 0 ? arrMin(bonusList, "ticket_length") : 0;
  }

  getMinPercentageBonus(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0
      ? arrMin(betCoupon.Groupings, "MinPercentageBonus" as keyof BetCouponGrouping)
      : 0;
  }

  getMaxPercentageBonus(betCoupon: BetCoupon): number {
    return betCoupon.Groupings.length > 0
      ? arrMax(betCoupon.Groupings, "MaxPercentageBonus" as keyof BetCouponGrouping)
      : 0;
  }

  truncateLastRoundedDecimalValue(num: number): number {
    const str = num.toString();
    const pointerIdx = str.indexOf(".");
    if (pointerIdx === -1) return num;
    const precisionLength = str.substring(pointerIdx + 1).length;
    const re = new RegExp(`^-?\\d+(?:.\\d{0,${precisionLength - 1}})?`);
    const match = str.match(re);
    return match ? parseFloat(match[0]) : num;
  }

  setPossibleCouponStake(betCoupon: BetCoupon): BetCoupon {
    const minGroupingsBetStake = getEnvNumber("NEXT_PUBLIC_MIN_GROUPINGS_BET_STAKE", 0);
    const minBetStake = getEnvNumber("NEXT_PUBLIC_MIN_BET_STAKE", 0);
    const stakeInnerMod0Combination = getEnvNumber("NEXT_PUBLIC_STAKE_INNER_MOD0_COMBINATION", 0);

    for (let d = 0; d < betCoupon.Groupings.length; d++) {
      const grpItem = betCoupon.Groupings[d];
      if (!grpItem.Stake) grpItem.Stake = 0;

      let minInnerStakeAllowed = minGroupingsBetStake;
      if (betCoupon.stake !== 0 && betCoupon.stake) {
        let grpStakeRatio = grpItem.Stake / betCoupon.stake;
        grpStakeRatio = this.truncateLastRoundedDecimalValue(grpStakeRatio);
        minInnerStakeAllowed = Math.max(minGroupingsBetStake, minBetStake * grpStakeRatio);
      }

      if (stakeInnerMod0Combination != null && stakeInnerMod0Combination !== 0) {
        const modValueItem = grpItem.Stake % stakeInnerMod0Combination;
        if (modValueItem !== 0) {
          const div = grpItem.Stake / stakeInnerMod0Combination;
          let rounded = Math.round(div);
          if (rounded === 0) rounded = 1;
          grpItem.Stake = rounded * stakeInnerMod0Combination;
        }
        if (grpItem.Stake < minInnerStakeAllowed) {
          const divMin = minInnerStakeAllowed / stakeInnerMod0Combination;
          let roundedMin = Math.ceil(divMin);
          if (roundedMin === 0) roundedMin = 1;
          grpItem.Stake = roundedMin * stakeInnerMod0Combination;
        }
      }
      betCoupon.Groupings[d] = grpItem;
    }
    return betCoupon;
  }

  removeGroup(betCoupon: BetCoupon, betCouponGroup: BetCouponGrouping): boolean {
    return arrRemove(betCoupon.Groupings, "Grouping", betCouponGroup.Grouping);
  }

  setPossibleGroupings(betCoupon: BetCoupon, calculatedCoupon: CalculatedCoupon): BetCoupon {
    let possibleMissingGrouping: BetCouponGrouping[] = [];

    for (const calculatedGroup of calculatedCoupon.Groups) {
      const combinations = calculatedGroup.Combinations;
      const betCouponGroups = betCoupon.Groupings.filter(
        (g) => g.Grouping == calculatedGroup.Grouping,
      );
      if (betCouponGroups.length > 1) throw new Error("Multiple Groupings defined!");

      if (betCouponGroups.length === 0) {
        possibleMissingGrouping.push({
          Grouping: calculatedGroup.Grouping,
          Combinations: calculatedGroup.Combinations,
          Stake: 0,
        });
      }

      const maxCombinations = betCoupon.BetCouponGlobalVariable?.MaxCouponCombinations ?? Infinity;
      if (combinations <= 0 || combinations > maxCombinations) {
        if (betCouponGroups.length > 0) this.removeGroup(betCoupon, betCouponGroups[0]);
      } else {
        if (betCouponGroups.length > 0) betCouponGroups[0].Combinations = combinations;
      }
    }

    if (betCoupon.Groupings.length === 0 && possibleMissingGrouping.length >= 1) {
      const oddsCount = betCoupon.Odds?.length ?? 0;
      const validGroupings = possibleMissingGrouping.filter(
        (g) => g.Grouping > 0 && g.Grouping !== 1 && g.Grouping !== oddsCount,
      );
      const lastGrouping = validGroupings.pop();
      if (lastGrouping) {
        betCoupon.Groupings.push({
          Combinations: lastGrouping.Combinations,
          Grouping: lastGrouping.Grouping,
          Stake: 0,
        });
        possibleMissingGrouping = possibleMissingGrouping.filter(
          (g) => g.Grouping !== lastGrouping.Grouping || g.Combinations !== lastGrouping.Combinations,
        );
      }
    }

    betCoupon.PossibleMissingGroupings = possibleMissingGrouping;
    return betCoupon;
  }
}
