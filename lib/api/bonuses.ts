import { apiClient } from "@/lib/api";
import { BASE_API, CLIENT_ID } from "./config";

export const bonusesApi = {
  getUserBonuses: () =>
    apiClient.get(`${BASE_API}/bonus/user/list?client_id=${CLIENT_ID}`).then((r) => r.data),

  getActiveBonus: () =>
    apiClient
      .get(`${BASE_API}/bonus/get-active-bonus?client_id=${CLIENT_ID}`)
      .then((r) => r.data),

  getCashbackBonus: () =>
    apiClient
      .get(`${BASE_API}/bonus/user/check-cashback-bonus?clientId=${CLIENT_ID}`)
      .then((r) => r.data),

  checkFirstDeposit: () =>
    apiClient
      .get(`${BASE_API}/bonus/user/check-deposit-bonus?client_id=${CLIENT_ID}`)
      .then((r) => r.data),

  awardBonus: (payload: Record<string, unknown>) =>
    apiClient
      .post(`${BASE_API}/bonus/user/award?client_id=${CLIENT_ID}`, payload)
      .then((r) => r.data),
};
