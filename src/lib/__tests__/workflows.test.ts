import { describe, it, expect } from "vitest";
import { metersBetween } from "../visit-clock";
import { sanitizeText, phoneSchema, birthdateSchema, requiredText, checkUploadSize } from "../security/validation";
import { maskRecipient, maskPhone } from "../security/pii";

describe("EVV geofence", () => {
  it("flags ~1km away as outside 150m", () => expect(metersBetween(18.4655, -66.1057, 18.4755, -66.1057)).toBeGreaterThan(150));
  it("passes a few meters away", () => expect(metersBetween(18.46553, -66.10572, 18.4655, -66.1057)).toBeLessThan(150));
});

describe("Edge-case inputs", () => {
  it("rejects empty required text", () => expect(requiredText().safeParse("   ").success).toBe(false));
  it("rejects a future birthdate", () => expect(birthdateSchema.safeParse("2099-01-01").success).toBe(false));
  it("accepts a real birthdate", () => expect(birthdateSchema.safeParse("1945-06-15").success).toBe(true));
  it("rejects a 50MB file on a 5MB picker", () => expect(checkUploadSize({ size: 50 * 1048576 })).toMatch(/limit is 5 MB/));
  it("accepts a 1MB file", () => expect(checkUploadSize({ size: 1048576 })).toBeNull());
  it("strips HTML tags", () => expect(sanitizeText("<b>ok</b>")).toBe("ok"));
  it("normalizes PR phones", () => {
    expect(phoneSchema.parse("787-555-0123")).toBe("+17875550123");
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });
});

describe("PII masking", () => {
  const r = { address_line: "123 Calle Sol", zip_code: "00901", date_of_birth: "1945-06-15", emergency_contact_phone: "7875550123", notes: "private" };
  it("family sees everything", () => expect(maskRecipient(r, "family").notes).toBe("private"));
  it("off-shift caregiver sees masked data", () => {
    const m = maskRecipient(r, "caregiver", { onShiftToday: false });
    expect(m.notes).toBeNull();
    expect(m.date_of_birth).toBe("1945-**-**");
    expect(m.address_line).toBe("123 ***");
    expect(m.emergency_contact_phone).toBe(maskPhone("7875550123"));
  });
});
