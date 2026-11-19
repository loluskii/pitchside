import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  authApi: {
    getDetails: vi.fn(),
  },
}));

vi.mock("@/lib/api/auth", () => ({ authApi: apiMocks.authApi }));

import { useUserStore } from "@/store/userStore";

describe("useUserStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.setState(useUserStore.getInitialState(), true);
  });

  it("reads cached user directly from the store without calling the profile endpoint", () => {
    const cachedUser = {
      availableBalance: 5000,
      casinoBonusBalance: 0,
      id: 271624,
      sportBonusBalance: 0,
      trustBalance: 0,
      username: "7044346343",
      virtualBonusBalance: 0,
    };
    useUserStore.getState().setCurrentUser(cachedUser);

    const user = useUserStore.getState().currentUser;

    expect(user).toEqual(cachedUser);
    expect(apiMocks.authApi.getDetails).not.toHaveBeenCalled();
  });

  it("refreshes the profile endpoint and updates the store", async () => {
    apiMocks.authApi.getDetails.mockResolvedValueOnce({
      data: {
        availableBalance: 995936.75,
        currency: "NGN",
        id: 271624,
        username: "7044346343",
      },
    });

    const user = await useUserStore.getState().refreshCurrentUser("7044346343");

    expect(user.id).toBe(271624);
    expect(user.availableBalance).toBe(995936.75);
    expect(useUserStore.getState().currentUser?.id).toBe(271624);
    expect(apiMocks.authApi.getDetails).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent profile refreshes", async () => {
    let resolveProfile: (value: unknown) => void = () => {};
    apiMocks.authApi.getDetails.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    );

    const first = useUserStore.getState().refreshCurrentUser("7044346343");
    const second = useUserStore.getState().refreshCurrentUser("7044346343");

    resolveProfile({
      data: {
        availableBalance: 1000,
        id: 271624,
        username: "7044346343",
      },
    });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(apiMocks.authApi.getDetails).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest refresh result when different users refresh concurrently", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    let resolveSecond: (value: unknown) => void = () => {};
    apiMocks.authApi.getDetails
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const first = useUserStore.getState().refreshCurrentUser("first-user");
    const second = useUserStore.getState().refreshCurrentUser("second-user");

    resolveSecond({
      data: {
        availableBalance: 2000,
        id: 2,
        username: "second-user",
      },
    });
    await second;

    resolveFirst({
      data: {
        availableBalance: 1000,
        id: 1,
        username: "first-user",
      },
    });
    await first;

    expect(useUserStore.getState().currentUser?.username).toBe("second-user");
    expect(apiMocks.authApi.getDetails).toHaveBeenCalledTimes(2);
  });
});
