import type { ComponentType, ReactNode } from "react";

export type NavLinkRenderProps = {
  isActive: boolean;
};

export type NavLinkProps = {
  to: string;
  end?: boolean;
  className?: string | ((props: NavLinkRenderProps) => string);
  children: ReactNode;
};

export type NavLink = ComponentType<NavLinkProps>;
