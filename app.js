const API_PAISES = "https://restcountries.com/v3.1/all?fields=name,translations,capital,capitalInfo,region,population,flags,languages,currencies,cca3";
const REGIONES = { Todos: "", Américas: "Americas", Europa: "Europe", Asia: "Asia", África: "Africa", Oceanía: "Oceania" };
const CLIMA = { 0:"Despejado",1:"Mayormente despejado",2:"Parcialmente nublado",3:"Nublado",45:"Niebla",48:"Niebla",51:"Llovizna",53:"Llovizna",55:"Llovizna",61:"Lluvia ligera",63:"Lluvia",65:"Lluvia fuerte",71:"Nieve",73:"Nieve",75:"Nieve fuerte",80:"Chubascos",81:"Chubascos",82:"Chubascos fuertes",95:"Tormenta",96:"Tormenta",99:"Tormenta" };
const PAGE = 12;

const $ = (s) => document.querySelector(s);
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

let paises = [], region = "", texto = "", visibles = PAGE;

const nombre = (p) => p.translations?.spa?.common || p.name.common;
const fmt = (n) => new Intl.NumberFormat("es").format(n);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

/* ---------- Países ---------- */
async function cargarPaises() {
  try {
    const r = await fetch(API_PAISES);
    if (!r.ok) throw new Error(r.status);
    paises = (await r.json()).sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
    $("#dest-list").innerHTML = paises.map((p) => `<option value="${esc(nombre(p))}">`).join("");
    pintar();
    pintarFavs();
  } catch {
    $("#status").textContent = "No pudimos cargar los países. Revisa tu conexión y recarga la página.";
  }
}

function filtrados() {
  const t = texto.trim().toLowerCase();
  return paises.filter((p) => (!region || p.region === region) &&
    (!t || nombre(p).toLowerCase().includes(t) || p.name.common.toLowerCase().includes(t)));
}

function tarjeta(p) {
  const fav = store.get("favoritos").includes(p.cca3);
  return `<article class="card">
    <img class="flag" src="${p.flags.svg}" alt="Bandera de ${esc(nombre(p))}" loading="lazy">
    <div class="body"><h3>${esc(nombre(p))}</h3>
      <span class="meta">Capital: ${esc(p.capital?.[0] || "—")}</span>
      <span class="meta">Región: ${esc(p.region)}</span>
      <span class="meta">Población: ${fmt(p.population)}</span></div>
    <div class="actions">
      <button data-ver="${p.cca3}">Ver detalles</button>
      <button class="fav" data-fav="${p.cca3}" aria-pressed="${fav}" aria-label="${fav ? "Quitar de" : "Agregar a"} favoritos: ${esc(nombre(p))}">${fav ? "♥" : "♡"}</button>
    </div></article>`;
}

function pintar() {
  const lista = filtrados();
  $("#grid").innerHTML = lista.slice(0, visibles).map(tarjeta).join("");
  $("#status").textContent = lista.length ? `${lista.length} destinos` : "No hay países con esa búsqueda. Prueba con otro nombre o región.";
  $("#more").hidden = lista.length <= visibles;
}


function toggleFav(id) {
  let f = store.get("favoritos");
  f = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
  store.set("favoritos", f);
  pintar(); pintarFavs();
}
function pintarFavs() {
  const f = store.get("favoritos");
  $("#fav-count").textContent = f.length;
  $("#fav-empty").hidden = f.length > 0;
  $("#fav-grid").innerHTML = paises.filter((p) => f.includes(p.cca3)).map(tarjeta).join("");
}

/* ---------- Detalle + clima ---------- */
async function coordenadas(p) {
  if (p.capitalInfo?.latlng) return p.capitalInfo.latlng;
  const q = encodeURIComponent(`${p.capital?.[0] || ""} ${p.name.common}`);
  const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
  const d = await r.json();
  if (!d[0]) throw new Error("sin coordenadas");
  return [+d[0].lat, +d[0].lon];
}

async function abrirDetalle(id) {
  const p = paises.find((x) => x.cca3 === id);
  const dlg = $("#detail");
  const idiomas = Object.values(p.languages || {}).join(", ") || "—";
  const monedas = Object.values(p.currencies || {}).map((m) => `${m.name} (${m.symbol || ""})`).join(", ") || "—";
  dlg.innerHTML = `<button class="close" aria-label="Cerrar">✕</button>
    <div class="d-top"><img src="${p.flags.svg}" alt="Bandera de ${esc(nombre(p))}">
      <div><h2 id="d-title">${esc(nombre(p))}</h2><span class="meta">${esc(p.name.official || p.name.common)}</span></div></div>
    <div class="d-body">
      <dl><dt>Capital</dt><dd>${esc(p.capital?.[0] || "—")}</dd>
        <dt>Región</dt><dd>${esc(p.region)}</dd>
        <dt>Población</dt><dd>${fmt(p.population)}</dd>
        <dt>Idiomas</dt><dd>${esc(idiomas)}</dd>
        <dt>Moneda</dt><dd>${esc(monedas)}</dd></dl>
      <div id="clima"><p class="status">Cargando clima…</p></div>
    </div>`;
  dlg.showModal();
  dlg.querySelector(".close").onclick = () => dlg.close();
  try {
    const [lat, lon] = await coordenadas(p);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(r.status);
    const w = await r.json();
    const dias = w.daily.time.map((t, i) => `<div class="day"><b>${new Date(t + "T12:00").toLocaleDateString("es", { weekday: "short" })}</b>${Math.round(w.daily.temperature_2m_max[i])}° / ${Math.round(w.daily.temperature_2m_min[i])}°<br>💧 ${w.daily.precipitation_probability_max[i] ?? 0}%</div>`).join("");
    $("#clima").innerHTML = `<h3>Clima en ${esc(p.capital?.[0] || nombre(p))}</h3>
      <div class="now"><strong>${Math.round(w.current.temperature_2m)} °C</strong>
        <span>${CLIMA[w.current.weather_code] || "—"}</span>
        <span>Viento: ${Math.round(w.current.wind_speed_10m)} km/h</span>
        <span>Lluvia hoy: ${w.daily.precipitation_probability_max[0] ?? 0}%</span></div>
      <div class="days">${dias}</div>`;
  } catch {
    $("#clima").innerHTML = `<p class="status">No pudimos cargar el clima de este destino. Intenta de nuevo en un momento.</p>`;
  }
}

