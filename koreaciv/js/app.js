import { STR } from "./i18n.js"
import { createRenderer } from "./render.js"
import { mountUI } from "./ui.js"

const base = new URL("../data/", import.meta.url)

async function load() {
  const names = ["world.json", "atlas.json", "sites.json", "meta.json"]
  const [world, atlas, sites, meta] = await Promise.all(names.map(async (name) => {
    const response = await fetch(new URL(name, base))
    if (!response.ok) throw new Error(name)
    return response.json()
  }))
  return { world, atlas, sites, meta }
}

function boot(data) {
  const { world, atlas, sites, meta } = data
  const canvas = document.querySelector("#map")
  const mini = document.querySelector("#mini")
  const map = createRenderer(canvas, mini, world, atlas)
  map.resize()
  map.view.sites = sites
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""))
  const state = {
    lang: hash.get("lang") === "en" ? "en" : "ko",
    lens: null,
    dock: null,
    city: null,
    sigungu: null,
    advisor: hash.get("advisor") || "economy",
    yieldId: "gold",
    layers: { roads: true, plants: true, airports: true, ports: true, wonders: true, universities: false },
    explorer: {
      x: hash.get("xcol") || "grdpPc",
      y: hash.get("ycol") || "mfg",
      sort: "pop",
      dir: -1,
      selected: null,
    },
    about: hash.get("about") === "1",
    tour: hash.get("tour") === "on" ? 0 : null,
  }
  map.view.lang = state.lang
  map.view.layers = state.layers

  const app = {
    state, atlas, sites, meta, map,
    str: () => STR[state.lang],
    writeHash() {
      const params = new URLSearchParams()
      if (state.lang === "en") params.set("lang", "en")
      if (state.lens) params.set("lens", state.lens.id)
      if (state.dock) params.set("dock", state.dock)
      if (state.city != null && state.dock === "city") params.set("city", String(state.city))
      if (state.sigungu != null) params.set("sig", String(state.sigungu))
      if (state.about) params.set("about", "1")
      if (state.dock === "advisor") params.set("advisor", state.advisor)
      if (state.dock === "explorer") {
        params.set("xcol", state.explorer.x)
        params.set("ycol", state.explorer.y)
      }
      params.set("z", camToken(map.cam.ppm))
      params.set("cx", String(Math.round(map.cam.x)))
      params.set("cy", String(Math.round(map.cam.y)))
      const next = params.toString()
      if (location.hash.replace(/^#/, "") !== next) history.replaceState(null, "", `#${next}`)
    },
    setLens(id) {
      if (!id) {
        state.lens = null
        map.view.lens = null
      } else {
        const lens = atlas.lenses.find((item) => item.id === id)
        if (!lens) return
        const nums = lens.values.filter((value) => value != null)
        lens.min = Math.min(...nums)
        lens.max = Math.max(...nums)
        state.lens = lens
        map.view.lens = lens
      }
      ui.render()
    },
    showCity(index) {
      const city = atlas.cities[index]
      if (!city) return
      state.city = index
      state.dock = "city"
      state.sigungu = null
      map.view.selectedCity = index
      map.view.highlight = new Set(city.members.filter((member) => !atlas.sigungu[member].pin))
      map.view.pin = null
      map.focus(city.col, city.row, Math.max(map.cam.ppm, 0.01))
      ui.render()
    },
    showSigungu(index, options = {}) {
      const row = atlas.sigungu[index]
      if (!row) return
      state.sigungu = index
      state.explorer.selected = index
      if (!options.keepDock) {
        state.dock = "place"
        state.city = null
        map.view.selectedCity = null
      }
      map.view.highlight = row.pin ? new Set() : new Set([index])
      map.view.pin = row.pin ? index : null
      map.focus(row.col, row.row, Math.max(map.cam.ppm, 0.02))
      ui.render()
    },
  }
  const ui = mountUI(app)
  app.ui = ui
  ui.render()
  const hashedCamera = hash.get("cx") && hash.get("cy") && hash.get("z")
  if (hashedCamera) {
    map.cam.x = Number(hash.get("cx"))
    map.cam.y = Number(hash.get("cy"))
    map.cam.ppm = Number(hash.get("z"))
  } else if (!hash.get("city") && !hash.get("sig")) {
    map.frameSeoul()
  }
  if (hash.get("lens")) app.setLens(hash.get("lens"))
  else if (hash.get("dock") === "city" && hash.get("city")) app.showCity(Number(hash.get("city")))
  else if (hash.get("sig")) app.showSigungu(Number(hash.get("sig")), { keepDock: hash.get("dock") === "explorer" })
  else if (hash.get("dock")) {
    state.dock = hash.get("dock")
    ui.render()
  } else ui.render()

  bindPointer(canvas, map, app)
  mini.addEventListener("pointerdown", (event) => {
    const rect = mini.getBoundingClientRect()
    map.jumpMini(event.clientX - rect.left, event.clientY - rect.top)
    map.draw()
    app.writeHash()
  })
  window.addEventListener("resize", () => { map.resize(); map.draw() })
  window.addEventListener("keydown", (event) => {
    if (event.key === "/" && document.activeElement !== document.querySelector("#search")) {
      event.preventDefault()
      document.querySelector("#search").focus()
    } else if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
      state.about = true
      ui.render()
    } else if (event.key === "Escape") {
      state.about = false
      state.dock = null
      ui.render()
    }
  })
  document.querySelector("#loading").classList.add("hidden")
}

