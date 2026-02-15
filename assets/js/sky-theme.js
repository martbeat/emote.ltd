(function(){
  const REFRESH_MS = 20 * 60 * 1000;
  const CACHE_KEY = "emoteSkyThemeCache";

  function weatherBucket(code){
    if (code === 0) return "clear";
    if ([1,2,3].includes(code)) return "cloudy";
    if ([45,48].includes(code)) return "fog";
    if ([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code)) return "rain";
    if ([71,73,75,77,85,86].includes(code)) return "snow";
    if ([95,96,99].includes(code)) return "storm";
    return "clear";
  }

  function applyTheme(isDay, weather){
    const theme = isDay ? "day" : "night";
    document.documentElement.dataset.skyTheme = theme;
    document.documentElement.dataset.skyWeather = weather || "clear";
    if (document.body){
      document.body.dataset.skyTheme = theme;
      document.body.dataset.skyWeather = weather || "clear";
    }
  }

  function applyFallback(){
    const h = new Date().getHours();
    applyTheme(h >= 7 && h < 19, "clear");
  }

  async function getCoordsByIp(){
    const a = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (a.ok){
      const d = await a.json();
      const lat = Number(d.latitude), lon = Number(d.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }

    const b = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (b.ok){
      const d = await b.json();
      const lat = Number(d.latitude), lon = Number(d.longitude);
      if (d.success && Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
    }
    throw new Error("ip lookup failed");
  }

  async function refreshTheme(){
    try {
      const now = Date.now();
      const cachedRaw = localStorage.getItem(CACHE_KEY);
      if (cachedRaw){
        const cached = JSON.parse(cachedRaw);
        if (cached && now - Number(cached.ts || 0) < REFRESH_MS && cached.theme){
          applyTheme(cached.theme === "day", cached.weather);
          return;
        }
      }

      const { lat, lon } = await getCoordsByIp();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=is_day,weather_code&timezone=auto`;
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) throw new Error("weather failed");
      const data = await resp.json();
      const current = data && data.current ? data.current : {};
      const isDay = Number(current.is_day) === 1;
      const weather = weatherBucket(Number(current.weather_code));
      applyTheme(isDay, weather);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: now, theme: isDay ? "day" : "night", weather }));
    } catch {
      applyFallback();
    }
  }

  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", refreshTheme, { once:true });
  } else {
    refreshTheme();
  }
})();
