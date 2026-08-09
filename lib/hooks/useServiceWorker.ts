"use client";

import { useEffect, useState } from "react";

export interface ServiceWorkerStatus {
  isSupported: boolean;
  isRegistered: boolean;
  isActive: boolean;
  updateAvailable: boolean;
}

export function useServiceWorker() {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    isSupported: false,
    isRegistered: false,
    isActive: false,
    updateAvailable: false,
  });

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setStatus((prev) => ({ ...prev, isSupported: false }));
      return;
    }

    setStatus((prev) => ({ ...prev, isSupported: true }));
    registerServiceWorker();
  }, []);

  const registerServiceWorker = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        setStatus((prev) => ({
          ...prev,
          isRegistered: true,
          isActive: !!registration.active,
        }));

        // Escuchar updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setStatus((prev) => ({ ...prev, updateAvailable: true }));
              // Notificar al usuario que hay update
              window.dispatchEvent(
                new CustomEvent("sw-update-available", { detail: registration })
              );
            }
          });
        });

        // Escuchar mensaje del service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data.type === "sync-complete") {
            window.dispatchEvent(
              new CustomEvent("sync-complete", { detail: event.data })
            );
          }
        });
      }
    } catch (err) {
      console.error("Failed to register service worker:", err);
      setStatus((prev) => ({ ...prev, isRegistered: false }));
    }
  };

  const unregister = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        setStatus((prev) => ({
          ...prev,
          isRegistered: false,
          isActive: false,
        }));
      }
    } catch (err) {
      console.error("Failed to unregister service worker:", err);
    }
  };

  const update = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.update();
        }
      }
    } catch (err) {
      console.error("Failed to update service worker:", err);
    }
  };

  const skipWaiting = async () => {
    try {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SKIP_WAITING",
        });
        setStatus((prev) => ({ ...prev, updateAvailable: false }));
      }
    } catch (err) {
      console.error("Failed to skip waiting:", err);
    }
  };

  return {
    status,
    registerServiceWorker,
    unregister,
    update,
    skipWaiting,
  };
}
