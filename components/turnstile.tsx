"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";

export interface TurnstileRef {
  reset: () => void;
}

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: any) => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (error: any) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export const Turnstile = forwardRef<TurnstileRef, TurnstileProps>(
  ({ onVerify, onExpire, onError, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const { resolvedTheme } = useTheme();

    // 使用 Ref 稳定化外部传入的回调函数，杜绝因父组件重渲染引发的死循环刷新
    const onVerifyRef = useRef(onVerify);
    onVerifyRef.current = onVerify;
    const onExpireRef = useRef(onExpire);
    onExpireRef.current = onExpire;
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;

    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }));

    useEffect(() => {
      if (!siteKey) return;

      const scriptId = "cf-turnstile-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src =
          "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.onload = () => setIsLoaded(true);
        document.head.appendChild(script);
      } else if (window.turnstile) {
        setIsLoaded(true);
      } else {
        const existingScript = document.getElementById(scriptId);
        existingScript?.addEventListener("load", () => setIsLoaded(true));
      }
    }, [siteKey]);

    useEffect(() => {
      if (!isLoaded || !containerRef.current || !siteKey || !window.turnstile)
        return;

      // 如果已有已渲染的组件，先清理旧组件
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch {
          // ignore
        }
      }

      try {
        const widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: resolvedTheme === "dark" ? "dark" : "light",
          callback: (token: string) => {
            onVerifyRef.current?.(token);
          },
          "expired-callback": () => {
            onExpireRef.current?.();
          },
          "error-callback": (error: any) => {
            onErrorRef.current?.(error);
          },
        });
        widgetIdRef.current = widgetId;
      } catch (err) {
        console.error("[Turnstile render error]", err);
      }

      return () => {
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
          } catch {
            // ignore
          }
        }
      };
    }, [isLoaded, siteKey, resolvedTheme]);

    if (!siteKey) return null;

    return (
      <div className={className || "my-2 flex justify-center min-h-[65px]"}>
        <div ref={containerRef} />
      </div>
    );
  },
);

Turnstile.displayName = "Turnstile";
