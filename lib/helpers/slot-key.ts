export class SlotKey {
  MatchId: number;
  Index: number;

  constructor(matchId: number, index: number) {
    this.MatchId = matchId;
    this.Index = index;
  }

  getKey(): string {
    return `${this.MatchId}_${this.Index}`;
  }
}
