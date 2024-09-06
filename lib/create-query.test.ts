import { expect, describe, it, jest } from "@jest/globals";
import { activeQuery } from "./create-query";

describe("createQuery", () => {
  jest.useFakeTimers();

  it("Returns idle result by default", () => {
    const query = activeQuery(async (id: number) => ({ id }));
    expect(query.state(1).isSuccess).toBe(false);
    expect(query.state(1).isError).toBe(false);
    expect(query.state(1).status).toBe("pending");
    expect(query.state(1).isLoading).toBe(true);
    expect(query.state(1).isRefetching).toBe(false);
  });

  it("Throws promise when query is idle", () => {
    const query = activeQuery(async (id: number) => ({ id }));
    try {
      query.get(1);
      expect(true).toBeFalsy(); // this should not happen
    } catch (error) {
      expect(error instanceof Promise).toBeTruthy;
    }
  });

  it("Returns isLoading after starting fetch", () => {
    const query = activeQuery((id: number) => success(id));
    expect(query.state(1).status).toBe("pending");
    expect(query.state(1).isLoading).toBe(true);
    expect(query.state(1).isRefetching).toBe(false);
    jest.advanceTimersByTime(2000);
  });

  it("Returns isUpdating on subsequent fetch", async () => {
    const query = activeQuery((id: number) => success(id));
    expect(query.state(1).status).toBe("pending");
    query.refetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.state(1).status).toBe("success");

    query.refetch(1);
    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(query.state(1).isLoading).toBe(false);
    expect(query.state(1).isRefetching).toBe(true);
  });

  it("Returns hasSuccess after fetch is done", async () => {
    const query = activeQuery((id: number) => success(id));
    query.refetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.state(1).isSuccess).toBe(true);
    expect(query.get(1)).toBe(1);
  });

  it("Returns hasError after fetch fails", async () => {
    const query = activeQuery((id: number) => failure(id));
    query.refetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.state(1).isError).toBe(true);
    expect(() => query.get(1)).toThrow();
  });

  const success = <T>(data: T) =>
    new Promise((resolve) => setTimeout(() => resolve(data), 500));

  const failure = <T>(data: T) =>
    new Promise((resolve, reject) => setTimeout(() => reject(data), 500));
});
