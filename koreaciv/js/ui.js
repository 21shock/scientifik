import { ADVISORS, ICONS, KID_LENSES, LENS_KID, TOUR } from "./i18n.js"
import { esc, lensValue, moneyM, people, perPerson, num } from "./format.js"
import { buildSearchIndex, querySearch, withSido } from "./search.js"

const YIELDS = ["food", "prod", "gold", "sci", "cult"]

export function mountUI(app) {
  const { state, atlas, sites, meta, map } = app
  const dock = document.querySelector("#dock")
  const about = document.querySelector("#about")
  const yields = document.querySelector("#yields")
  const lensbar = document.querySelector("#lensbar")
  const legend = document.querySelector("#legend")
  const key = document.querySelector("#key")
  const search = document.querySelector("#search")
  const searchList = document.querySelector("#search-list")
  const tour = document.querySelector("#tour")

  function t() { return app.str() }
  function lang() { return state.lang }
  function name(row) { return lang() === "ko" ? row.ko : row.en }

  function yearNote(key) {
    const year = atlas.asOf?.[key]
    if (!year) return ""
    return lang() === "ko" ? `${year}년 기준` : `as of ${year}`
  }

  function paintChrome() {
    const s = t()
    document.documentElement.lang = lang()
    document.querySelector("#brand-name").textContent = s.brand
    document.querySelector("#brand-turn").textContent = `${people(atlas.nation.pop, lang())} · ${s.turn}`
    document.querySelector("#lang").textContent = lang() === "ko" ? "EN" : "한"
    document.querySelector("#about-btn").setAttribute("aria-label", s.about)
    search.placeholder = s.search
    yields.innerHTML = YIELDS.map((id) => {
      const value = atlas.nation.yields[id]
      const note = yearNote("grdp")
      return `<button class="yield" data-yield="${id}" type="button" title="${esc(s[id + "Hint"])} (${esc(note)})"><span class="emo">${ICONS[id]}</span><span>${s[id]}</span><b>${moneyM(value, lang())}</b></button>`
    }).join("")
    const quick = atlas.lenses.filter((lens) => KID_LENSES.includes(lens.id))
    lensbar.innerHTML = `
      <button type="button" data-lens="" aria-pressed="${state.lens ? "false" : "true"}"><span class="emo">🗺️</span>${s.off}</button>
      ${quick.map((lens) => {
        const kid = LENS_KID[lens.id]
        const asOf = atlas.lenses.find((item) => item.id === lens.id)?.asOf
        const note = asOf ? (lang() === "ko" ? `${asOf}년 기준` : `as of ${asOf}`) : ""
        return `<button type="button" data-lens="${lens.id}" aria-pressed="${state.lens?.id === lens.id}" title="${esc(lang() === "ko" ? kid.sayKo : kid.sayEn)} ${esc(note)}"><span class="emo">${kid.icon}</span>${esc(lang() === "ko" ? kid.shortKo : kid.shortEn)}</button>`
      }).join("")}
      <button type="button" data-dock="lenses"><span class="emo">🎨</span>${s.more}</button>
      <button type="button" class="grown" data-dock="grown"><span class="emo">🔎</span>${s.grown}<small style="font-size:12px">${s.grownSub}</small></button>`
    const terrain = s.terrain
    const swatches = [["🌾", 4, "#e2c44a"], ["🌲", 6, "#3aaa55"], ["⛰️", 7, "#b08968"], ["❄️", 8, "#f4f1ea"], ["🏙️", 5, "#f0b7a4"], ["🌊", 1, "#49c4f0"]]
    key.innerHTML = swatches.map(([emo, id, color]) => `<div><i class="sw" style="background:${color}"></i>${emo} ${terrain[id]}</div>`).join("")
    key.hidden = Boolean(state.lens)
    paintLegend()
  }

  function paintLegend() {
    const lens = state.lens
    if (!lens) { legend.hidden = true; return }
    legend.hidden = false
    const css = lens.scale === "div"
      ? "linear-gradient(90deg,#8c463a,#ece0c8,#246e60)"
      : "linear-gradient(90deg,#183e3a,#c49648,#f6ead0)"
    const kid = LENS_KID[lens.id]
    const title = kid ? `${kid.icon} ${lang() === "ko" ? kid.shortKo : kid.shortEn}` : (lang() === "ko" ? lens.ko : lens.en)
    const say = kid ? (lang() === "ko" ? kid.sayKo : kid.sayEn) : (lang() === "ko" ? lens.hintKo : lens.hintEn)
    legend.innerHTML = `
      <h3>${esc(title)}</h3>
      <p class="say">${esc(say)} ${esc(lens.asOf ? (lang() === "ko" ? `${lens.asOf}년 기준` : `As of ${lens.asOf}`) : "")}</p>
      <div class="ramp" style="background:${css}"></div>
      <div class="ramp-scale"><span>${esc(lensValue(lens.min, lens.unit, lang()))}</span><span>${esc(lensValue(lens.max, lens.unit, lang()))}</span></div>
      ${lens.imputed.some((flag) => flag) ? `<p class="tech">${esc(t().imputed)}</p>` : ""}`
  }

  function closeDock() {
    state.dock = null
    dock.hidden = true
  }

  function openDock(mode) {
    state.dock = mode
    render()
  }

  function badgeIcon(id) {
    return { industrial: "🏭", campus: "🔬", commercial: "🏪", harbor: "⚓", theater: "🎭", academy: "🏫", civic: "🏛️", medical: "🩺", leisure: "🍜", agrarian: "🌾", aerodrome: "✈️", mixed: "🎲" }[id] || "⭐"
  }

  const SECTOR_PLAIN = {
  ko: {
    agri: "농사(농림어업)", mine: "광산(광업)", mfg: "공장(제조업)", util: "전기·물(전기·가스·수도)",
    con: "건설(건설업)", trade: "가게(도소매)", trans: "나르기(운수·창고)", stay: "식당(숙박·음식)",
    ict: "컴퓨터(정보통신)", fin: "은행(금융·보험)", re: "건물(부동산)", sci: "연구(전문·과학)",
    gov: "나라 일(공공행정)", edu: "학교(교육)", health: "병원(보건·복지)", art: "오락산업(예술·스포츠)",
  },
  en: {
    agri: "Farms (agriculture)", mine: "Mines (mining)", mfg: "Factories (manufacturing)", util: "Power & water (utilities)",
    con: "Building (construction)", trade: "Shops (wholesale & retail)", trans: "Moving goods (transport)", stay: "Cafes (accommodation)",
    ict: "Computers (ICT)", fin: "Banks (finance)", re: "Buildings (real estate)", sci: "Research (professional)",
    gov: "Offices (public administration)", edu: "Schools (education)", health: "Hospitals (health)", art: "Entertainment industry (arts & sport)",
  },
}

  function header(title, sub) {
    return `<header><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ""}</div><button class="icon-x" data-close type="button">${esc(t().close)}</button></header>`
  }

  function sectorBars(shares) {
    const rows = atlas.sectors
      .map((sector) => ({ ...sector, share: shares[sector.id] }))
      .filter((sector) => sector.share != null)
      .sort((a, b) => b.share - a.share)
      .slice(0, 8)
    return `<div class="bars">${rows.map((sector) => `<div class="bar"><span>${esc(SECTOR_PLAIN[lang()][sector.id] || sector.ko)}</span><i><b style="width:${Math.min(100, sector.share * 100)}%"></b></i><span>${(sector.share * 100).toFixed(0)}%</span></div>`).join("")}</div>`
  }

  function sidoOf(id) {
    const row = atlas.sido.find((item) => item.id === id)
    return row ? name(row) : ""
  }

  function titled(label, sidoId) {
    return withSido(label, sidoOf(sidoId))
  }

  function cityBody(city) {
    const s = t()
    const members = city.members.map((index) => atlas.sigungu[index]).sort((a, b) => b.pop - a.pop)
    const districts = city.districts.map((item) => `<div class="card"><strong>${esc(badgeIcon(item.id))} ${esc(lang() === "ko" ? item.ko : item.en)}</strong><small>${item.lq != null ? `${lang() === "ko" ? "특화(LQ)" : "LQ"} ${item.lq} · ${(item.share * 100).toFixed(1)}%` : esc((item.because || []).join(", "))}</small></div>`).join("")
    const localSites = []
    for (const group of ["wonders", "airports", "ports", "plants"]) {
      for (const site of sites[group]) {
        if (site.sigungu == null) continue
        if (atlas.sigungu[site.sigungu].city === city.i) localSites.push(lang() === "ko" ? site.ko : site.en)
      }
    }
    return `
      ${header(titled(name(city), city.sido), name(city) === sidoOf(city.sido) ? "" : sidoOf(city.sido))}
      <div class="body">
        <span class="badge">${esc(badgeIcon(city.badge.id))} ${esc(lang() === "ko" ? city.badge.ko : city.badge.en)}</span>
        <div class="stats">
          <div class="stat"><span>${s.people} (${esc(yearNote("pop"))})</span><b>${people(city.pop, lang())}</b></div>
          <div class="stat"><span>${s.gold} (${esc(yearNote("grdp"))})</span><b>${moneyM(city.grdp, lang())}</b></div>
          <div class="stat"><span>${lang() === "ko" ? "한 사람이 버는 돈(1인당 GRDP)" : "Per person (GRDP/person)"}</span><b>${perPerson(city.grdpPc, lang())}</b></div>
        </div>
        <div class="yield-row">${YIELDS.map((id) => `<em>${s[id]} ${moneyM(city.yields[id], lang())} <small>(${esc(yearNote("grdp"))})</small></em>`).join("")}</div>
        <h3>${s.districts}</h3>
        <div class="cards">${districts || `<div class="card">${s.none}</div>`}</div>
        <h3>${s.sectors}</h3>
        ${sectorBars(city.shares)}
        <h3>${s.members}</h3>
        ${members.map((row) => `<button class="member" data-sig="${row.i}" type="button"><strong>${esc(row.koFull || row.ko)}</strong> · ${people(row.pop, lang())}${row.badge ? ` · ${esc(lang() === "ko" ? row.badge.ko : row.badge.en)}` : ""}${row.grdpScope === "city" ? ` · ${esc(s.imputed)}` : ""}${row.pin ? ` · pin` : ""}</button>`).join("")}
        <h3>${s.sites}</h3>
        <p>${localSites.length ? esc(localSites.slice(0, 12).join(" · ")) : esc(s.none)}</p>
      </div>`
  }

  function placeBody(row) {
    const s = t()
    const city = atlas.cities[row.city]
    const lensKid = state.lens && LENS_KID[state.lens.id]
    const lensName = lensKid ? (lang() === "ko" ? lensKid.shortKo : lensKid.shortEn) : (state.lens ? (lang() === "ko" ? state.lens.ko : state.lens.en) : "")
    const lensLine = state.lens ? `<div class="stat"><span>${esc(lensName)}</span><b>${esc(lensValue(state.lens.values[row.i], state.lens.unit, lang()))}</b></div>` : ""
    return `
      ${header(titled(lang() === "ko" ? (row.koFull || row.ko) : row.en, row.sido), name(city) === (row.koFull || row.ko) || name(city) === row.en ? "" : name(city))}
      <div class="body">
        ${row.badge ? `<span class="badge">${esc(lang() === "ko" ? row.badge.ko : row.badge.en)}</span>` : ""}
        ${row.pin ? `<p class="note">${esc(s.pin)}</p>` : ""}
        <div class="stats">
          <div class="stat"><span>${s.people} (${esc(yearNote("pop"))})</span><b>${people(row.pop, lang())}</b></div>
          <div class="stat"><span>${s.density}</span><b>${Math.round(row.density).toLocaleString()}</b></div>
          <div class="stat"><span>${s.area}</span><b>${num(row.area, 0)} km²</b></div>
          ${lensLine}
        </div>
        ${row.grdpScope === "none" ? `<p>${esc(s.none)}</p>` : sectorBars(row.shares)}
        <button class="btn" data-city="${city.i}" type="button" style="color:#1c140e;background:#d7b56a;border:0">${esc(s.openCity)}</button>
      </div>`
  }

  function columnValue(row, column) {
    return column.share ? row.shares[column.id] : row[column.id]
  }

  function explorerBody() {
    const s = t()
    const cols = atlas.explorer
    const x = cols.find((column) => column.id === state.explorer.x) || cols[0]
    const y = cols.find((column) => column.id === state.explorer.y) || cols[3]
    const sortCol = cols.find((column) => column.id === state.explorer.sort) || cols[0]
    const rows = atlas.sigungu.map((row) => row).sort((a, b) => {
      const av = columnValue(a, sortCol)
      const bv = columnValue(b, sortCol)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return (av - bv) * state.explorer.dir
    })
    const options = cols.map((column) => `<option value="${column.id}">${esc(lang() === "ko" ? column.ko : column.en)}</option>`).join("")
    return `
      ${header(s.explorer, lang() === "ko" ? "어른용. 동네 250곳의 표와 점 그래프예요. 점을 누르면 지도가 따라갑니다." : "For grown-ups. A table and dot chart of 250 districts. A point follows you onto the map.")}
      <div class="body">
        <div class="axes">
          <label>${s.x}<select data-axis="x">${options.replace(`value="${x.id}"`, `value="${x.id}" selected`)}</select></label>
          <label>${s.y}<select data-axis="y">${options.replace(`value="${y.id}"`, `value="${y.id}" selected`)}</select></label>
        </div>
        <canvas id="scatter" width="640" height="320"></canvas>
        <div class="table-wrap"><table><thead><tr>
          <th data-sort="name">${lang() === "ko" ? "이름" : "Name"}</th>
          <th data-sort="${x.id}">${esc(lang() === "ko" ? x.ko : x.en)}</th>
          <th data-sort="${y.id}">${esc(lang() === "ko" ? y.ko : y.en)}</th>
        </tr></thead><tbody>
          ${rows.map((row) => `<tr data-sig="${row.i}" class="${state.explorer.selected === row.i ? "sel" : ""}"><td>${esc(row.koFull || row.ko)}</td><td>${esc(lensValue(columnValue(row, x), x.unit, lang()))}</td><td>${esc(lensValue(columnValue(row, y), y.unit, lang()))}</td></tr>`).join("")}
        </tbody></table></div>
      </div>`
  }

  function drawScatter() {
    const canvas = document.querySelector("#scatter")
    if (!canvas) return
    const cols = atlas.explorer
    const x = cols.find((column) => column.id === state.explorer.x)
    const y = cols.find((column) => column.id === state.explorer.y)
    const points = atlas.sigungu.map((row) => ({
      row,
      x: columnValue(row, x),
      y: columnValue(row, y),
    })).filter((point) => point.x != null && point.y != null)
    const ctx = canvas.getContext("2d")
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = "#fffaf2"
    ctx.fillRect(0, 0, w, h)
    if (!points.length) return
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const px = (v) => 36 + (w - 52) * ((v - minX) / ((maxX - minX) || 1))
    const py = (v) => h - 28 - (h - 48) * ((v - minY) / ((maxY - minY) || 1))
    ctx.strokeStyle = "#e2d3b8"
    ctx.strokeRect(36, 16, w - 52, h - 44)
    ctx.fillStyle = "#6d5c48"
    ctx.font = "12px sans-serif"
    ctx.fillText(lang() === "ko" ? x.ko : x.en, 36, h - 8)
    ctx.save()
    ctx.translate(14, h / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(lang() === "ko" ? y.ko : y.en, 0, 0)
    ctx.restore()
    canvas._points = []
    for (const point of points) {
      const sx = px(point.x)
      const sy = py(point.y)
      const sido = atlas.sido.find((item) => item.id === point.row.sido)
      ctx.beginPath()
      ctx.fillStyle = point.row.i === state.explorer.selected ? "#1c140e" : (sido?.color || "#8d6730")
      ctx.arc(sx, sy, point.row.i === state.explorer.selected ? 5 : 3.2, 0, Math.PI * 2)
      ctx.fill()
      canvas._points.push({ sx, sy, i: point.row.i })
    }
  }

  function rankRows(key, label) {
    return atlas.cities
      .filter((city) => city[key] != null)
      .sort((a, b) => b[key] - a[key])
      .slice(0, 8)
      .map((city, index) => `<button class="list-btn" data-city="${city.i}" type="button">${index + 1}. ${esc(name(city))} · ${esc(label(city))}</button>`)
      .join("")
  }

  function advisorBody() {
    const s = t()
    const id = state.advisor
    const tabs = `<div class="tabs">${ADVISORS.map(([key, ko, en]) => `<button type="button" data-advisor="${key}" aria-pressed="${key === id}">${esc(lang() === "ko" ? ko : en)}</button>`).join("")}</div>`
    let body = ""
    if (id === "economy") {
      const top = [...atlas.cities].sort((a, b) => (b.shares.mfg || 0) - (a.shares.mfg || 0))[0]
      body = `<p>${esc(name(top))} ${lang() === "ko" ? "공장 몫(제조업 비중)" : "factory share (manufacturing)"} ${((top.shares.mfg || 0) * 100).toFixed(1)}%. ${lang() === "ko" ? "나라 전체가 번 돈(GRDP)" : "Money the country earns (GRDP)"} ${moneyM(atlas.nation.grdp, lang())}.</p>${sectorBars(atlas.nation.shares)}${rankRows("grdp", (city) => moneyM(city.grdp, lang()))}`
    } else if (id === "people") {
      const growing = [...atlas.sigungu].filter((row) => row.popChange != null).sort((a, b) => b.popChange - a.popChange)[0]
      const low = [...atlas.sigungu].filter((row) => row.fertility != null).sort((a, b) => a.fertility - b.fertility)[0]
      body = `<p>${esc(growing.koFull)} ${lang() === "ko" ? "인구 변화" : "population change"} ${growing.popChange > 0 ? "+" : ""}${growing.popChange.toFixed(1)}%. ${esc(low.koFull)} ${lang() === "ko" ? "아기 수(합계출산율)" : "babies (total fertility rate)"} ${low.fertility.toFixed(2)}.</p>${rankRows("pop", (city) => people(city.pop, lang()))}`
    } else if (id === "prosperity") {
      const rich = [...atlas.sigungu].filter((row) => row.taxPc != null).sort((a, b) => b.taxPc - a.taxPc)[0]
      const vacant = [...atlas.sigungu].filter((row) => row.vacant != null).sort((a, b) => b.vacant - a.vacant)[0]
      body = `<p>${lang() === "ko" ? "한 사람이 낸 소득세(1인당 소득세)가 가장 높은 곳" : "Highest income tax per person"}: ${esc(rich.koFull)} ${perPerson(rich.taxPc, lang())}. ${lang() === "ko" ? "빈집(빈집 비율)이 가장 높은 곳" : "Highest vacancy rate"}: ${esc(vacant.koFull)} ${vacant.vacant.toFixed(1)}%.</p>`
    } else if (id === "knowledge") {
      const docs = [...atlas.sigungu].filter((row) => row.doctorsPer100k != null).sort((a, b) => b.doctorsPer100k - a.doctorsPer100k)[0]
      body = `<p>${esc(docs.koFull)} ${lang() === "ko" ? "의사(명/10만 명)" : "doctors (per 100,000)"} ${Math.round(docs.doctorsPer100k)}. ${lang() === "ko" ? `대학교 위치 ${sites.universities.length}곳. 연구비(R&D) 순위는 자료가 없어 매기지 않았습니다.` : `${sites.universities.length} university pins. No research-spending (R&D) rank was published into this build.`}</p>`
    } else if (id === "land") {
      const high = [...atlas.sigungu].filter((row) => row.elev != null).sort((a, b) => b.elev - a.elev)[0]
      body = `<p>${esc(high.koFull)} ${lang() === "ko" ? "높이(평균고도)" : "height (mean elevation)"} ${high.elev} m. ${lang() === "ko" ? "높은 산 칸은 지형 자료(ETOPO)가 봉우리를 깎아 실제 정상보다 낮습니다." : "High-peak tiles are lower than true summits because ETOPO smooths them."}</p>`
    } else if (id === "energy") {
      const byFuel = new Map()
      for (const plant of sites.plants) byFuel.set(plant.fuel, (byFuel.get(plant.fuel) || 0) + plant.mw)
      const rows = [...byFuel.entries()].sort((a, b) => b[1] - a[1])
      body = `<p>${lang() === "ko" ? "Global Power Plant Database v1.3. 최근 태양광의 상당수는 빠져 있습니다." : "Global Power Plant Database v1.3. Much of the recent solar fleet is missing."}</p>${rows.map(([fuel, mw]) => `<div class="bar"><span>${esc(lang() === "ko" ? (sites.plants.find((plant) => plant.fuel === fuel)?.fuelKo || fuel) : fuel)}</span><i><b style="width:${Math.min(100, mw / rows[0][1] * 100)}%"></b></i><span>${Math.round(mw)}</span></div>`).join("")}`
    } else if (id === "commerce") {
      body = `<p>${lang() === "ko" ? `항구 ${sites.ports.length}곳, 공항 ${sites.airports.length}곳. 물동량 순위는 없습니다.` : `${sites.ports.length} ports and ${sites.airports.length} airports. No cargo ranking.`}</p>${sites.ports.map((port) => `<button class="list-btn" data-sig="${port.sigungu}" type="button">${esc(name(port))}</button>`).join("")}`
    } else {
      body = `<p>${lang() === "ko" ? "세계유산은 유산 1건에 표식 하나, 국립공원은 2024년 탐방객 상위 8곳입니다." : "One marker per World Heritage property, plus the eight most-visited national parks of 2024."}</p>${sites.wonders.map((wonder) => `<button class="list-btn" data-sig="${wonder.sigungu}" type="button">${esc(name(wonder))}${wonder.visitors ? ` · ${people(wonder.visitors, lang())}` : ""}</button>`).join("")}`
    }
    return `${header(s.advisors, "")}<div class="body">${tabs}${body}</div>`
  }

  function lensesBody() {
    return `${header(t().more, lang() === "ko" ? "궁금한 것을 고르면 지도 색깔이 바뀌어요." : "Pick a question and the map changes color.")}<div class="body">${atlas.lenses.map((lens) => {
      const kid = LENS_KID[lens.id]
      const say = kid ? (lang() === "ko" ? kid.sayKo : kid.sayEn) : ""
      return `<button class="list-btn" data-lens="${lens.id}" type="button">${kid ? kid.icon : "🎨"} ${esc(lang() === "ko" ? (kid ? kid.shortKo : lens.ko) : (kid ? kid.shortEn : lens.en))}<small style="display:block;font-weight:650;color:#4d5b70">${esc(say)}</small></button>`
    }).join("")}</div>`
  }

  function grownBody() {
    const s = t()
    return `${header(s.grown, s.grownSub)}<div class="body">
      <p class="grown-note">${lang() === "ko" ? "여기부터는 표와 긴 설명이 있어요. 어린이 지도로 돌아가려면 닫기를 누르세요." : "Tables and longer notes start here. Close this to go back to the kids' map."}</p>
      <button class="list-btn" data-dock="explorer" type="button">📊 ${esc(s.explorer)}</button>
      <button class="list-btn" data-dock="advisor" type="button">💬 ${esc(s.advisors)}</button>
      <button class="list-btn" data-dock="layers" type="button">🛣️ ${esc(s.map)}</button>
      <button class="list-btn" data-about="1" type="button">📚 ${esc(s.about)}</button>
    </div>`
  }

  function layersBody() {
    const s = t()
    const keys = ["roads", "plants", "airports", "ports", "wonders", "universities"]
    return `${header(s.map, "")}<div class="body">${keys.map((key) => `<button class="list-btn" data-layer="${key}" type="button">${state.layers[key] ? "●" : "○"} ${esc(s[key])}</button>`).join("")}</div>`
  }

  function yieldBody() {
    const id = state.yieldId
    const s = t()
    const rows = atlas.cities.filter((city) => city.yields[id] != null).sort((a, b) => b.yields[id] - a.yields[id]).slice(0, 12)
    return `${header(`${ICONS[id] || ""} ${s[id]}`, lang() === "ko" ? "도시 순위" : "City ranking")}<div class="body">${rows.map((city, index) => `<button class="list-btn" data-city="${city.i}" type="button">${index + 1}. ${esc(name(city))} · ${moneyM(city.yields[id], lang())}</button>`).join("")}</div>`
  }

  function paintDock() {
    if (!state.dock) { dock.hidden = true; return }
    dock.hidden = false
    if (state.dock === "city" && state.city != null) dock.innerHTML = cityBody(atlas.cities[state.city])
    else if (state.dock === "place" && state.sigungu != null) dock.innerHTML = placeBody(atlas.sigungu[state.sigungu])
    else if (state.dock === "explorer") { dock.innerHTML = explorerBody(); drawScatter() }
    else if (state.dock === "advisor") dock.innerHTML = advisorBody()
    else if (state.dock === "lenses") dock.innerHTML = lensesBody()
    else if (state.dock === "grown") dock.innerHTML = grownBody()
    else if (state.dock === "layers") dock.innerHTML = layersBody()
    else if (state.dock === "yield") dock.innerHTML = yieldBody()
    else dock.hidden = true
  }

  function paintAbout() {
    if (!state.about) { about.hidden = true; return }
    about.hidden = false
    const ko = lang() === "ko"
    about.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <header><div><h2>${ko ? "이 지도에 대하여" : "About this map"}</h2><p>${ko ? meta.titleKo : meta.titleEn}</p></div><button class="icon-x" data-close-about type="button">${esc(t().close)}</button></header>
      <p class="note">${esc(ko ? meta.gridKo : meta.gridEn)}</p>
      <p class="note">${esc(ko ? meta.yieldKo : meta.yieldEn)}</p>
      <p class="note">${esc(ko ? meta.readingKo : meta.readingEn)}</p>
      <p class="note">${esc(t().help)}</p>
      <p class="note"><button class="btn" data-tour-start type="button">${esc(t().start)}</button></p>
      ${meta.rules.map((rule) => `<p class="note">${esc(ko ? rule.ko : rule.en)}</p>`).join("")}
      <h2 style="padding:0 8px">${ko ? "빠뜨린 것" : "Left out"}</h2>
      ${meta.skipped.map((item) => `<p class="note">${esc(ko ? item.ko : item.en)}</p>`).join("")}
      <h2 style="padding:0 8px">${ko ? "자료" : "Sources"}</h2>
      ${meta.sources.map((source) => `<article class="source"><h3>${esc(ko ? source.ko : source.en)}</h3><p>${esc(source.publisher)}</p><p>${ko ? "이용" : "Use"}: ${esc(ko ? source.usedKo : source.usedEn)}</p><p>${ko ? "처리" : "Processing"}: ${esc(ko ? source.processKo : source.processEn)}</p><p>${esc(source.license)} · ${esc(source.vintage || "")}</p>${source.url ? `<p><a href="${esc(source.url)}">${esc(source.url)}</a></p>` : ""}</article>`).join("")}
    </div>`
  }

  function paintSearch(query) {
    const hits = querySearch(buildSearchIndex(atlas, sites, lang()), query)
    if (!query.trim()) { searchList.hidden = true; return }
    searchList.hidden = hits.length === 0
    searchList.innerHTML = hits.slice(0, 12).map((hit, index) => `<button type="button" data-hit="${hit.kind}:${hit.i}" class="${index === 0 ? "active" : ""}">${esc(hit.title)}<small>${esc(hit.sub)}</small></button>`).join("")
  }

  function paintTour() {
    const steps = TOUR[lang()]
    if (state.tour == null || state.tour < 0 || state.tour >= steps.length) {
      tour.hidden = true
      return
    }
    const step = steps[state.tour]
    tour.hidden = false
    tour.innerHTML = `
      <div class="emo">${step.icon}</div>
      <h2>${esc(step.title)}</h2>
      <p>${esc(step.body)}</p>
      <div class="row">
        <button class="btn" data-tour="skip" type="button">${esc(t().skip)}</button>
        <button class="btn go" data-tour="next" type="button">${state.tour === steps.length - 1 ? esc(t().skip) : esc(t().next)} ${state.tour + 1}/${steps.length}</button>
      </div>`
  }

  function render() {
    paintChrome()
    paintDock()
    paintAbout()
    paintTour()
    map.draw()
    app.writeHash()
  }

  document.body.addEventListener("click", (event) => {
    const sort = event.target.closest("[data-sort]")
    if (sort) {
      const id = sort.dataset.sort
      if (id !== "name") {
        if (state.explorer.sort === id) state.explorer.dir *= -1
        else { state.explorer.sort = id; state.explorer.dir = -1 }
        paintDock()
      }
      return
    }
    const tableRow = event.target.closest("tr[data-sig]")
    if (tableRow) { app.showSigungu(Number(tableRow.dataset.sig), { keepDock: true }); return }
    const target = event.target.closest("button")
    if (!target) return
    if (target.dataset.close != null) { closeDock(); render(); return }
    if (target.dataset.closeAbout != null) { state.about = false; render(); return }
    if (target.dataset.yield) { state.yieldId = target.dataset.yield; openDock("yield"); return }
    if (target.dataset.tour) {
      const steps = TOUR[lang()]
      if (target.dataset.tour === "skip" || state.tour >= steps.length - 1) {
        state.tour = null
        try { localStorage.setItem("koreaciv-tour", "done") } catch (err) { /* private mode */ }
      } else state.tour += 1
      render()
      return
    }
    if (target.dataset.about) { state.about = true; render(); return }
    if (target.dataset.tourStart != null) { state.about = false; state.tour = 0; render(); return }
    if (target.dataset.lens != null) {
      if (state.dock === "lenses") state.dock = null
      app.setLens(target.dataset.lens)
      return
    }
    if (target.dataset.dock) { openDock(target.dataset.dock === "advisor" ? "advisor" : target.dataset.dock); return }
    if (target.dataset.city) { app.showCity(Number(target.dataset.city)); return }
    if (target.dataset.sig && target.dataset.sig !== "null") { app.showSigungu(Number(target.dataset.sig)); return }
    if (target.dataset.advisor) { state.advisor = target.dataset.advisor; paintDock(); return }
    if (target.dataset.layer) {
      state.layers[target.dataset.layer] = !state.layers[target.dataset.layer]
      map.view.layers = { ...state.layers }
      paintDock(); map.draw(); return
    }
    if (target.dataset.hit) {
      const [kind, id] = target.dataset.hit.split(":")
      searchList.hidden = true
      search.value = ""
      if (kind === "city") app.showCity(Number(id))
      else app.showSigungu(Number(id))
    }
    })

  dock.addEventListener("change", (event) => {
    const axis = event.target.dataset.axis
    if (!axis) return
    state.explorer[axis] = event.target.value
    if (axis === "y") { state.explorer.sort = event.target.value; state.explorer.dir = -1 }
    paintDock()
  })

  dock.addEventListener("click", (event) => {
    const canvas = event.target.closest("#scatter")
    if (!canvas || !canvas._points) return
    const rect = canvas.getBoundingClientRect()
    const sx = (event.clientX - rect.left) * (canvas.width / rect.width)
    const sy = (event.clientY - rect.top) * (canvas.height / rect.height)
    let best = null
    let bestD = 14
    for (const point of canvas._points) {
      const d = Math.hypot(point.sx - sx, point.sy - sy)
      if (d < bestD) { best = point; bestD = d }
    }
    if (best) app.showSigungu(best.i, { keepDock: true })
  })

  search.addEventListener("input", () => paintSearch(search.value))
  document.querySelector("#search-form").addEventListener("submit", (event) => {
    event.preventDefault()
    const first = searchList.querySelector("button")
    if (first) first.click()
  })
  document.querySelector("#brand").addEventListener("click", () => {
    state.dock = null
    state.lens = null
    map.view.lens = null
    map.view.highlight = new Set()
    map.view.selectedCity = null
    map.fit()
    render()
  })
  document.querySelector("#lang").addEventListener("click", () => {
    state.lang = lang() === "ko" ? "en" : "ko"
    map.view.lang = state.lang
    render()
  })
  document.querySelector("#about-btn").addEventListener("click", () => {
    state.about = !state.about
    render()
  })

  return { render, openDock, closeDock, paintSearch }
}
