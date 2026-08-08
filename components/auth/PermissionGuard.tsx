"use client";

import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";

interface PermissionGuardProps {
  allowedRoles: string[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({
  allowedRoles,
  children,
  fallback,
}: PermissionGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="text-slate-500 dark:text-slate-400">Cargando...</div>;
  }

  if (!user) {
    return fallback || null;
  }

  if (!allowedRoles.includes(user.role)) {
    return fallback || null;
  }

  return <>{children}</>;
}
