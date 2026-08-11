"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";

export function UserMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  if (!user) {
    return (
      <button
        onClick={() => router.push("/login")}
        className="h-9 rounded-full bg-white px-4 text-xs font-semibold text-[#052b20] transition hover:bg-[#7bf0b1]"
      >
        Iniciar Sesión
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 items-center gap-2 rounded-full border border-white/14 bg-white/8 px-2.5 pr-3 text-white transition hover:bg-white/14"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7bf0b1] text-xs font-bold text-[#052b20]">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <span className="hidden text-xs font-semibold text-white sm:inline">
          {user.name}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-[#dbe4dd] bg-white shadow-xl">
          <div className="border-b border-[#dbe4dd] p-3">
            <p className="text-sm font-semibold text-[#17251f]">
              {user.name}
            </p>
            <p className="mt-1 truncate text-xs text-[#65766e]">
              {user.email}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-[#e0f5e9] px-2 py-1 text-xs font-semibold text-[#087244]">
              Rol: {user.role}
            </p>
          </div>

          <button
            onClick={() => router.push("/profile")}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-[#17251f] transition hover:bg-[#f3f5ef]"
          >
            <UserRound className="h-4 w-4" />
            Mi Perfil
          </button>

          <button
            onClick={async () => {
              await logout();
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 border-t border-[#dbe4dd] px-4 py-2.5 text-left text-sm text-[#9b321f] transition hover:bg-[#fff0eb]"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      )}
    </div>
  );
}
