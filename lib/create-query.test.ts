import { expect, describe, it, jest } from "@jest/globals";
import { createQuery } from "./create-query";

describe("createQuery", () => {
  jest.useFakeTimers();

  it("Returns idle result by default", () => {
    const query = createQuery(async (id: number) => ({ id }));
    expect(query.get(1).hasData).toBe(false);
    expect(query.get(1).hasError).toBe(false);
    expect(query.get(1).isLoading).toBe(false);
    expect(query.get(1).isUpdating).toBe(false);
  });

  it("Returns isLoading after starting fetch", () => {
    const query = createQuery((id: number) => success(id));
    expect(query.get(1).isLoading).toBe(false);
    query.fetch(1);
    expect(query.get(1).isLoading).toBe(true);
    expect(query.get(1).isUpdating).toBe(false);
    jest.advanceTimersByTime(2000);
  });

  it("Returns isUpdating on subsequent fetch", async () => {
    const query = createQuery((id: number) => success(id));
    expect(query.get(1).isLoading).toBe(false);
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();

    query.fetch(1);
    jest.advanceTimersByTime(10);
    await Promise.resolve();

    expect(query.get(1).isLoading).toBe(false);
    expect(query.get(1).isUpdating).toBe(true);
  });

  it("Returns hasSuccess after fetch is done", async () => {
    const query = createQuery((id: number) => success(id));
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.get(1).hasData).toBe(true);
  });

  it("Returns hasError after fetch fails", async () => {
    const query = createQuery((id: number) => failure(id));
    query.fetch(1);
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(query.get(1).hasError).toBe(true);
  });

  const success = <T>(data: T) =>
    new Promise((resolve) => setTimeout(() => resolve(data), 500));

  const failure = <T>(data: T) =>
    new Promise((resolve, reject) => setTimeout(() => reject(data), 500));
});
