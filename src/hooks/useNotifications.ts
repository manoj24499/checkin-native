import { useMemo } from "react";
import { useLateArrivals } from "./useLateArrivals";
import { useLeaveRequests } from "./useLeaveRequests";
import { useOvertimeStatus } from "./useOvertimeStatus";
import { useNotificationStore } from "@/store/notificationStore";
import { useHybridPromptStore } from "@/store/hybridPromptStore";
import type { IconName } from "@/components/ui";

export type NotificationKind = "approvals" | "alerts" | "reminders";
export type NotificationTone = "good" | "bad" | "warn" | "brand";
export type NotificationTarget = "requests-leave" | "requests-overtime" | "history" | "checkin" | "home";

export interface NotificationDetail {
  k: string;
  v: string;
  tone?: NotificationTone;
}

export interface NotificationItem {
  id: string;
  group: "Today" | "Earlier";
  kind: NotificationKind;
  tone: NotificationTone;
  icon: IconName;
  title: string;
  time: string;
  summary: string;
  details: NotificationDetail[];
  cta: string;
  target: NotificationTarget;
  sortAt: number;
  unread: boolean;
}

const TYPE_LABEL = { CASUAL: "Casual", SICK: "Sick", EARNED: "Earned" } as const;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
const fmtRange = (s: string, e: string) => (s === e ? fmtDate(s) : `${fmtDate(s)} - ${fmtDate(e)}`);
const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Notifications derived from the leave / overtime / late-arrival data the app already loads. */
export function useNotifications() {
  const leave = useLeaveRequests();
  const overtime = useOvertimeStatus(true);
  const late = useLateArrivals();
  const read = useNotificationStore((s) => s.read);
  const dismissed = useNotificationStore((s) => s.dismissed);
  // HYBRID pushes received while the app was running (cleared by Home once the segment moves on).
  const departure = useHybridPromptStore((s) => s.departure);
  const transitExpired = useHybridPromptStore((s) => s.transitExpired);

  const leaveData = leave.data;
  const overtimeData = overtime.data;
  const lateData = late.data;

  const items = useMemo(() => {
    const now = new Date();
    const out: Omit<NotificationItem, "unread">[] = [];

    for (const r of leaveData?.requests ?? []) {
      if (r.status === "CANCELLED") continue;
      // Skip long-finished decisions; pending ones always matter.
      const endMs = new Date(r.endDate).getTime();
      if (r.status !== "PENDING" && now.getTime() - endMs > 30 * 24 * 3600 * 1000) continue;
      const typeLabel = TYPE_LABEL[r.type] ?? r.type;
      const details: NotificationDetail[] = [
        { k: "Type", v: `${typeLabel} leave` },
        { k: "Dates", v: fmtRange(r.startDate, r.endDate) },
        { k: "Days", v: String(r.days) },
      ];
      const bal = leaveData?.balances.find((b) => b.type === r.type);
      if (r.status === "APPROVED" && bal) {
        details.push({ k: "Balance now", v: `${bal.remaining} / ${bal.quota} days`, tone: "good" });
      }
      if (r.status === "REJECTED" && r.reviewNote) details.push({ k: "Note from admin", v: r.reviewNote });
      const meta =
        r.status === "APPROVED"
          ? { title: "Leave approved", tone: "good" as const, icon: "check" as const }
          : r.status === "REJECTED"
            ? { title: "Leave declined", tone: "bad" as const, icon: "close" as const }
            : { title: "Leave request pending", tone: "warn" as const, icon: "clock" as const };
      details.push({
        k: "Status",
        v: r.status === "APPROVED" ? "Approved" : r.status === "REJECTED" ? "Declined" : "Awaiting approval",
        tone: meta.tone,
      });
      out.push({
        id: `leave:${r.id}:${r.status}`,
        group: r.status === "PENDING" ? "Today" : "Earlier",
        kind: "approvals",
        ...meta,
        time: fmtDate(r.startDate),
        summary: `${typeLabel} · ${fmtRange(r.startDate, r.endDate)} · ${r.days} ${r.days === 1 ? "day" : "days"}`,
        details,
        cta: "View in Requests",
        target: "requests-leave",
        sortAt: new Date(r.startDate).getTime() + (r.status === "PENDING" ? 1e13 : 0),
      });
    }

    for (const o of overtimeData ?? []) {
      const end = new Date(o.estimatedEndAt);
      const meta =
        o.status === "APPROVED"
          ? { title: "Overtime approved", tone: "good" as const, icon: "check" as const, status: "Approved" }
          : o.status === "REJECTED"
            ? { title: "Overtime request declined", tone: "bad" as const, icon: "close" as const, status: "Declined" }
            : { title: "Overtime request pending", tone: "warn" as const, icon: "clock" as const, status: "Awaiting review" };
      out.push({
        id: `overtime:${o.id}:${o.status}`,
        group: o.status === "PENDING" || sameDay(end, now) ? "Today" : "Earlier",
        kind: "approvals",
        title: meta.title,
        tone: meta.tone,
        icon: meta.icon,
        time: fmtDate(o.estimatedEndAt),
        summary: `Until ${fmtTime(o.estimatedEndAt)}${o.reason ? ` · ${o.reason}` : ""}`,
        details: [
          { k: "Requested until", v: `${fmtDate(o.estimatedEndAt)} · ${fmtTime(o.estimatedEndAt)}` },
          ...(o.reason ? [{ k: "Reason", v: o.reason }] : []),
          { k: "Decision", v: meta.status, tone: meta.tone },
        ],
        cta: "View in Requests",
        target: "requests-overtime",
        sortAt: end.getTime(),
      });
    }

    for (const l of lateData ?? []) {
      const at = new Date(l.timestamp);
      if (now.getTime() - at.getTime() > WEEK_MS) continue;
      const half = l.leaveType === "HALF_DAY";
      const tone = half ? ("bad" as const) : ("warn" as const);
      out.push({
        id: `late:${l.id}`,
        group: sameDay(at, now) ? "Today" : "Earlier",
        kind: "alerts",
        tone,
        icon: "clock",
        title: half ? "Late arrival: half day" : "Late arrival recorded",
        time: sameDay(at, now) ? fmtTime(l.timestamp) : fmtDate(l.timestamp),
        summary: `Checked in at ${fmtTime(l.timestamp)}${l.lateMinutes != null ? ` · ${l.lateMinutes} min late` : ""}`,
        details: [
          { k: "Date", v: fmtDate(l.timestamp) },
          { k: "Checked in", v: fmtTime(l.timestamp) },
          ...(l.lateMinutes != null ? [{ k: "Late by", v: `${l.lateMinutes} min`, tone }] : []),
          { k: "Counted as", v: half ? "Half day" : "Permission", tone },
        ],
        cta: "See history",
        target: "history",
        sortAt: at.getTime(),
      });
    }

    if (departure) {
      const toHome = departure.suggestedHeading === "HOME";
      const at = new Date(departure.at).toISOString();
      out.push({
        id: `hybrid-departure:${departure.segmentId ?? departure.at}`,
        group: "Today",
        kind: "alerts",
        tone: "warn",
        icon: "navigate",
        title: toHome ? "Heading home?" : "Heading to the office?",
        time: fmtTime(at),
        summary: `You seem to have left ${toHome ? "the office" : "home"}. Switch to ${toHome ? "Home" : "Office"} if you're on your way.`,
        details: [
          { k: "Detected", v: fmtTime(at) },
          { k: "If you're not travelling", v: "Go back within 10 minutes, or your time pauses", tone: "warn" },
        ],
        cta: `Switch to ${toHome ? "Home" : "Office"} on Home`,
        target: "home",
        sortAt: departure.at,
      });
    }

    if (transitExpired) {
      const toHome = transitExpired.heading === "HOME";
      const at = new Date(transitExpired.at).toISOString();
      out.push({
        id: `hybrid-transit:${transitExpired.segmentId ?? "x"}:${transitExpired.at}`,
        group: "Today",
        kind: "reminders",
        tone: "brand",
        icon: "clock",
        title: toHome ? "Are you home yet?" : "Have you reached the office?",
        time: fmtTime(at),
        summary: "Confirm you've arrived, or tell us you're still travelling.",
        details: [{ k: "Asked at", v: fmtTime(at) }],
        cta: "Answer on Home",
        target: "home",
        sortAt: transitExpired.at,
      });
    }

    return out
      .filter((n) => !dismissed[n.id])
      .sort((a, b) => b.sortAt - a.sortAt)
      .map<NotificationItem>((n) => ({ ...n, unread: !read[n.id] }));
  }, [leaveData, overtimeData, lateData, read, dismissed, departure, transitExpired]);

  const unreadCount = items.reduce((n, i) => n + (i.unread ? 1 : 0), 0);
  return { items, unreadCount, isLoading: leave.isLoading && late.isLoading };
}
