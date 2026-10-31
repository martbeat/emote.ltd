(() => {
  const key = 'emote_theme';
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Use the browser preference. */ }
  const theme = saved === 'light' || saved === 'dark' ? saved :
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  function initialise() {
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem(key, next); } catch { /* This visit still uses the chosen theme. */ }
    });
    document.getElementById('year').textContent = new Date().getFullYear();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, {once: true});
  else initialise();
})();
