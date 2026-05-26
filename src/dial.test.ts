import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @saperly/sdk before importing the module under test
// ---------------------------------------------------------------------------
const mockLinesList = vi.fn();
const mockLinesCreate = vi.fn();
const mockConsentGrant = vi.fn();
const mockCallsCreate = vi.fn();

vi.mock("@saperly/sdk", () => {
  class ConsentAlreadyGrantedError extends Error {
    constructor() {
      super("consent already granted");
    }
  }
  class ConsentRequiredError extends Error {
    constructor() {
      super("consent required");
    }
  }

  class Saperly {
    lines = { list: mockLinesList, create: mockLinesCreate };
    consent = { grant: mockConsentGrant };
    calls = { create: mockCallsCreate };
  }

  return { Saperly, ConsentAlreadyGrantedError, ConsentRequiredError };
});

import { dial } from "./dial.js";

const config = { apiKey: "sk_test_fake" };

const fakeLine = {
  id: "line_abc",
  name: "saperly-dial-cli",
  phoneNumber: "+14155550123",
  mode: "hosted",
};

const fakeCall = {
  id: "call_xyz",
  status: "queued",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("dial()", () => {
  it("reuses an existing line instead of provisioning a new one", async () => {
    mockLinesList.mockResolvedValue([fakeLine]);
    mockConsentGrant.mockResolvedValue({});
    mockCallsCreate.mockResolvedValue(fakeCall);

    await dial(config, { toNumber: "+14155551234", message: "Hello!" });

    expect(mockLinesCreate).not.toHaveBeenCalled();
    expect(mockCallsCreate).toHaveBeenCalledWith({
      lineId: "line_abc",
      toNumber: "+14155551234",
    });
  });

  it("provisions a new line when none exists", async () => {
    mockLinesList.mockResolvedValue([]);
    mockLinesCreate.mockResolvedValue(fakeLine);
    mockConsentGrant.mockResolvedValue({});
    mockCallsCreate.mockResolvedValue(fakeCall);

    await dial(config, { toNumber: "+14155551234", message: "Hello!" });

    expect(mockLinesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "saperly-dial-cli", mode: "hosted" })
    );
  });

  it("swallows ConsentAlreadyGrantedError silently", async () => {
    mockLinesList.mockResolvedValue([fakeLine]);
    const { ConsentAlreadyGrantedError } = await import("@saperly/sdk");
    mockConsentGrant.mockRejectedValue(new ConsentAlreadyGrantedError());
    mockCallsCreate.mockResolvedValue(fakeCall);

    // Should not throw
    const result = await dial(config, { toNumber: "+14155551234", message: "Hello!" });
    expect(result.callId).toBe("call_xyz");
  });

  it("returns structured result with line and call info", async () => {
    mockLinesList.mockResolvedValue([fakeLine]);
    mockConsentGrant.mockResolvedValue({});
    mockCallsCreate.mockResolvedValue(fakeCall);

    const result = await dial(config, { toNumber: "+14155551234", message: "Hello!" });

    expect(result).toEqual({
      lineId: "line_abc",
      lineNumber: "+14155550123",
      callId: "call_xyz",
      status: "queued",
    });
  });

  it("re-throws unexpected errors from calls.create", async () => {
    mockLinesList.mockResolvedValue([fakeLine]);
    mockConsentGrant.mockResolvedValue({});
    mockCallsCreate.mockRejectedValue(new Error("InsufficientCreditsError"));

    await expect(
      dial(config, { toNumber: "+14155551234", message: "Hello!" })
    ).rejects.toThrow("InsufficientCreditsError");
  });
});
