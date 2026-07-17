const themeInitializationScript = `
  (() => {
    const storageKey = "podgorica-daily-theme";
    const storedTheme = window.localStorage.getItem(storageKey);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const theme = storedTheme === "dark" || storedTheme === "light" ? storedTheme : systemTheme;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  })();
`;

function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />;
}

export { ThemeScript };
