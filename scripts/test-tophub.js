const res = await fetch("https://tophub.today/n/WnBe01o371", {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html",
  },
})
const html = await res.text()

console.log("=== HTML LENGTH:", html.length, "===")

// Find table structure
const tableStart = html.indexOf('<table')
if (tableStart !== -1) {
  console.log("=== TABLE FOUND at", tableStart, "===")
  console.log(html.substring(tableStart, tableStart + 3000))
} else {
  console.log("No <table> found")
}

// Find /l/ links
const linkMatches = html.match(/<a[^>]*href="\/l\/[^"]*"[^>]*>[^<]+<\/a>/g)
if (linkMatches) {
  console.log("\n=== /l/ LINKS:", linkMatches.length, "===")
  linkMatches.slice(0, 10).forEach((m, i) => console.log(i + 1, m))
} else {
  console.log("No /l/ links found")
}

// Find td with numbers (ranks)
const tdMatches = html.match(/<td[^>]*>\s*\d+\s*<\/td>/g)
if (tdMatches) {
  console.log("\n=== TD NUMBERS:", tdMatches.length, "===")
  tdMatches.slice(0, 5).forEach((m, i) => console.log(i + 1, m))
}

// Look for itemTitle class
const itemIdx = html.indexOf('itemTitle')
if (itemIdx !== -1) {
  console.log("\n=== itemTitle context ===")
  console.log(html.substring(Math.max(0, itemIdx - 100), itemIdx + 500))
}

// Check for tr rows within first table
const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g)
if (trMatches) {
  console.log("\n=== TR count:", trMatches.length, "===")
  // Print first 3 rows with content
  trMatches.slice(0, 3).forEach((m, i) => console.log("Row", i + 1, ":", m.substring(0, 400)))
}
