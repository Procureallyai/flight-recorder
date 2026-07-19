import { forwardRef } from "react";
import { clsx } from "clsx";

export const Button = forwardRef(function Button(
  { className, variant = "primary", size = "default", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx("button", `button--${variant}`, `button--${size}`, className)}
      {...props}
    />
  );
});
