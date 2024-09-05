import { expect, describe, it, jest } from "@jest/globals";
import { activeQuery } from "./create-query";

describe("createQuery", () => {
  jest.useFakeTimers();

  it("Returns idle result by default", () => {
    const query = activeQuery(async (id: number) => ({ id }));
    expect(query.state(1).hasData).toBe(false);
    expect(query.state(1).hasError).toBe(false);
    expect(query.state(1).isLoadingInitial).toBe(false);
    expect(query.state(1).isLoadingUpdate).toBe(false);
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
    expect(query.state(1).isLoadingInitial).toBe(false);
    query.fetch(1);
    expect(query.state(1).isLoadingInitial).toBe(true);
    expect(query.state(1).isLoadingUpdate).toBe(false);
    jest.advanceTimersByTime(2000);
  });

  it("Returns isUpdating on subsequent fetch", async () => {
    const query = activeQuery((id: number) => success(id));
    expect(query.state(1).isLoadingInitial).toBe(false);
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    query.fetch(1);
    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(query.state(1).isLoadingInitial).toBe(false);
    expect(query.state(1).isLoadingUpdate).toBe(true);
  });

  it("Returns hasSuccess after fetch is done", async () => {
    const query = activeQuery((id: number) => success(id));
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.state(1).hasData).toBe(true);
    expect(query.get(1)).toBe(1);
  });

  it("Returns hasError after fetch fails", async () => {
    const query = activeQuery((id: number) => failure(id));
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.state(1).hasError).toBe(true);
    expect(() => query.get(1)).toThrow();
  });

  const success = <T>(data: T) =>
    new Promise((resolve) => setTimeout(() => resolve(data), 500));

  const failure = <T>(data: T) =>
    new Promise((resolve, reject) => setTimeout(() => reject(data), 500));
});