function camToken(ppm) {
  return String(Math.round(ppm * 1e6) / 1e6)
}

function bindPointer(canvas, map, app) {
  const pointers = new Map()
  let drag = null
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    drag = { x: event.clientX, y: event.clientY, camX: map.cam.x, camY: map.cam.y, moved: false }
  })
  canvas.addEventListener("pointermove", (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      if (drag && drag.pinch) {
        map.cam.ppm = clamp(drag.ppm * dist / drag.pinch, 0.0006, 0.08)
        map.draw()
      } else if (drag) {
        drag.pinch = dist
        drag.ppm = map.cam.ppm
      }
      return
    }
    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    if (drag && pointers.has(event.pointerId)) {
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (Math.hypot(dx, dy) > 3) drag.moved = true
      map.cam.x = drag.camX - dx / map.cam.ppm
      map.cam.y = drag.camY - dy / map.cam.ppm
      map.draw()
      return
    }
    const cell = map.hitHex(sx, sy)
    const hoverKey = cell ? `${cell[0]},${cell[1]}` : ""
    if (hoverKey !== map.view.hoverKey) {
      map.view.hoverKey = hoverKey
      map.view.hover = cell ? [cell[0], cell[1]] : null
      map.draw()
    }
    const tip = document.querySelector("#tip")
    if (!cell || cell[4] < 0) { tip.hidden = true; return }
    const row = app.atlas.sigungu[cell[4]]
    const lang = app.state.lang
    const lens = app.state.lens
    const extra = lens ? `<br><span>${lensValueSafe(lens, cell[4], lang)}</span>` : ""
    tip.hidden = false
    tip.innerHTML = `<strong>${row.koFull || row.ko}</strong><span>${lang === "ko" ? app.str().terrain[cell[3]] : app.str().terrain[cell[3]]} · ${cell[2]} m</span>${extra}`
    tip.style.left = `${Math.min(rect.width - 200, sx + 14)}px`
    tip.style.top = `${sy + 18}px`
  })
  function end(event) {
    pointers.delete(event.pointerId)
    if (event.type === "pointerup" && drag && !drag.moved && pointers.size === 0) {
      const rect = canvas.getBoundingClientRect()
      const sx = event.clientX - rect.left
      const sy = event.clientY - rect.top
      const banner = map.hitBanner(sx, sy)
      if (banner) app.showCity(banner.city.i)
      else {
        const cell = map.hitHex(sx, sy)
        if (cell && cell[4] >= 0) app.showSigungu(cell[4])
      }
    }
    if (pointers.size === 0) {
      drag = null
      app.writeHash()
    }
  }
  canvas.addEventListener("pointerup", end)
  canvas.addEventListener("pointercancel", end)
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault()
    const rect = canvas.getBoundingClientRect()
    const sx = event.clientX - rect.left
    const sy = event.clientY - rect.top
    const world = [
      map.cam.x + (sx - rect.width / 2) / map.cam.ppm,
      map.cam.y + (sy - rect.height / 2) / map.cam.ppm,
    ]
    const next = clamp(map.cam.ppm * (event.deltaY < 0 ? 1.12 : 0.89), 0.0006, 0.08)
    map.cam.ppm = next
    map.cam.x = world[0] - (sx - rect.width / 2) / next
    map.cam.y = world[1] - (sy - rect.height / 2) / next
    map.draw()
    app.writeHash()
  }, { passive: false })
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function lensValueSafe(lens, index, lang) {
  const value = lens.values[index]
  if (value == null) return lang === "ko" ? "자료 없음" : "No data"
  if (lens.unit === "share") return `${(value * 100).toFixed(1)}%`
  if (lens.unit === "won") return lang === "ko" ? `${Math.round(value / 10000).toLocaleString("ko-KR")}만 원` : `₩${Math.round(value).toLocaleString("en-US")}`
  return String(Math.round(value * 10) / 10)
}

load().then(boot).catch((error) => {
  const node = document.querySelector("#loading-text")
  node.textContent = `자료를 읽지 못했습니다. ${error.message}`
})
