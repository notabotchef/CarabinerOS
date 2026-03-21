/**
 * Server component — renders an inline script in <head> for flash-free
 * theme detection before React hydrates. Must NOT have "use client".
 */
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"){document.documentElement.classList.remove("dark")}}catch(e){}})()`;

export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
      suppressHydrationWarning
    />
  );
}
