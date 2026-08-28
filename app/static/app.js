"use strict";

// 색 토큰 (CSS 변수명)
const MODE_VAR = { eco: "--eco", normal: "--normal", sport: "--sport" };
let selectedMode = "normal";
let lastData = null;

// ---- 입력 수집 --------------------------------------------------------------
function readInputs() {
  const payload = {
    speed_min_kmh: window.__SPEED__.min,
    speed_max_kmh: window.__SPEED__.max,
  };
  document.querySelectorAll("#inputCard input[type=range]").forEach((el) => {
    payload[el.name] = parseFloat(el.value);
  });
  return payload;
}

function syncVals() {
  document.querySelectorAll("#inputCard input[type=range]").forEach((el) => {
    const out = document.getElementById("v-" + el.name);
    if (!out) return;
    const step = parseFloat(el.step) || 1;
    const v = parseFloat(el.value);
    out.textContent = step < 1 ? v.toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v));
  });
}

// ---- 유틸 -----------------------------------------------------------------
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
function modeColor(mode) { return cssVar(MODE_VAR[mode]); }

function hoursText(h) {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60), mm = m % 60;
  if (hh === 0) return `${mm}분`;
  return mm ? `${hh}시간 ${mm}분` : `${hh}시간`;
}
function etaText(h) {
  const d = new Date(Date.now() + h * 3600 * 1000);
  const hh = d.getHours(), mm = String(d.getMinutes()).padStart(2, "0");
  const ap = hh < 12 ? "오전" : "오후";
  const h12 = ((hh + 11) % 12) + 1;
  return `${ap} ${h12}:${mm}`;
}
function deltaSpan(v, unit, digits) {
  const eps = unit === "분" ? 0.5 : 0.05;
  if (Math.abs(v) < eps) return `±0 ${unit}`;
  const cls = v > 0 ? "up" : "down";
  const sign = v > 0 ? "+" : "−";
  return `<span class="${cls}">${sign}${Math.abs(v).toFixed(digits)} ${unit}</span>`;
}

// ---- 렌더 ----------------------------------------------------------------
function renderBanner(warnings) {
  const box = document.getElementById("banner");
  if (!warnings.length) { box.hidden = true; box.querySelector("#bannerBody").innerHTML = ""; return; }
  box.hidden = false;
  document.getElementById("bannerBody").innerHTML =
    "입력이 학습 범위를 벗어나 보정했어요.<ul>" +
    warnings.map((w) => `<li>${w}</li>`).join("") + "</ul>";
}

function renderHero(data) {
  const m = data.modes.find((x) => x.mode === selectedMode);
  const minE = Math.min(...data.curve.total_energy_kwh);
  const budget = data.curve.energy_budget_by_mode[selectedMode];

  document.getElementById("heroDot").style.background = modeColor(selectedMode);
  document.getElementById("heroMode").textContent = m.label + " 모드";
  document.getElementById("heroSpeed").textContent = m.speed_kmh_rounded5;
  document.getElementById("heroSay").textContent =
    `${Math.round(data.distance_km)} km를 ${hoursText(m.time_h)}에, 약 ${m.total_energy_kwh.toFixed(1)} kWh로 갑니다. ` +
    `(전비 ${m.energy_kwh_per_100km.toFixed(1)} kWh/100km)`;
  document.getElementById("heroEta").textContent = etaText(m.time_h);
  document.getElementById("heroTime").textContent = hoursText(m.time_h);
  document.getElementById("heroEnergy").textContent = m.total_energy_kwh.toFixed(1) + " kWh";
  document.getElementById("heroFlag").hidden = !m.hit_speed_cap;

  document.getElementById("whyText").innerHTML =
    `이 조건에서 에너지를 가장 아끼는 속도는 <span class="mono">${window.__SPEED__.min} km/h</span> ` +
    `(총 <span class="mono">${minE.toFixed(1)} kWh</span>) 입니다. ` +
    `<b>${m.label}</b> 모드는 그보다 <b>+${Math.round(m.energy_tolerance * 100)}%</b> ` +
    `(<span class="mono">${budget.toFixed(1)} kWh</span>)까지 더 쓰는 걸 허용하고, ` +
    `그 예산 안에서 <b>가장 빠른 속도</b>인 <span class="mono">${m.speed_kmh} km/h</span> 를 고릅니다.` +
    (m.hit_speed_cap ? " 예산이 넉넉해 속도 상한에 먼저 닿았어요 — 참고용으로 보세요." : "");
}

function renderAlts(data) {
  const sel = data.modes.find((x) => x.mode === selectedMode);
  const others = data.modes.filter((x) => x.mode !== selectedMode);
  document.getElementById("altRow").innerHTML = others.map((o) => {
    const dt = o.time_min - sel.time_min;
    const de = o.total_energy_kwh - sel.total_energy_kwh;
    return `<div class="alt-item ${o.mode}">
      <div class="name"><span class="bar"></span>${o.label}</div>
      <div class="big">${o.speed_kmh_rounded5}<span class="u">km/h</span></div>
      <div class="delta">${sel.label} 대비 ${deltaSpan(dt, "분", 0)} · ${deltaSpan(de, "kWh", 1)}</div>
    </div>`;
  }).join("");
}

function renderChartNote(data) {
  const b = data.curve.energy_budget_by_mode;
  document.getElementById("chartNote").innerHTML = data.modes.map((m) =>
    `<span class="k"><i style="background:${modeColor(m.mode)}"></i>` +
    `${m.label} 예산 ${b[m.mode].toFixed(1)} kWh → ${m.speed_kmh} km/h</span>`
  ).join("") + `<span class="k" style="color:var(--muted)">◯ = 지금 선택</span>`;
}

