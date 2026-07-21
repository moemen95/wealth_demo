"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns2, Home, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function TopBar({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-4 border-b bg-background/80 px-4 py-3 backdrop-blur">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <TrendingUp className="h-5 w-5 text-primary" />
        Wealth Insights
      </Link>

      <nav className="flex items-center gap-1 text-sm">
        <NavLink href="/" active={pathname === "/"} icon={Home}>
          Demo
        </NavLink>
        <NavLink href="/compare" active={pathname === "/compare"} icon={Columns2}>
          Compare
        </NavLink>
      </nav>

      <div className="ml-auto flex items-center gap-3">{children}</div>
    </header>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: typeof Home;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
        active ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {children}
    </Link>
  );
}