/* ---------- Formulario e itinerario ---------- */
const campos = ["t-name", "t-dest", "t-start", "t-end", "t-people", "t-budget"];
function validar() {
  let ok = true;
  const hoy = new Date().toISOString().slice(0, 10);
  const msg = {
    "t-name": (v) => v.trim().length < 3 ? "Escribe un nombre de al menos 3 letras." : "",
    "t-dest": (v) => paises.some((p) => nombre(p).toLowerCase() === v.trim().toLowerCase()) ? "" : "Elige un país de la lista.",
    "t-start": (v) => !v ? "Elige la fecha de inicio." : v < hoy ? "La fecha de inicio no puede ser pasada." : "",
    "t-end": (v) => !v ? "Elige la fecha de fin." : v < $("#t-start").value ? "La fecha de fin debe ser posterior al inicio." : "",
    "t-people": (v) => (+v >= 1 && +v <= 20) ? "" : "Indica entre 1 y 20 viajeros.",
    "t-budget": (v) => (v !== "" && +v >= 0) ? "" : "Escribe un presupuesto (puede ser 0).",
  };
  campos.forEach((id) => {
    const el = $("#" + id), e = msg[id](el.value);
    el.classList.toggle("invalid", !!e);
    el.setAttribute("aria-invalid", !!e);
    el.parentElement.querySelector(".err").textContent = e;
    if (e) ok = false;
  });
  return ok;
}

function pintarViajes() {
  const v = store.get("viajes");
  $("#trips-empty").hidden = v.length > 0;
  $("#trips").querySelectorAll(".trip").forEach((n) => n.remove());
  v.forEach((t) => {
    const d = document.createElement("article");
    d.className = "trip";
    d.innerHTML = `<h3>${esc(t.nombre)}</h3>
      <p class="meta">${esc(t.destino)} · ${t.inicio} a ${t.fin} · ${t.viajeros} viajero(s) · USD ${fmt(t.presupuesto)}</p>
      ${t.notas ? `<p>${esc(t.notas)}</p>` : ""}
      <ul>${t.actividades.map((a, i) => `<li>${esc(a)} <button class="small" data-quitar="${t.id}:${i}" aria-label="Quitar actividad">✕</button></li>`).join("")}</ul>
      <form data-add="${t.id}"><input aria-label="Nueva actividad" placeholder="Ej. Día 1: visitar el centro" required maxlength="80"><button class="small">Agregar</button></form>
      <button class="small" data-borrar="${t.id}">Eliminar viaje</button>`;
    $("#trips").appendChild(d);
  });
}

/* ---------- Eventos ---------- */
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.ver) abrirDetalle(b.dataset.ver);
  if (b.dataset.fav) toggleFav(b.dataset.fav);
  if (b.dataset.region !== undefined) {
    region = b.dataset.region; visibles = PAGE;
    document.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === b));
    pintar();
  }
  if (b.dataset.borrar) { store.set("viajes", store.get("viajes").filter((t) => t.id != b.dataset.borrar)); pintarViajes(); }
  if (b.dataset.quitar) {
    const [id, i] = b.dataset.quitar.split(":");
    const v = store.get("viajes"); v.find((t) => t.id == id).actividades.splice(+i, 1);
    store.set("viajes", v); pintarViajes();
  }
});
$("#more").onclick = () => { visibles += PAGE; pintar(); };
$("#search-form").onsubmit = (e) => { e.preventDefault(); texto = $("#q").value; visibles = PAGE; pintar(); $("#explorar").scrollIntoView(); };
$("#q").oninput = (e) => { texto = e.target.value; visibles = PAGE; pintar(); };
$("#detail").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

$("#trips").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = e.target.dataset.add, inp = e.target.querySelector("input");
  const v = store.get("viajes"); v.find((t) => t.id == id).actividades.push(inp.value.trim());
  store.set("viajes", v); pintarViajes();
});

$("#trip-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!validar()) { $("#form-ok").textContent = ""; $(".invalid")?.focus(); return; }
  const v = store.get("viajes");
  v.push({ id: Date.now(), nombre: $("#t-name").value.trim(), destino: $("#t-dest").value.trim(), inicio: $("#t-start").value, fin: $("#t-end").value,
    viajeros: +$("#t-people").value, presupuesto: +$("#t-budget").value, notas: $("#t-notes").value.trim(), actividades: [] });
  store.set("viajes", v);
  e.target.reset(); $("#t-people").value = 1;
  $("#form-ok").textContent = "Viaje guardado. Agrega actividades abajo.";
  pintarViajes();
});

$("#filters").innerHTML = Object.entries(REGIONES).map(([n, v]) => `<button class="chip" data-region="${v}" aria-pressed="${v === ""}">${n}</button>`).join("");
pintarViajes();
cargarPaises();
