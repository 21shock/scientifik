// One row per 시군구 code, plus metro/split cities and wonders that are not the same name.

function sidoName(atlas, id, lang) {
  const row = atlas.sido.find((item) => item.id === id)
  if (!row) return ""
  return lang === "ko" ? row.ko : row.en
}

export function withSido(label, sido) {
  if (!sido || label === sido || label.includes(`(${sido})`)) return label
  return `${label} (${sido})`
}

export function buildSearchIndex(atlas, sites, lang) {
  const entries = []
  const seenCodes = new Set()
  for (const row of atlas.sigungu) {
    if (seenCodes.has(row.code)) continue
    seenCodes.add(row.code)
    const sido = sidoName(atlas, row.sido, lang)
    const label = row.koFull || row.ko
    entries.push({
      kind: "sig",
      i: row.i,
      code: row.code,
      title: withSido(lang === "ko" ? label : (row.en || label), sido),
      hay: `${row.ko} ${row.koFull} ${row.en} ${sido}`.toLowerCase(),
      sub: lang === "ko" ? "동네" : "District",
    })
  }
  for (const city of atlas.cities) {
    // A county that is its own city is already listed under its 시군구 code.
    if (city.members.length === 1) continue
    const sido = sidoName(atlas, city.sido, lang)
    const label = lang === "ko" ? city.ko : city.en
    entries.push({
      kind: "city",
      i: city.i,
      code: null,
      title: withSido(label, sido),
      hay: `${city.ko} ${city.en} ${sido}`.toLowerCase(),
      sub: lang === "ko" ? "도시" : "City",
    })
  }
  const seenWonder = new Set()
  for (const wonder of sites.wonders || []) {
    const row = atlas.sigungu[wonder.sigungu]
    const sido = row ? sidoName(atlas, row.sido, lang) : ""
    const label = lang === "ko" ? wonder.ko : wonder.en
    const title = withSido(label, sido)
    const sigTitle = row ? withSido(lang === "ko" ? (row.koFull || row.ko) : row.en, sido) : ""
    if (title === sigTitle) continue
    const key = `${row?.code ?? ""}|${title}`
    if (seenWonder.has(key)) continue
    seenWonder.add(key)
    entries.push({
      kind: "sig",
      i: wonder.sigungu,
      code: row?.code ?? null,
      title,
      hay: `${wonder.ko} ${wonder.en} ${sido}`.toLowerCase(),
      sub: lang === "ko" ? "불가사의" : "Wonder",
    })
  }
  return entries
}

export function querySearch(entries, query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return entries.filter((entry) => entry.hay.includes(q))
}
