export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]))
}

export function people(n, lang) {
  if (n == null || Number.isNaN(n)) return "—"
  if (lang === "ko") {
    if (Math.abs(n) >= 10000) {
      const man = n / 10000
      const digits = man >= 100 ? 0 : 1
      return `${man.toFixed(digits)}만`
    }
    return Math.round(n).toLocaleString("ko-KR")
  }
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}k`
  return Math.round(n).toLocaleString("en-US")
}

/** million KRW → 조 / 억, or ₩ trillion / billion. */
export function moneyM(million, lang) {
  if (million == null || Number.isNaN(million)) return "—"
  const jo = million / 1e6
  if (lang === "ko") {
    if (Math.abs(jo) >= 1) return `${jo.toFixed(jo >= 100 ? 0 : 1)}조`
    const eok = million / 100
    return `${Math.round(eok).toLocaleString("ko-KR")}억`
  }
  if (Math.abs(jo) >= 1) return `₩${jo.toFixed(1)}T`
  return `₩${(million / 1000).toFixed(1)}B`
}

export function perPerson(won, lang) {
  if (won == null || Number.isNaN(won)) return "—"
  if (lang === "ko") {
    const man = won / 10000
    return `${man.toFixed(man >= 100 ? 0 : 1)}만 원`
  }
  return `₩${Math.round(won).toLocaleString("en-US")}`
}

export function num(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—"
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits })
}

export function lensValue(value, unit, lang) {
  if (value == null || Number.isNaN(value)) return "—"
  if (unit === "share") return `${(value * 100).toFixed(1)}%`
  if (unit === "percent" || unit === "signed") {
    const sign = unit === "signed" && value > 0 ? "+" : ""
    return `${sign}${value.toFixed(1)}%`
  }
  if (unit === "won") return perPerson(value, lang)
  if (unit === "density") return lang === "ko" ? `${Math.round(value).toLocaleString("ko-KR")}명/km²` : `${Math.round(value).toLocaleString("en-US")}/km²`
  if (unit === "per100k") return `${num(value, 0)}`
  if (unit === "per1000") return num(value, 1)
  if (unit === "m2") return `${num(value, 1)}㎡`
  if (unit === "temp") return `${value.toFixed(1)}°C`
  if (unit === "mm") return `${Math.round(value).toLocaleString()} mm`
  if (unit === "meters") return `${Math.round(value).toLocaleString()} m`
  if (unit === "rate") return value.toFixed(2)
  if (unit === "km2") return `${num(value, 1)} km²`
  if (unit === "people") return people(value, lang)
  return num(value, 1)
}
