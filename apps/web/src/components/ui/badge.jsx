import { clsx } from "clsx";

export function Badge({ className, tone = "neutral", children }) {
  return <span className={clsx("badge", `badge--${tone}`, className)}>{children}</span>;
}
