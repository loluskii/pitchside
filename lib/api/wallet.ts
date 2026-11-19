import { apiClient } from "@/lib/api";
import { BASE_API, CLIENT_ID } from "./config";

export const walletApi = {
  getTransactions: (payload: Record<string, unknown>) =>
    apiClient.post(`${BASE_API}/user/wallet/transactions`, payload).then((r) => r.data),

  getPendingWithdrawals: () =>
    apiClient
      .get(`${BASE_API}/user/wallet/list-pending-withdrawal/${CLIENT_ID}`)
      .then((r) => r.data),

  cancelWithdrawal: (payload: Record<string, unknown>) =>
    apiClient
      .post(`${BASE_API}/user/wallet/cancel-withdrawal/${CLIENT_ID}`, payload)
      .then((r) => r.data),

  getBankAssets: () =>
    apiClient.get(`${BASE_API}/user/wallet/bank-accounts`).then((r) => r.data),

  getPaymentMethods: () =>
    apiClient.get(`${BASE_API}/user/wallet/${CLIENT_ID}/payment-methods`).then((r) => r.data),

  getBanks: () =>
    apiClient.get(`${BASE_API}/user/wallet/${CLIENT_ID}/banks`).then((r) => r.data),

  verifyBankAccount: (payload: Record<string, unknown>) =>
    apiClient
      .post(`${BASE_API}/user/wallet/verify-bank-account?source=mobile`, payload)
      .then((r) => r.data),

  initiateDeposit: (payload: Record<string, unknown>) =>
    apiClient
      .post(`${BASE_API}/user/wallet/initiate-deposit?source=mobile`, payload)
      .then((r) => r.data),

  verifyDeposit: (channel: string, ref: string) =>
    apiClient
      .get(
        `${BASE_API}/user/wallet/verify-payment?paymentChannel=${channel}&transactionRef=${ref}&clientId=${CLIENT_ID}`,
      )
      .then((r) => r.data),

  withdraw: (payload: Record<string, unknown>) =>
    apiClient
      .post(`${BASE_API}/user/wallet/withdraw?source=mobile`, payload)
      .then((r) => r.data),

  smileandpayPayout: (payload: Record<string, unknown>) =>
    apiClient
      .post(`${BASE_API}/user/wallet/smileandpay/payout/${CLIENT_ID}?source=mobile`, payload)
      .then((r) => r.data),

  transfer: (payload: Record<string, unknown>) =>
    apiClient.put(`${BASE_API}/auth/initiate-transfer/${CLIENT_ID}`, payload).then((r) => r.data),
};
