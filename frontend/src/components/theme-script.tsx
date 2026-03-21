/**
 * Server component -- renders an inline script in <head> for flash-free
 * theme detection before React hydrates. Must NOT have "use client".
 *
 * Uses next/script with beforeInteractive strategy to avoid the
 * "script tag while rendering React component" console warning.
 *
 * Priority: localStorage "theme" value > OS prefers-color-scheme.
 * Valid stored values: "dark", "light", "system" (or absent).
 * When stored value is "system" or absent, the OS preference wins.
 */
import Script from "next/script";

const themeInitScript = `(function(){try{var s=localStorage.getItem("theme");var prefersDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=(s==="dark")||(s!=="light"&&prefersDark);document.documentElement.classList.toggle("dark",dark)}catch(e){}})()`;

export function ThemeScript() {
  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}
