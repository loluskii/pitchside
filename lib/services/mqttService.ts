"use client";

import { connectLiveFeed, subscribeLive, unsubscribeLive } from "@/lib/engine/realtime";

type LiveTopicCallback = (data: Record<string, unknown>, topic: string) => void;

const subscriptions = new Map<string, Set<LiveTopicCallback>>();

function topicMatches(subscribedTopic: string, incomingTopic: string) {
  if (subscribedTopic === incomingTopic) return true;
  if (!subscribedTopic.endsWith("/#")) return false;
  const prefix = subscribedTopic.slice(0, -2);
  return incomingTopic.startsWith(`${prefix}/`);
}

function dispatchMessage(topic: string, data: Record<string, unknown>) {
  subscriptions.forEach((callbacks, subscribedTopic) => {
    if (!topicMatches(subscribedTopic, topic)) return;
    callbacks.forEach((callback) => callback(data, topic));
  });
}

/** Subscribe to a live topic (sports/{sportId}/match/{matchId}/{markets|scores|match_status|bet_stop}). */
export function subscribeMqttTopic(topic: string, callback: LiveTopicCallback) {
  if (!topic || typeof window === "undefined") return () => {};

  connectLiveFeed(dispatchMessage);
  const callbacks = subscriptions.get(topic) ?? new Set<LiveTopicCallback>();
  callbacks.add(callback);
  subscriptions.set(topic, callbacks);
  subscribeLive(topic);

  return () => {
    const current = subscriptions.get(topic);
    if (!current) return;
    current.delete(callback);
    if (current.size > 0) return;
    subscriptions.delete(topic);
    unsubscribeLive(topic);
  };
}
