"use client";

/**
 * Real-time hook for the live feed (odds, scores, status, bet stops).
 * Subscribes to live match topics and provides:
 *   - subscribe(topic) / unsubscribe(topic)
 *   - onOddsChange callback
 *   - onBetStop callback
 *   - onMatchStatus callback
 *   - onScoreUpdate callback
 *
 * Topic conventions:
 *   sports/{sportId}/match/{matchId}/markets       → odds updates
 *   sports/{sportId}/match/{matchId}/bet_stop      → market suspension
 *   sports/{sportId}/match/{matchId}/match_status  → timer / status updates
 *   sports/{sportId}/match/{matchId}/scores        → score updates
 */

import { useCallback, useEffect, useRef } from "react";
import type { RawPeriodScore, RawScorePair } from "@/lib/utils/normalize";
import { subscribeMqttTopic } from "@/lib/services/mqttService";

type MqttMarketOutcome = {
  id?: string | number;
  outcome_id?: string | number;
  outcomeID?: string | number;
  outcome_name?: string;
  outcomeName?: string;
  alias?: string;
  displayName?: string;
  odds?: string | number;
  active?: number | boolean;
};

type MqttMarket = {
  id?: string | number;
  market_id?: string | number;
  marketID?: string | number;
  market_name?: string;
  marketName?: string;
  status_name?: string;
  statusName?: string;
  specifier?: string;
  specifiers?: string;
  outcomes?: MqttMarketOutcome[];
};

export interface OddsChangePayload {
  event_id?: string | number;
  match_id?: string | number;
  event_time?: string;
  match_status?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  market_id?: string | number;
  marketID?: string | number;
  market_name?: string;
  marketName?: string;
  status_name?: string;
  statusName?: string;
  specifier?: string;
  specifiers?: string;
  sport_event_status?: RawScorePair & {
    event_time?: string;
    match_status?: string;
    game_score?: RawScorePair;
    period_scores?: RawPeriodScore[];
  };
  game_score?: RawScorePair;
  period_scores?: RawPeriodScore[];
  outcomes?: MqttMarketOutcome[];
  markets?: MqttMarket[];
}

export interface BetStopPayload {
  event_id?: string | number;
  match_id?: string | number;
  market_id?: string | number;
  marketID?: string | number;
  suspended?: boolean;
}

export interface ScoreUpdatePayload {
  event_id?: string | number;
  match_id?: string | number;
  event_time?: string;
  home_score?: number | string | null;
  away_score?: number | string | null;
  game_score?: RawScorePair;
  period_scores?: RawPeriodScore[];
}

export interface MatchStatusPayload extends ScoreUpdatePayload {
  match_status?: string;
}

interface UseMqttOptions {
  onOddsChange?: (payload: OddsChangePayload, topic: string) => void;
  onBetStop?: (payload: BetStopPayload, topic: string) => void;
  onMatchStatus?: (payload: MatchStatusPayload, topic: string) => void;
  onScoreUpdate?: (payload: ScoreUpdatePayload, topic: string) => void;
}

export function useMqtt({
  onOddsChange,
  onBetStop,
  onMatchStatus,
  onScoreUpdate,
}: UseMqttOptions = {}) {
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());
  const handlersRef = useRef<UseMqttOptions>({});

  useEffect(() => {
    handlersRef.current = {
      onBetStop,
      onMatchStatus,
      onOddsChange,
      onScoreUpdate,
    };
  }, [onBetStop, onMatchStatus, onOddsChange, onScoreUpdate]);

  const dispatchMessage = useCallback((topic: string, data: Record<string, unknown>) => {
    const handlers = handlersRef.current;
    if (topic.endsWith("/bet_stop")) {
      handlers.onBetStop?.(data as BetStopPayload, topic);
    } else if (topic.endsWith("/match_status")) {
      handlers.onMatchStatus?.(data as MatchStatusPayload, topic);
    } else if (topic.endsWith("/scores")) {
      handlers.onScoreUpdate?.(data as ScoreUpdatePayload, topic);
    } else {
      handlers.onOddsChange?.(data as OddsChangePayload, topic);
    }
  }, []);

  const subscribeToBroker = useCallback(
    (topic: string) => {
      const subscriptions = subscriptionsRef.current;
      if (subscriptions.has(topic)) return;

      const unsubscribe = subscribeMqttTopic(topic, (data, incomingTopic) => {
        dispatchMessage(incomingTopic, data);
      });
      subscriptions.set(topic, unsubscribe);
    },
    [dispatchMessage],
  );

  const subscribe = useCallback((topic: string) => {
    subscribeToBroker(topic);
  }, [subscribeToBroker]);

  const unsubscribe = useCallback((topic: string) => {
    const subscriptions = subscriptionsRef.current;
    const unsubscribeTopic = subscriptions.get(topic);
    if (!unsubscribeTopic) return;

    unsubscribeTopic();
    subscriptions.delete(topic);
  }, []);

  const subscribeToMatch = useCallback(
    (sportId: string | number, matchId: string | number) => {
      const baseTopic = `sports/${sportId}/match/${matchId}`;
      subscribe(`${baseTopic}/markets`);
      subscribe(`${baseTopic}/bet_stop`);
      subscribe(`${baseTopic}/match_status`);
      subscribe(`${baseTopic}/scores`);
    },
    [subscribe]
  );

  const unsubscribeFromMatch = useCallback(
    (sportId: string | number, matchId: string | number) => {
      const baseTopic = `sports/${sportId}/match/${matchId}`;
      unsubscribe(`${baseTopic}/markets`);
      unsubscribe(`${baseTopic}/bet_stop`);
      unsubscribe(`${baseTopic}/match_status`);
      unsubscribe(`${baseTopic}/scores`);
    },
    [unsubscribe]
  );

  useEffect(() => {
    const subscriptions = subscriptionsRef.current;

    return () => {
      subscriptions.forEach((unsubscribeTopic) => {
        unsubscribeTopic();
      });
      subscriptions.clear();
    };
  }, []);

  return { subscribe, unsubscribe, subscribeToMatch, unsubscribeFromMatch };
}