// ---- 속도별 총에너지 차트 (Canvas, 의존성 없음) -----------------------------
function drawChart() {
  if (!lastData) return;
  const data = lastData;
  const cv = document.getElementById("chart");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = cv.clientWidth || 640, cssH = 300;
  cv.width = cssW * dpr; cv.height = cssH * dpr;
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 52, r: 14, t: 16, b: 38 };
  const xs = data.curve.speed_kmh;
  const ys = data.curve.total_energy_kwh;
  const budgets = Object.values(data.curve.energy_budget_by_mode);
  const xMin = xs[0], xMax = xs[xs.length - 1];
  let yMin = Math.min(...ys), yMax = Math.max(Math.max(...ys), ...budgets);
  const ypad = (yMax - yMin) * 0.1 || 1;
  yMin -= ypad; yMax += ypad;
  const X = (v) => pad.l + (v - xMin) / (xMax - xMin) * (cssW - pad.l - pad.r);
  const Y = (v) => cssH - pad.b - (v - yMin) / (yMax - yMin) * (cssH - pad.t - pad.b);

  const line = cssVar("--line"), muted = cssVar("--muted"), ink = cssVar("--ink");
  const accent = cssVar("--accent"), surface = cssVar("--surface");

  ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';

  // y 그리드 + 라벨
  ctx.fillStyle = muted;
  for (let i = 0; i <= 4; i++) {
    const yy = (yMin + ypad) + (yMax - yMin - 2 * ypad) * i / 4;
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(yy)); ctx.lineTo(cssW - pad.r, Y(yy)); ctx.stroke();
    ctx.fillText(yy.toFixed(0), 16, Y(yy) + 3);
  }
  // x 라벨 (20 km/h 간격)
  for (let v = Math.ceil(xMin / 20) * 20; v <= xMax; v += 20) {
    ctx.fillStyle = muted; ctx.fillText(String(v), X(v) - 7, cssH - pad.b + 16);
  }
  ctx.fillStyle = muted;
  ctx.fillText("총 에너지 (kWh)", pad.l - 40, pad.t - 3);
  ctx.fillText("순항 속도 (km/h) →", cssW - pad.r - 118, cssH - 8);

  // 총에너지 곡선 + 면
  ctx.beginPath();
  xs.forEach((v, i) => { const px = X(v), py = Y(ys[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.lineTo(X(xMax), Y(yMin)); ctx.lineTo(X(xMin), Y(yMin)); ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, cssH - pad.b);
  grad.addColorStop(0, accent + "20"); grad.addColorStop(1, accent + "00");
  ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  xs.forEach((v, i) => { const px = X(v), py = Y(ys[i]); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.stroke();

  // 모드별 예산선(점선) + 추천 속도 점
  data.modes.forEach((m) => {
    const col = modeColor(m.mode);
    const by = Y(data.curve.energy_budget_by_mode[m.mode]);
    const sx = X(m.speed_kmh);
    ctx.strokeStyle = col; ctx.lineWidth = m.mode === selectedMode ? 2 : 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, by); ctx.lineTo(cssW - pad.r, by); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(sx, by, m.mode === selectedMode ? 5 : 4, 0, 7);
    ctx.fillStyle = col; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = surface; ctx.stroke();
  });

  // 현재 선택 강조 링
  const sel = data.modes.find((x) => x.mode === selectedMode);
  ctx.beginPath();
  ctx.arc(X(sel.speed_kmh), Y(data.curve.energy_budget_by_mode[selectedMode]), 9, 0, 7);
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.stroke();
}

// ---- 통신 --------------------------------------------------------------
let timer = null;
async function refresh() {
  syncVals();
  let res;
  try {
    res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readInputs()),
    });
  } catch (e) { console.error(e); return; }
  if (!res.ok) { console.error(await res.text()); return; }
  const data = await res.json();
  lastData = data;
  renderBanner(data.warnings);
  renderHero(data);
  renderAlts(data);
  renderChartNote(data);
  drawChart();
}
function debouncedRefresh() { clearTimeout(timer); timer = setTimeout(refresh, 150); }

// ---- 이벤트 ------------------------------------------------------------------
document.getElementById("inputCard").addEventListener("input", (e) => {
  if (e.target.matches('input[type="range"]')) { syncVals(); debouncedRefresh(); }
});
document.getElementById("modes").addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-btn");
  if (!btn) return;
  document.querySelectorAll(".mode-btn").forEach((b) => b.setAttribute("aria-pressed", "false"));
  btn.setAttribute("aria-pressed", "true");
  selectedMode = btn.dataset.mode;
  if (lastData) {
    renderHero(lastData); renderAlts(lastData); renderChartNote(lastData); drawChart();
  } else refresh();
});
document.getElementById("resetBtn").addEventListener("click", () => {
  document.querySelectorAll("#inputCard input[type=range]").forEach((el) => { el.value = el.defaultValue; });
  refresh();
});

// 테마 토글
const rootEl = document.documentElement;
function applyThemeLabel() {
  const explicit = rootEl.getAttribute("data-theme");
  const dark = explicit ? explicit === "dark"
    : window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.getElementById("themeIcon").textContent = dark ? "☾" : "☀";
  document.getElementById("themeLabel").textContent = dark ? "다크" : "라이트";
}
document.getElementById("themeBtn").addEventListener("click", () => {
  const cur = rootEl.getAttribute("data-theme");
  const dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  rootEl.setAttribute("data-theme", dark ? "light" : "dark");
  applyThemeLabel();
  drawChart();
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyThemeLabel(); drawChart(); });
window.addEventListener("resize", drawChart);

applyThemeLabel();
syncVals();
refresh();
