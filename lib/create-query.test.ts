import { expect, describe, it, jest } from "@jest/globals";
import { activeQuery } from "./create-query";
import { ActiveComputed, activeComputed } from "./create-computed";

describe("createQuery", () => {
  jest.useFakeTimers();

  it("Returns pending result by default", () => {
    const query = activeQuery(async (id: number) => ({ id }));
    expect(query.state(1).isSuccess).toBe(false);
    expect(query.state(1).isError).toBe(false);
    expect(query.state(1).status).toBe("pending");
    expect(query.state(1).isPending).toBe(true);
    expect(query.state(1).isRefetching).toBe(false);
  });

  it("Throws promise when query is pending", () => {
    const query = activeQuery(async (id: number) => ({ id }));
    try {
      query.get(1);
      expect(true).toBeFalsy(); // this should not happen
    } catch (error) {
      expect(error instanceof Promise).toBeTruthy;
    }
  });

  it("Returns isFetching after starting fetch", async () => {
    const query = activeQuery((id: number) => success(id));

    expect(() => query.get(1)).toThrow();

    expect(query.state(1).status).toBe("pending");
    expect(query.state(1).isFetching).toBe(true);
    expect(query.state(1).isRefetching).toBe(false);
    await jest.advanceTimersByTimeAsync(2000);
  });

  it("Returns isUpdating when invalidated and there's an active subscription", async () => {
    const query = activeQuery((id: number) => success(id));

    // Start a subscription
    const unsubscribe = query.subscribe(() => null, 1);

    expect(query.state(1).status).toBe("pending");
    await jest.advanceTimersByTimeAsync(2000);
    expect(query.state(1).status).toBe("success");

    query.invalidateOne(1);
    await jest.advanceTimersByTimeAsync(10);

    expect(query.state(1).isPending).toBe(false);
    expect(query.state(1).isRefetching).toBe(true);

    await jest.advanceTimersByTimeAsync(2000);
    expect(query.state(1).isRefetching).toBe(false);

    unsubscribe();
  });

  it("Returns hasSuccess after fetch is done", async () => {
    const query = activeQuery((id: number) => success(id));
    query.state(1);
    await jest.advanceTimersByTimeAsync(2000);
    expect(query.state(1).isSuccess).toBe(true);
    expect(query.get(1)).toBe(1);
  });

  it("Returns hasError after fetch fails", async () => {
    const query = activeQuery((id: number) => failure(id), { retry: false });
    query.state(1);
    await jest.advanceTimersByTimeAsync(2000);
    expect(query.state(1).isError).toBe(true);
    expect(() => query.get(1)).toThrow();
  });

  it("Returns provided initial data", async () => {
    const query = activeQuery((id: number) => success(id), {
      initialState: (id) => ({ status: "success", data: -id, isStale: false }),
    });
    expect(query.state(1).isSuccess).toBe(true);
    expect(query.state(1).isFetching).toBe(false);
    expect(query.get(1)).toBe(-1);
  });

  it("Fetches when initial data is stale", async () => {
    const query = activeQuery((id: number) => success(id), {
      initialState: (id) => ({ status: "success", data: -id, isStale: true }),
    });
    expect(query.get(1)).toBe(-1);
    expect(query.state(1).isSuccess).toBe(true);
    expect(query.state(1).isStale).toBe(true);
    expect(query.state(1).isFetching).toBe(true);
  });

  it("Throws provided initial error", async () => {
    const query = activeQuery((id: number) => success(id), {
      initialState: () => ({
        status: "error",
        error: new Error("Initial error"),
        isStale: false,
      }),
    });
    expect(query.state(1).isError).toBe(true);
    expect(query.state(1).isFetching).toBe(false);
    expect(() => query.get(1)).toThrowError("Initial error");
  });

  it("Always throws the same promise object when query is pending", async () => {
    const query = activeQuery(() => new Promise((res) => setTimeout(res, 100)));
    const getResultPromise = () => {
      try {
        return query.get();
      } catch (error) {
        return error;
      }
    };

    const firstPromise = getResultPromise();
    const secondPromise = getResultPromise();

    expect(firstPromise === secondPromise).toBeTruthy();
  });

  it("Calls onSubscribe and unsubscribe callbacks", async () => {
    const onUnsubscribe = jest.fn(() => null);
    const onSubscribe = jest.fn(() => onUnsubscribe);

    const query = activeQuery(
      () => new Promise((res) => setTimeout(res, 100)),
      { onSubscribe }
    );

    expect(onSubscribe).not.toBeCalled();
    expect(onUnsubscribe).not.toBeCalled();

    const unsubscribe1 = query.subscribe(() => () => null);
    const unsubscribe2 = query.subscribe(() => () => null);

    expect(onSubscribe).toBeCalledTimes(1);
    expect(onUnsubscribe).not.toBeCalled();

    unsubscribe1();

    expect(onSubscribe).toBeCalledTimes(1);
    expect(onUnsubscribe).not.toBeCalled();

    unsubscribe2();

    expect(onSubscribe).toBeCalledTimes(1);
    expect(onUnsubscribe).toBeCalledTimes(1);
  });

  it("Returns data provided by setState", async () => {
    const query = activeQuery((id: number) => success(id));
    query.setState({ status: "success", data: 100, isStale: false }, 1);

    expect(query.get(1)).toEqual(100);
    expect(query.state(1).status).toEqual("success");
    expect(query.state(1).isFetching).toEqual(false);

    const promise = query.getAsync(1);
    await jest.advanceTimersByTimeAsync(200);
    expect(promise).resolves.toEqual(100);
  });

  it("After setState fetches data on 'get' if provided data is stale", async () => {
    const query = activeQuery((id: number) => success(id));
    query.setState({ status: "success", data: 100, isStale: true }, 1);

    expect(query.get(1)).toEqual(100);
    expect(query.state(1).status).toEqual("success");
    expect(query.state(1).isFetching).toEqual(true);

    const promise = query.getAsync(1);
    await jest.advanceTimersByTimeAsync(200);
    expect(promise).resolves.toEqual(1);
  });

  it("Supports retrying after initial fetch fails", async () => {
    const factory = jest.fn((id: number) => failure(id));
    const query = activeQuery(factory);
    query.state(1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(query.state(1).isError).toBe(true);
    expect(() => query.get(1)).toThrow();
    expect(factory).toHaveBeenCalledTimes(3);
  });

  const success = <T>(data: T) =>
    new Promise<T>((resolve) => setTimeout(() => resolve(data), 500));

  const failure = <T>(data: T) =>
    new Promise<T>((resolve, reject) => setTimeout(() => reject(data), 500));
});
