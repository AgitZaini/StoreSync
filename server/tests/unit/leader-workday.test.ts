import { workDayState } from "../../src/modules/visits/leader-workday";
import { wibDateTime } from "../../src/utils/time";

const DATE = "2026-09-21";
const at = (time: string) => wibDateTime(DATE, time);

describe("workDayState (ABS-03)", () => {
  it("starts with the first check-in and runs until the work end time", () => {
    expect(workDayState(null, DATE, at("08:00"), "21:00").status).toBe("NOT_STARTED");

    const started = { startedAt: at("08:10"), endedAt: null };
    expect(workDayState(started, DATE, at("12:00"), "21:00")).toEqual({
      status: "ACTIVE",
      startedAt: at("08:10"),
      endedAt: null,
      endsAt: at("21:00"),
    });
    expect(workDayState(started, DATE, at("20:59"), "21:00").status).toBe("ACTIVE");
    expect(workDayState(started, DATE, at("21:00"), "21:00").status).toBe("ENDED");
    expect(workDayState(started, DATE, at("21:00"), "22:30").status).toBe("ACTIVE");
  });

  it("ends early when the Team Leader presses 'Selesai hari ini'", () => {
    expect(workDayState({ startedAt: at("08:10"), endedAt: at("15:00") }, DATE, at("15:30"), "21:00").status).toBe("ENDED");
  });
});
