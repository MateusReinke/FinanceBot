import { createElement } from "react";
import { getIcon } from "@/lib/icon-registry";

// Renders an icon looked up dynamically by name (from ICON_REGISTRY). Uses
// createElement rather than `const Icon = getIcon(x); <Icon />` because that
// JSX pattern reads as "component created during render" to the compiler,
// even though the lookup is a stable, static registry.
export function CategoryIcon({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  return createElement(getIcon(icon), { className });
}
