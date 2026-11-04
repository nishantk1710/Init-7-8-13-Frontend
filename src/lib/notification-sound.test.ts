import { afterEach, describe, expect, it, vi } from "vitest"

import { isSoundOn, playChime, setSoundOn, shouldRing } from "@/lib/notification-sound"

/** A minimal browser: just the storage and events the module touches. */
function stubBrowser(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  const dispatchEvent = vi.fn()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    dispatchEvent,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  return { store, dispatchEvent }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("shouldRing", () => {
  it("is silent on the first count after the page opens, however many are unread", () => {
    expect(shouldRing(null, 0)).toBe(false)
    expect(shouldRing(null, 7)).toBe(false)
  })

  it("rings when the unread count has gone up", () => {
    expect(shouldRing(0, 1)).toBe(true)
    expect(shouldRing(3, 5)).toBe(true)
  })

  it("is silent when the count is the same or went down (the person read something)", () => {
    expect(shouldRing(2, 2)).toBe(false)
    expect(shouldRing(4, 3)).toBe(false)
    expect(shouldRing(1, 0)).toBe(false)
  })
})

describe("the saved preference", () => {
  it("is on by default", () => {
    stubBrowser()
    expect(isSoundOn()).toBe(true)
  })

  it("remembers off and on, and tells the page", () => {
    const { store, dispatchEvent } = stubBrowser()
    setSoundOn(false)
    expect(store.get("spares.notificationSound")).toBe("off")
    expect(isSoundOn()).toBe(false)
    setSoundOn(true)
    expect(isSoundOn()).toBe(true)
    expect(dispatchEvent).toHaveBeenCalledTimes(2)
  })

  it("reads on when storage is blocked", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked")
        },
      },
    })
    expect(isSoundOn()).toBe(true)
  })
})

describe("playChime", () => {
  it("is silent, and does not throw, before the browser has allowed sound", () => {
    stubBrowser()
    expect(() => playChime()).not.toThrow()
  })

  it("is silent when sound is turned off", () => {
    stubBrowser({ "spares.notificationSound": "off" })
    expect(() => playChime()).not.toThrow()
  })
})
