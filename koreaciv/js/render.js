import { createGrid } from "./hex.js"

const NEI = [
  [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]],
  [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]],
]
const SHORE_EDGE = [5, 0, 1, 2, 3, 4]

function baseColor(terrain, col, row, elevM, coastal) {
  const wobble = ((col * 17 + row * 13) % 7) - 3
  const tint = (rgb, amt) => rgb.map((v, i) => clamp(v + (i === 1 ? wobble * amt : -wobble * amt * 0.25), 0, 255))
  if (terrain === 1) return coastal ? [158, 214, 196] : [36, 118, 158]
  if (terrain === 2) return [112, 116, 98]
  if (terrain === 3) return tint([168, 184, 132], 3)
  if (terrain === 4) return tint([176, 168, 98], 4)
  if (terrain === 5) return tint([204, 160, 128], 3)
  if (terrain === 6) return tint([48, 112, 64], 5)
  if (terrain === 7) {
    const snow = clamp((elevM - 650) / 800, 0, 0.72)
    return [128, 112, 92].map((v) => Math.round(v + (232 - v) * snow))
  }
  if (terrain === 8) return [226, 228, 224]
  return [36, 118, 158]
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)) }

function mix(rgb, shade) {
  return `rgb(${rgb.map((v) => clamp(Math.round(v * shade), 0, 255)).join(",")})`
}

function ramp(t, diverging) {
  const u = clamp(t, 0, 1)
  const stops = diverging
    ? [[140, 70, 58], [236, 224, 200], [36, 110, 96]]
    : [[24, 62, 58], [196, 150, 72], [246, 234, 208]]
  const x = u * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  const f = x - i
  return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f))
}

