import { evaluateAttendanceDay } from "../../src/modules/attendance/attendance-status";
import { distanceInMeters } from "../../src/utils/geo";
import { wibDateTime } from "../../src/utils/time";

const schedule = { isOff: false, startTime: "08:00", endTime: "16:00" };
const at = (time: string, date = "2026-09-21") => wibDateTime(date, time);
const evaluate = (overrides: Partial<Parameters<typeof evaluateAttendanceDay>[0]>) =>
  evaluateAttendanceDay({ date: "2026-09-21", now: at("12:00"), schedule, checkInAt: null, lateToleranceMinutes: 0, ...overrides });

describe("evaluateAttendanceDay (ABS-04)", () => {
  it("labels check-ins as on time or late with the minutes", () => {
    expect(evaluate({ checkInAt: at("07:55") })).toEqual({ status: "ON_TIME", lateMinutes: 0 });
    expect(evaluate({ checkInAt: at("08:00") })).toEqual({ status: "ON_TIME", lateMinutes: 0 });
    expect(evaluate({ checkInAt: at("08:17") })).toEqual({ status: "LATE", lateMinutes: 17 });
    expect(evaluate({ checkInAt: at("08:17"), lateToleranceMinutes: 20 })).toEqual({ status: "ON_TIME", lateMinutes: 17 });
  });

  it("tracks SPG who have not checked in yet", () => {
    expect(evaluate({ now: at("07:30") }).status).toBe("UPCOMING");
    expect(evaluate({ now: at("08:45") })).toEqual({ status: "NOT_CHECKED_IN", lateMinutes: 45 });
    expect(evaluate({ now: at("16:00") }).status).toBe("ABSENT");
  });

  it("handles days off, unscheduled check-ins, and overnight shifts", () => {
    expect(evaluate({ schedule: { isOff: true, startTime: null, endTime: null } }).status).toBe("OFF");
    expect(evaluate({ schedule: null }).status).toBeNull();
    expect(evaluate({ schedule: null, checkInAt: at("09:00") }).status).toBe("UNSCHEDULED");

    const nightShift = { isOff: false, startTime: "22:00", endTime: "06:00" };
    // 03:00 keesokan harinya: shift masih berjalan, belum dianggap tidak masuk.
    expect(evaluate({ schedule: nightShift, now: at("03:00", "2026-09-22") }).status).toBe("NOT_CHECKED_IN");
    expect(evaluate({ schedule: nightShift, now: at("06:00", "2026-09-22") }).status).toBe("ABSENT");
  });
});

describe("distanceInMeters", () => {
  it("measures short distances accurately enough for a 20 m radius", () => {
    const pharmacy = { latitude: -6.2251, longitude: 106.9004 };
    expect(distanceInMeters(pharmacy, pharmacy)).toBe(0);
    expect(distanceInMeters(pharmacy, { latitude: -6.2251 + 0.0001, longitude: 106.9004 })).toBeCloseTo(11.1, 1);
    expect(distanceInMeters(pharmacy, { latitude: -6.2251, longitude: 106.9004 + 0.001 })).toBeCloseTo(110.6, 0);
  });
});
