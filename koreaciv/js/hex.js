// Pointy-top odd-r hexes, y axis down. Keep this aligned with pipeline/hexgrid.py.

const SQRT3 = Math.sqrt(3)

export function createGrid(spec) {
  const radius = spec.radius
  const width = spec.hexW
  const height = spec.hexH
  const cols = spec.cols
  const rows = spec.rows

  function center(col, row) {
    return [width * (col + 0.5 * (row & 1)), height * row]
  }

  function cellAt(x, y) {
    const q = (SQRT3 / 3 * x - y / 3) / radius
    const r = (2 / 3 * y) / radius
    let cx = q
    let cz = r
    let cy = -cx - cz
    let rx = Math.round(cx)
    let ry = Math.round(cy)
    let rz = Math.round(cz)
    const dx = Math.abs(rx - cx)
    const dy = Math.abs(ry - cy)
    const dz = Math.abs(rz - cz)
    if (dx > dy && dx > dz) rx = -ry - rz
    else if (dy <= dz) rz = -rx - ry
    const row = rz
    const col = rx + ((row - (row & 1)) / 2)
    if (col >= 0 && col < cols && row >= 0 && row < rows) return [col, row]
    return null
  }

  function corners(x, y, r) {
    const pts = []
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 6 + i * Math.PI / 3
      pts.push([x + r * Math.cos(angle), y + r * Math.sin(angle)])
    }
    return pts
  }

  return { radius, width, height, cols, rows, center, cellAt, corners }
}