export function createRenderer(canvas, mini, world, atlas) {
  const grid = createGrid(world)
  const ctx = canvas.getContext("2d")
  const mctx = mini.getContext("2d")
  const cells = world.cells
  const byKey = new Map()
  const elev = new Map()
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const cell of cells) {
    const [col, row] = cell
    const [x, y] = grid.center(col, row)
    byKey.set(col + row * grid.cols, cell)
    elev.set(col + row * grid.cols, cell[2])
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const cam = {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    ppm: 0.002,
  }
  const view = {
    lens: null,
    highlight: new Set(),
    pin: null,
    layers: { roads: true, plants: true, airports: true, ports: true, wonders: true, universities: false },
    sites: { plants: [], airports: [], ports: [], universities: [], wonders: [], roads: [] },
    hover: null,
    lang: "ko",
    selectedCity: null,
  }
  let sheet = null
  const dprCap = 1.75

  function fit(pad = 0.9) {
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || window.innerWidth || 800
    const height = rect.height || window.innerHeight || 600
    const ppm = Math.min(
      (width * pad) / Math.max(1, maxX - minX),
      (height * pad) / Math.max(1, maxY - minY),
    )
    cam.x = (minX + maxX) / 2
    cam.y = (minY + maxY) / 2
    cam.ppm = ppm
    sheet = null
  }

  function frameSeoul() {
    const seoul = atlas.cities.find((city) => String(city.ko).startsWith("서울"))
    if (!seoul) { fit(); return }
    const [x, y] = grid.center(seoul.col, seoul.row)
    const want = ["고양", "의정부", "구리", "하남", "성남", "안양", "광명", "부천"]
    let west = 16000
    let east = 16000
    let north = 16000
    let south = 16000
    for (const city of atlas.cities) {
      if (!want.some((name) => city.ko.startsWith(name))) continue
      const [cx, cy] = grid.center(city.col, city.row)
      west = Math.max(west, x - cx)
      east = Math.max(east, cx - x)
      north = Math.max(north, y - cy)
      south = Math.max(south, cy - y)
    }
    const pad = 5000
    west += pad
    east += pad
    north += pad
    south += pad
    const rect = canvas.getBoundingClientRect()
    const width = rect.width || window.innerWidth || 800
    const height = rect.height || window.innerHeight || 600
    const topEl = document.querySelector("#topbar")
    const lensEl = document.querySelector("#lensbar")
    const top = topEl ? topEl.getBoundingClientRect().height : 0
    const bottom = lensEl ? Math.max(64, height - lensEl.getBoundingClientRect().top) : 80
    const viewW = Math.max(280, width)
    const viewH = Math.max(240, height - top - bottom)
    const ppmFit = Math.min(viewW / (west + east), viewH / (north + south))
    // The west coast sits about 30 km from Seoul. A wider frame would be mostly sea.
    const ppmSea = (viewW / 2) / 25500
    const ppm = Math.min(0.08, Math.max(ppmFit, ppmSea))
    const mid = top + viewH / 2
    cam.x = x
    cam.y = y - (mid - height / 2) / ppm
    cam.ppm = ppm
    sheet = null
  }

  function resize() {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    mini.width = Math.round(132 * dpr)
    mini.height = Math.round(112 * dpr)
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    sheet = null
  }

  function toScreen(x, y) {
    const rect = canvas.getBoundingClientRect()
    return [(x - cam.x) * cam.ppm + rect.width / 2, (y - cam.y) * cam.ppm + rect.height / 2]
  }

  function toWorld(sx, sy) {
    const rect = canvas.getBoundingClientRect()
    return [cam.x + (sx - rect.width / 2) / cam.ppm, cam.y + (sy - rect.height / 2) / cam.ppm]
  }

  function elevAt(col, row) {
    return elev.get(col + row * grid.cols)
  }

  function shadeAt(col, row) {
    const e = elevAt(col, row) ?? 0
    const nw = elevAt(col - 1, row - 1) ?? e
    const se = elevAt(col + 1, row + 1) ?? e
    const north = elevAt(col, row - 1) ?? e
    const south = elevAt(col, row + 1) ?? e
    const west = elevAt(col - 1, row) ?? e
    const east = elevAt(col + 1, row) ?? e
    const towardLight = (nw - se) * 0.7 + (north - south) * 0.2 + (west - east) * 0.35
    return clamp(1 + towardLight / 240, 0.58, 1.48)
  }

  function isWater(col, row) {
    const cell = byKey.get(col + row * grid.cols)
    return Boolean(cell && cell[4] < 0 && cell[3] !== 2)
  }

  function hexPath(context, x, y, r) {
    context.beginPath()
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i * Math.PI / 3
      const px = x + r * Math.cos(angle)
      const py = y + r * Math.sin(angle)
      if (i === 0) context.moveTo(px, py)
      else context.lineTo(px, py)
    }
    context.closePath()
  }

  function lensColor(owner) {
    const lens = view.lens
    if (!lens || owner < 0) return null
    const value = lens.values[owner]
    if (value == null) return null
    let t
    if (lens.scale === "div") {
      const span = Math.max(Math.abs(lens.min), Math.abs(lens.max), 0.001)
      t = 0.5 + value / (2 * span)
    } else {
      const span = (lens.max - lens.min) || 1
      t = (value - lens.min) / span
    }
    return ramp(t, lens.scale === "div")
  }

  function paintSprite(context, sx, sy, radius, terrain, col, row) {
    if (radius < 9) return
    if ((col * 5 + row * 3) % (terrain === 6 ? 2 : 3) !== 0) return
    const shift = ((col * 3 + row) % 5) - 2
    context.save()
    context.translate(sx + shift * radius * 0.12, sy + ((row * 5) % 3) * radius * 0.05)
    if (terrain === 6) {
      context.fillStyle = "rgba(18, 72, 36, 0.72)"
      for (let i = 0; i < 3; i++) {
        const ox = (i - 1) * radius * 0.28
        context.beginPath()
        context.moveTo(ox - radius * 0.1, radius * 0.16)
        context.lineTo(ox, -radius * 0.28)
        context.lineTo(ox + radius * 0.1, radius * 0.16)
        context.fill()
      }
    } else if (terrain === 7 || terrain === 8) {
      context.fillStyle = terrain === 8 ? "rgba(255,255,255,0.88)" : "rgba(92, 74, 58, 0.72)"
      context.beginPath()
      context.moveTo(0, -radius * 0.42)
      context.lineTo(radius * 0.32, radius * 0.18)
      context.lineTo(-radius * 0.26, radius * 0.16)
      context.fill()
    } else if (terrain === 5 && radius > 11) {
      context.fillStyle = "rgba(120, 64, 42, 0.8)"
      context.fillRect(-radius * 0.18, -radius * 0.05, radius * 0.12, radius * 0.28)
      context.fillRect(radius * 0.02, -radius * 0.2, radius * 0.12, radius * 0.42)
    } else if (terrain === 4 && radius > 12) {
      context.strokeStyle = "rgba(90, 110, 40, 0.45)"
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(-radius * 0.12, radius * 0.05)
      context.lineTo(-radius * 0.12, -radius * 0.12)
      context.moveTo(radius * 0.1, radius * 0.08)
      context.lineTo(radius * 0.1, -radius * 0.08)
      context.stroke()
    }
    context.restore()
  }

  function rebuildSheet() {
    const rect = canvas.getBoundingClientRect()
    const margin = 0.45
    const w = rect.width * (1 + margin * 2)
    const h = rect.height * (1 + margin * 2)
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1)
    const off = document.createElement("canvas")
    off.width = Math.max(1, Math.round(w * dpr))
    off.height = Math.max(1, Math.round(h * dpr))
    const octx = off.getContext("2d")
    octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const sky = octx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, "#1d6f9c")
    sky.addColorStop(1, "#8fd0dc")
    octx.fillStyle = sky
    octx.fillRect(0, 0, w, h)
    const originX = cam.x - w / 2 / cam.ppm
    const originY = cam.y - h / 2 / cam.ppm
    const radius = grid.radius * cam.ppm
    const reach = radius * 1.4 + 2
    const visible = []
    for (const cell of cells) {
      const [wx, wy] = grid.center(cell[0], cell[1])
      const sx = (wx - originX) * cam.ppm
      const sy = (wy - originY) * cam.ppm
      if (sx < -reach || sy < -reach || sx > w + reach || sy > h + reach) continue
      visible.push({ cell, sx, sy })
    }
    for (const item of visible) {
      const [col, row, elevM, terrain, owner] = item.cell
      const waterSides = NEI[row & 1].map(([dc, dr]) => isWater(col + dc, row + dr))
      const coastal = waterSides.some(Boolean)
      const shade = shadeAt(col, row)
      let rgb = baseColor(terrain, col, row, elevM, coastal || terrain === 1)
      const lensRgb = owner >= 0 ? lensColor(owner) : null
      if (lensRgb) {
        rgb = lensRgb.map((v, i) => clamp(Math.round(v * 0.74 + rgb[i] * shade * 0.26), 0, 255))
        rgb = rgb.map((v) => clamp(Math.round(v * (0.9 + (shade - 1) * 0.28)), 0, 255))
      } else if (view.lens && owner >= 0) {
        rgb = rgb.map((v) => Math.round(v * 0.45 + 70))
      } else {
        rgb = rgb.map((v) => clamp(Math.round(v * shade), 0, 255))
      }
      hexPath(octx, item.sx, item.sy, radius * 1.045)
      octx.fillStyle = `rgb(${rgb.join(",")})`
      octx.fill()
      if (!lensRgb && coastal && owner >= 0) {
        octx.strokeStyle = "rgba(255, 250, 230, 0.72)"
        octx.lineWidth = Math.max(1.4, radius * 0.16)
        octx.beginPath()
        const corners = []
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 6 + i * Math.PI / 3
          corners.push([item.sx + radius * Math.cos(angle), item.sy + radius * Math.sin(angle)])
        }
        waterSides.forEach((wet, index) => {
          if (!wet) return
          const a = SHORE_EDGE[index]
          const b = (a + 1) % 6
          octx.moveTo(corners[a][0], corners[a][1])
          octx.lineTo(corners[b][0], corners[b][1])
        })
        octx.stroke()
      }
      if (!lensRgb) paintSprite(octx, item.sx, item.sy, radius, terrain, col, row)
      if (radius > 30) {
        hexPath(octx, item.sx, item.sy, radius * 0.99)
        octx.strokeStyle = lensRgb ? "rgba(20,30,20,0.1)" : "rgba(40, 48, 32, 0.13)"
        octx.lineWidth = 1
        octx.stroke()
      }
      if (view.lens && owner >= 0 && view.lens.imputed[owner] && radius > 6) {
        octx.strokeStyle = "rgba(28,20,14,0.28)"
        octx.lineWidth = 1
        octx.beginPath()
        octx.moveTo(item.sx - radius * 0.35, item.sy - radius * 0.15)
        octx.lineTo(item.sx + radius * 0.35, item.sy + radius * 0.15)
        octx.stroke()
      }
    }
    if (radius < 30) {
      const tmp = document.createElement("canvas")
      tmp.width = off.width
      tmp.height = off.height
      const tctx = tmp.getContext("2d")
      tctx.filter = `blur(${radius < 8 ? 1.45 : 0.85}px)`
      tctx.drawImage(off, 0, 0)
      octx.setTransform(1, 0, 0, 1, 0, 0)
      octx.clearRect(0, 0, off.width, off.height)
      octx.drawImage(tmp, 0, 0)
      octx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    paintLines(octx, view.sites.rivers || [], originX, originY, cam.ppm, view.lens ? "rgba(25, 70, 110, 0.38)" : "rgba(36, 112, 158, 0.82)", Math.max(1.15, 900 * cam.ppm))
    sheet = { canvas: off, ppm: cam.ppm, originX, originY, w, h, lens: view.lens && view.lens.id }
  }

  function paintLines(context, lines, originX, originY, ppm, color, width) {
    if (!lines.length) return
    context.save()
    context.strokeStyle = color
    context.lineWidth = width
    context.lineJoin = "round"
    context.lineCap = "round"
    for (const line of lines) {
      context.beginPath()
      for (let i = 0; i < line.length; i += 2) {
        const sx = (line[i] - originX) * ppm
        const sy = (line[i + 1] - originY) * ppm
        if (i === 0) context.moveTo(sx, sy)
        else context.lineTo(sx, sy)
      }
      context.stroke()
    }
    context.restore()
  }

  function drawRoads() {
    if (!view.layers.roads) return
    ctx.save()
    ctx.strokeStyle = "rgba(92, 64, 36, 0.55)"
    ctx.lineWidth = Math.max(1, 900 * cam.ppm)
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    for (const line of view.sites.roads) {
      ctx.beginPath()
      for (let i = 0; i < line.length; i += 2) {
        const [sx, sy] = toScreen(line[i], line[i + 1])
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawToken(sx, sy, kind, label) {
    ctx.save()
    ctx.translate(sx, sy)
    ctx.fillStyle = "#1c140e"
    ctx.strokeStyle = "#d7b56a"
    ctx.lineWidth = 1
    if (kind === "wonder") {
      ctx.beginPath()
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 4 / 5
        const r = 6
        const px = Math.cos(a) * r
        const py = Math.sin(a) * r
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = "#d7b56a"
      ctx.fill()
    } else if (kind === "plant") {
      ctx.beginPath()
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    } else if (kind === "airport") {
      ctx.beginPath()
      ctx.moveTo(0, -6); ctx.lineTo(5, 4); ctx.lineTo(-5, 4); ctx.closePath()
      ctx.fill()
    } else if (kind === "port") {
      ctx.beginPath()
      ctx.arc(0, -1, 4, Math.PI, 0)
      ctx.lineTo(-4, 4); ctx.lineTo(4, 4); ctx.closePath()
      ctx.stroke()
    } else {
      ctx.strokeRect(-3.5, -3.5, 7, 7)
    }
    if (label && cam.ppm > 0.012) {
      ctx.font = "11px sans-serif"
      ctx.fillStyle = "#f6efe2"
      ctx.strokeStyle = "rgba(12,20,28,0.8)"
      ctx.lineWidth = 3
      ctx.strokeText(label, 8, 3)
      ctx.fillText(label, 8, 3)
    }
    ctx.restore()
  }

  function drawSites() {
    const lang = view.lang
    const showLabel = cam.ppm > 0.01
    if (view.layers.wonders) {
      for (const site of view.sites.wonders) {
        const [x, y] = grid.center(site.col, site.row)
        const [sx, sy] = toScreen(x, y - grid.height * 0.15)
        drawToken(sx, sy, "wonder", showLabel ? (lang === "ko" ? site.ko : site.en) : "")
      }
    }
    if (view.layers.plants && cam.ppm > 0.004) {
      for (const site of view.sites.plants) {
        if (cam.ppm < 0.01 && site.mw < 200 && site.fuel !== "Nuclear") continue
        const [x, y] = grid.center(site.col, site.row)
        const [sx, sy] = toScreen(x, y)
        drawToken(sx, sy + 8, "plant", showLabel ? site.fuelKo || site.fuel : "")
      }
    }
    if (view.layers.airports) {
      for (const site of view.sites.airports) {
        if (site.kind !== "large" && cam.ppm < 0.008) continue
        const [x, y] = grid.center(site.col, site.row)
        const [sx, sy] = toScreen(x, y)
        drawToken(sx, sy, "airport", showLabel ? (lang === "ko" ? site.ko : site.iata || site.en) : (site.iata || ""))
      }
    }
    if (view.layers.ports && cam.ppm > 0.004) {
      for (const site of view.sites.ports) {
        const [x, y] = grid.center(site.col, site.row)
        const [sx, sy] = toScreen(x, y)
        drawToken(sx, sy, "port", showLabel ? (lang === "ko" ? site.ko : site.en) : "")
      }
    }
    if (view.layers.universities && cam.ppm > 0.012) {
      for (const site of view.sites.universities) {
        const [x, y] = grid.center(site.col, site.row)
        const [sx, sy] = toScreen(x, y)
        drawToken(sx, sy, "uni", lang === "ko" ? site.ko : site.en)
      }
    }
  }

  function drawBanners() {
    const lang = view.lang
    const ranked = atlas.cities.slice().sort((a, b) => b.pop - a.pop)
    const limit = cam.ppm < 0.0022 ? 8 : cam.ppm < 0.0045 ? 16 : cam.ppm < 0.009 ? 36 : ranked.length
    const kept = []
    ctx.save()
    ctx.font = "800 15px sans-serif"
    ranked.forEach((city, index) => {
      const chosen = index < limit || city.i === view.selectedCity
      if (!chosen) return
      const [wx, wy] = grid.center(city.col, city.row)
      const [sx, sy] = toScreen(wx, wy)
      const name = lang === "ko" ? city.ko.replace("특별자치시", "").replace("특별시", "").replace("광역시", "") : city.en
      const width = Math.max(54, ctx.measureText(name).width + 16)
      const rect = { l: sx - width / 2, t: sy - 52, r: sx + width / 2, b: sy - 18 }
      const hit = kept.some((box) => !(rect.r < box.l || rect.l > box.r || rect.b < box.t || rect.t > box.b))
      if (hit && city.i !== view.selectedCity) return
      kept.push({ ...rect, city })
      const sido = atlas.sido.find((row) => row.id === city.sido)
      const color = sido ? sido.color : "#c47a32"
      ctx.shadowColor = "rgba(16, 36, 48, 0.35)"
      ctx.shadowBlur = 6
      ctx.shadowOffsetY = 2
      ctx.strokeStyle = "#2a2118"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(sx, sy + 2)
      ctx.lineTo(sx, sy - 14)
      ctx.stroke()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(sx, sy - 6)
      ctx.lineTo(sx - 7, sy - 16)
      ctx.lineTo(sx + 7, sy - 16)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = city.i === view.selectedCity ? "#fffaf0" : "#f7f1e4"
      ctx.strokeStyle = color
      ctx.lineWidth = city.i === view.selectedCity ? 3 : 2
      round(ctx, rect.l, rect.t, width, 30, 9)
      ctx.fill()
      ctx.shadowColor = "transparent"
      ctx.stroke()
      ctx.fillStyle = color
      ctx.fillRect(rect.l, rect.t, 7, 30)
      ctx.fillStyle = "#1b2433"
      ctx.fillText(name, rect.l + 12, rect.t + 20)
    })
    ctx.restore()
    return kept
  }

  function drawHover() {
    const hover = view.hover
    if (!hover) return
    const [x, y] = grid.center(hover[0], hover[1])
    const [sx, sy] = toScreen(x, y)
    const radius = grid.radius * cam.ppm
    ctx.save()
    hexPath(ctx, sx, sy, radius)
    ctx.strokeStyle = "rgba(255, 252, 240, 0.9)"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.restore()
  }

  function drawHighlight() {
    if (!view.highlight.size && view.pin == null) return
    const radius = grid.radius * cam.ppm
    ctx.save()
    ctx.strokeStyle = "#f2d48a"
    ctx.lineWidth = 2
    for (const cell of cells) {
      if (!view.highlight.has(cell[4])) continue
      const [x, y] = grid.center(cell[0], cell[1])
      const [sx, sy] = toScreen(x, y)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = Math.PI / 6 + i * Math.PI / 3
        const px = sx + radius * Math.cos(angle)
        const py = sy + radius * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.stroke()
    }
    if (view.pin != null) {
      const row = atlas.sigungu[view.pin]
      const [x, y] = grid.center(row.col, row.row)
      const [sx, sy] = toScreen(x, y)
      ctx.fillStyle = "#f2d48a"
      ctx.beginPath()
      ctx.moveTo(sx, sy - 8); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx, sy + 8); ctx.lineTo(sx - 6, sy)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }

  function drawMini() {
    const w = 132, h = 112
    mctx.clearRect(0, 0, w, h)
    mctx.fillStyle = "#49c4f0"
    mctx.fillRect(0, 0, w, h)
    const sx = (w - 8) / (maxX - minX)
    const sy = (h - 8) / (maxY - minY)
    const k = Math.min(sx, sy)
    const ox = 4 - minX * k
    const oy = 4 - minY * k
    for (const cell of cells) {
      if (cell[4] < 0 && cell[3] !== 2) continue
      const [x, y] = grid.center(cell[0], cell[1])
      const miniRgb = cell[4] < 0 ? [70, 150, 176] : baseColor(cell[3], cell[0], cell[1], cell[2], false)
      mctx.fillStyle = `rgb(${miniRgb.join(",")})`
      mctx.fillRect(x * k + ox, y * k + oy, 1.4, 1.4)
    }
    const rect = canvas.getBoundingClientRect()
    const vx = cam.x - rect.width / 2 / cam.ppm
    const vy = cam.y - rect.height / 2 / cam.ppm
    mctx.strokeStyle = "#f2d48a"
    mctx.strokeRect(vx * k + ox, vy * k + oy, rect.width / cam.ppm * k, rect.height / cam.ppm * k)
    sheetMini = { k, ox, oy }
  }

  let sheetMini = null
  let banners = []

  function draw() {
    if (!sheet || sheet.ppm !== cam.ppm || sheet.lens !== (view.lens && view.lens.id)) rebuildSheet()
    const rect = canvas.getBoundingClientRect()
    const dx = (sheet.originX - (cam.x - sheet.w / 2 / cam.ppm)) * cam.ppm
    const dy = (sheet.originY - (cam.y - sheet.h / 2 / cam.ppm)) * cam.ppm
    const left = (sheet.w - rect.width) / 2
    if (Math.abs(dx) > left - 8 || Math.abs(dy) > (sheet.h - rect.height) / 2 - 8) rebuildSheet()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const ox = (sheet.originX - cam.x) * cam.ppm + rect.width / 2
    const oy = (sheet.originY - cam.y) * cam.ppm + rect.height / 2
    ctx.drawImage(sheet.canvas, ox, oy, sheet.w, sheet.h)
    drawRoads()
    drawHover()
    drawHighlight()
    drawSites()
    banners = drawBanners()
    drawMini()
  }

  function hitBanner(sx, sy) {
    return banners.find((box) => sx >= box.l && sx <= box.r && sy >= box.t && sy <= box.b) || null
  }

  function hitHex(sx, sy) {
    const [x, y] = toWorld(sx, sy)
    const at = grid.cellAt(x, y)
    if (!at) return null
    return byKey.get(at[0] + at[1] * grid.cols) || null
  }

  function focus(col, row, ppm) {
    const [x, y] = grid.center(col, row)
    cam.x = x
    cam.y = y
    if (ppm) cam.ppm = ppm
    sheet = null
  }

  function jumpMini(sx, sy) {
    if (!sheetMini) return
    const x = (sx - sheetMini.ox) / sheetMini.k
    const y = (sy - sheetMini.oy) / sheetMini.k
    cam.x = x
    cam.y = y
    sheet = null
  }

  fit()
  return { cam, view, grid, fit, frameSeoul, resize, draw, hitBanner, hitHex, focus, jumpMini, toScreen, bounds: { minX, minY, maxX, maxY } }
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
