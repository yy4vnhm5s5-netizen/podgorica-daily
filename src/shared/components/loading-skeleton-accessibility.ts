interface LoadingSkeletonAccessibilityProps {
  "aria-busy"?: true;
  "aria-hidden"?: true;
  "aria-label"?: string;
  role?: "status";
}

function getLoadingSkeletonAccessibilityProps({
  announce,
  label,
}: {
  announce: boolean;
  label: string;
}): LoadingSkeletonAccessibilityProps {
  if (!announce) return { "aria-hidden": true };

  return {
    "aria-busy": true,
    "aria-label": label,
    role: "status",
  };
}

export { getLoadingSkeletonAccessibilityProps, type LoadingSkeletonAccessibilityProps };
