import { apiClient } from "@/lib/api";
import { BASE_API, CLIENT_ID } from "./config";

export const contentApi = {
  getBanners: () =>
    apiClient
      .get(`${BASE_API}/content-management/banner?clientId=${CLIENT_ID}`)
      .then((r) => r.data),

  getBonusList: () =>
    apiClient.get(`${BASE_API}/bonus/acca-bonus?section=onliners`).then((r) => r.data),

  getPromotions: () =>
    apiClient.get(`${BASE_API}/games/promotions?clientId=${CLIENT_ID}`).then((r) => r.data),

  getCMSPage: (slug: string) =>
    apiClient
      .get(`${BASE_API}/content-management/page?clientId=${CLIENT_ID}&slug=${slug}`)
      .then((r) => r.data),
};
