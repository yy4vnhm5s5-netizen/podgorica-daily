type StatusTone = "error" | "info" | "neutral" | "success" | "warning";

const statusToneClasses: Record<StatusTone, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
  neutral: "border-transparent bg-muted text-slate-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

function getStatusBadgeToneClassName(tone: StatusTone) {
  return statusToneClasses[tone];
}

export { getStatusBadgeToneClassName, type StatusTone };
