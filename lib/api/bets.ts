import { apiClient } from "@/lib/api";
import { BASE_API, BET_API, FIXTURES_API, CLIENT_ID } from "./config";

export const betsApi = {
  placeBet: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/bet`, payload).then((r) => r.data),

  getFeatureConfig: (category = "online") =>
    apiClient
      .get(`${BET_API}/${CLIENT_ID}/features/config?category=${encodeURIComponent(category)}`)
      .then((r) => r.data),

  previewAccaBonus: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/acca-bonus/preview`, payload).then((r) => r.data),

  previewCutOne: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/cut-one/preview`, payload).then((r) => r.data),

  previewFlex: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/flex/preview`, payload).then((r) => r.data),

  reportBetslipActivity: (payload: Record<string, unknown>) =>
    apiClient
      .post(
        `${BASE_API}/crm/betslip/activity?clientId=${CLIENT_ID}&client_id=${CLIENT_ID}`,
        payload,
      )
      .then((r) => r.data),

  reportBetslipAbandoned: (payload: Record<string, unknown>) =>
    apiClient
      .post(
        `${BASE_API}/crm/betslip/abandoned?clientId=${CLIENT_ID}&client_id=${CLIENT_ID}`,
        payload,
      )
      .then((r) => r.data),

  closeBetslipSession: (payload: Record<string, unknown>) =>
    apiClient
      .post(
        `${BASE_API}/crm/betslip/session/close?clientId=${CLIENT_ID}&client_id=${CLIENT_ID}`,
        payload,
      )
      .then((r) => r.data),

  getBets: (params: {
    bet_type?: string;
    event_type?: string;
    id?: number | string;
    is_booked?: number;
    page?: number;
    perPage?: number;
    share_code?: string;
    source?: string;
    stake_type?: string;
    status?: number | number[];
    user_id?: number | string;
    username?: string;
    from?: string;
    to?: string;
  } = {}) => {
    const {
      bet_type,
      event_type,
      id,
      is_booked,
      page = 1,
      perPage = 5,
      share_code,
      source,
      stake_type,
      status,
      user_id,
      username,
      from,
      to,
    } = params;
    const p = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    if (id != null && id !== "") p.set("id", String(id));
    if (user_id != null && user_id !== "") p.set("user_id", String(user_id));
    if (username) p.set("username", username);
    if (bet_type) p.set("bet_type", bet_type);
    if (is_booked != null) p.set("is_booked", String(is_booked));
    if (event_type) p.set("event_type", event_type);
    if (source) p.set("source", source);
    if (stake_type) p.set("stake_type", stake_type);
    if (share_code) p.set("share_code", share_code);
    if (status != null) {
      const statuses = Array.isArray(status) ? status : [status];
      statuses.forEach((statusCode) => p.append("status", String(statusCode)));
    }
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return apiClient.get(`${BET_API}/${CLIENT_ID}/bet?${p}`).then((r) => r.data);
  },

  validateSelections: (payload: unknown) =>
    apiClient.post(`${FIXTURES_API}/odd/status`, payload).then((r) => r.data),

  buildCashout: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/cashout/build`, payload).then((r) => r.data),

  performCashout: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/cashout/placement`, payload).then((r) => r.data),

  bookBet: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/bets/book-bet/${CLIENT_ID}`, payload).then((r) => r.data),

  loadByCode: (shareCode: string) =>
    apiClient.get(`${BET_API}/${CLIENT_ID}/codehub/${shareCode}`).then((r) => r.data),

  getCustomCodes: () =>
    apiClient.get(`${BET_API}/${CLIENT_ID}/custom-codes`).then((r) => r.data),

  createCustomCode: (payload: Record<string, unknown>) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/custom-codes`, payload).then((r) => r.data),

  deleteCustomCode: (code: string) =>
    apiClient.delete(`${BET_API}/${CLIENT_ID}/custom-codes/${code}`).then((r) => r.data),

  assignCustomCode: (code: string, payload: Record<string, unknown> = {}) =>
    apiClient.post(`${BET_API}/${CLIENT_ID}/custom-codes/${code}/assign`, payload).then((r) => r.data),

  getCodeHub: (params: {
    page?: number;
    perPage?: number;
    sort?: string;
    start?: string;
    end?: string;
    minOdd?: number | string;
    maxOdd?: number | string;
    minFold?: number | string;
    maxFold?: number | string;
    betType?: string;
    search?: string;
  } = {}) => {
    const {
      page = 1, perPage = 20, sort = "created|desc",
      start, end, minOdd, maxOdd, minFold, maxFold, betType, search,
    } = params;
    const p = new URLSearchParams({ page: String(page), perPage: String(perPage), sort });
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    if (minOdd != null && minOdd !== "") p.set("minOdd", String(minOdd));
    if (maxOdd != null && maxOdd !== "") p.set("maxOdd", String(maxOdd));
    if (minFold != null && minFold !== "") p.set("minFold", String(minFold));
    if (maxFold != null && maxFold !== "") p.set("maxFold", String(maxFold));
    if (betType) p.set("betType", betType);
    if (search) p.set("search", search);
    return apiClient.get(`${BET_API}/${CLIENT_ID}/codehub?${p}`).then((r) => r.data);
  },
};
