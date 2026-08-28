"use strict";

const MODE_COLORS = { eco: "#34d399", normal: "#60a5fa", sport: "#f87171" };
let selectedMode = "normal";

// ---- 입력 수집 --------------------------------------------------------------
function readInputs() {
  const payload = { speed_min_kmh: window.__SPEED__.min, speed_max_kmh: window.__SPEED__.max };
  document.querySelectorAll("#input-panel input[type=range]").forEach((el) => {
    payload[el.name] = parseFloat(el.value);
  });
  return payload;
}

function syncOutputs() {
  document.querySelectorAll("#input-panel input[type=range]").forEach((el) => {
    const out = document.getElementById("o-" + el.name);
    if (out) out.textContent = el.value;
  });
}

// ---- 렌더링 ----------------------------------------------------------------
function renderWarnings(warnings) {
  const box = document.getElementById("warnings");
  if (!warnings.length) { box.innerHTML = ""; return; }
  box.innerHTML = "입력이 학습 범위를 벗어나 보정되었습니다.<ul>" +
    warnings.map((w) => `<li>${w}</li>`).join("") + "</ul>";
}

function fmtDelta(v, unit) {
  if (v === 0) return `±0${unit}`;
  const cls = v > 0 ? "pos" : "neg";
  return `<span class="delta ${cls}">${v > 0 ? "+" : ""}${v}${unit}</span>`;
}

function renderCards(data) {
  const wrap = document.getElementById("cards");
  document.getElementById("dist-label").textContent = `· ${data.distance_km} km 기준`;
  wrap.innerHTML = data.modes.map((m) => {
    const active = m.mode === selectedMode ? " style='outline:2px solid " + MODE_COLORS[m.mode] + "'" : "";
    return `
    <div class="card ${m.mode}"${active}>
      <h4>${m.label} <small style="color:var(--muted)">에너지 +${Math.round(m.energy_tolerance * 100)}% 허용</small></h4>
      <div class="speed">${m.speed_kmh_rounded5}<span> km/h</span></div>
      <dl>
        <div><dt>예상 전비</dt><dd>${m.energy_kwh_per_100km} kWh/100km</dd></div>
        <div><dt>총 에너지</dt><dd>${m.total_energy_kwh} kWh</dd></div>
        <div><dt>소요 시간</dt><dd>${m.time_h} h (${m.time_min}분)</dd></div>
        <div><dt>${data.baseline_mode === "normal" ? "노멀" : data.baseline_mode} 대비</dt>
          <dd>${fmtDelta(m.delta_time_min_vs_baseline, "분")} / ${fmtDelta(m.delta_energy_kwh_vs_baseline, "kWh")}</dd></div>
      </dl>
      ${m.hit_speed_cap ? '<p class="cap-warn">⚠ 속도 상한 도달 — 스윕 범위를 넓히면 더 빠른 값 가능</p>' : ""}
    </div>`;
  }).join("");
}

// ---- 간단한 라인 차트 (의존성 없음) --------------------------------------
// 총에너지(kWh) vs 속도 곡선 + 모드별 에너지 예산선 + 추천 속도 점
function drawChart(data) {
  const cv = document.getElementById("chart");
  const ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height, pad = { l: 52, r: 12, t: 12, b: 28 };
  ctx.clearRect(0, 0, W, H);

  const xs = data.curve.speed_kmh;
  const ys = data.curve.total_energy_kwh;
  const budgets = data.curve.energy_budget_by_mode;
  const xMin = xs[0], xMax = xs[xs.length - 1];
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  Object.values(budgets).forEach((b) => { yMin = Math.min(yMin, b); yMax = Math.max(yMax, b); });
  const px = (x) => pad.l + (x - xMin) / (xMax - xMin) * (W - pad.l - pad.r);
  const py = (y) => H - pad.b - (y - yMin) / (yMax - yMin || 1) * (H - pad.t - pad.b);

  // 축
  ctx.strokeStyle = "#2a3a4d"; ctx.fillStyle = "#93a4b7"; ctx.font = "11px system-ui";
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b); ctx.stroke();
  for (let x = 20; x <= xMax; x += 20) {
    ctx.fillText(x, px(x) - 6, H - pad.b + 14);
    ctx.strokeStyle = "#1b2735"; ctx.beginPath(); ctx.moveTo(px(x), pad.t); ctx.lineTo(px(x), H - pad.b); ctx.stroke();
  }
  ctx.fillStyle = "#93a4b7";
  ctx.fillText("총에너지(kWh)", 4, pad.t + 8);
  ctx.fillText("속도(km/h)", W - pad.r - 60, H - 6);

  // 총에너지 곡선
  ctx.strokeStyle = "#93a4b7"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ys.forEach((v, i) => (i ? ctx.lineTo(px(xs[i]), py(v)) : ctx.moveTo(px(xs[i]), py(v))));
  ctx.stroke();

  // 모드별 예산선 + 추천 속도 점
  data.modes.forEach((m) => {
    const b = budgets[m.mode];
    ctx.strokeStyle = MODE_COLORS[m.mode];
    ctx.lineWidth = m.mode === selectedMode ? 2.4 : 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(pad.l, py(b)); ctx.lineTo(W - pad.r, py(b)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = MODE_COLORS[m.mode];
    ctx.beginPath(); ctx.arc(px(m.speed_kmh), py(b), 4, 0, Math.PI * 2); ctx.fill();
  });

  document.getElementById("chart-legend").innerHTML = data.modes.map((m) =>
    `<span><b class="${m.mode}">●</b> ${m.label} → ${m.speed_kmh_rounded5} km/h${m.hit_speed_cap ? " ⚠상한" : ""}</span>`).join("");
}

// ---- 통신 ----------------------------------------------------------------
let timer = null;
async function refresh() {
  const res = await fetch("/api/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readInputs()),
  });
  if (!res.ok) { console.error(await res.text()); return; }
  const data = await res.json();
  renderWarnings(data.warnings);
  renderCards(data);
  drawChart(data);
}
function debouncedRefresh() { clearTimeout(timer); timer = setTimeout(refresh, 180); }

// ---- 초기화 ------------------------------------------------------------------
document.querySelectorAll("#input-panel input[type=range]").forEach((el) => {
  el.addEventListener("input", () => { syncOutputs(); debouncedRefresh(); });
});
document.querySelectorAll(".mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedMode = btn.dataset.mode;
    refresh();
  });
});
document.getElementById("reset-btn").addEventListener("click", () => {
  document.querySelectorAll("#input-panel input[type=range]").forEach((el) => {
    el.value = el.defaultValue;
  });
  syncOutputs(); refresh();
});

syncOutputs();
refresh();
