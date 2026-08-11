"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      router.push("/findings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#052b20] px-4 py-8 text-white">
      <Image
        src="/images/portada-editorial.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-[0.46]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#052b20_0%,rgba(5,43,32,.94)_48%,rgba(5,43,32,.48)_100%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-6xl items-center">
        <div className="hidden max-w-xl pr-10 lg:block">
          <Image
            src="/images/uix-logo.png"
            alt="uix"
            width={82}
            height={29}
            className="h-auto w-[82px]"
          />
          <p className="mt-10 text-xs font-semibold uppercase text-[#7bf0b1]">
            Plataforma de evidencias
          </p>
          <h1 className="mt-4 text-6xl font-bold leading-none">
            Del hallazgo a la acción.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-white/74">
            Accede al inventario dinámico para priorizar, validar y cerrar observaciones con contexto visual.
          </p>
        </div>

        <div className="ml-auto w-full max-w-md">
          <div className="pm-card p-6 text-[#17251f] sm:p-8">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#087244]">
                  Acceso seguro
                </p>
                <h2 className="mt-2 text-3xl font-bold text-[#17251f]">
                  Pruebas María 2.0
                </h2>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#e0f5e9] text-[#087244]">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-[#f1c8bd] bg-[#fff0eb] p-3 text-sm font-medium text-[#9b321f]">
                {error}
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#3b4b43]">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65766e]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pm-input h-12 w-full pl-10 pr-4 text-sm placeholder:text-[#7d9087] focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#3b4b43]">
                Contraseña
              </label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65766e]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pm-input h-12 w-full pl-10 pr-4 text-sm placeholder:text-[#7d9087] focus:outline-none focus:ring-2 focus:ring-[#00a85a]"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-[#a8bab0] text-[#052b20] focus-visible:ring-2 focus-visible:ring-[#00a85a]"
              />
              <span className="text-sm font-medium text-[#65766e]">
                Recordarme por 30 días
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#052b20] px-4 text-sm font-semibold text-white transition hover:bg-[#087244] disabled:bg-[#7d9087]"
            >
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
            </form>

            <p className="mt-5 text-center text-sm text-[#65766e]">
              ¿Necesitas ayuda? Contacta al administrador
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
