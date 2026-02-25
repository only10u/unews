// Test fetching tophub.today HTML structure
const res = await fetch("https://tophub.today/n/WnBe01o371", {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html",
  },
})
const html = await res.text()

// Print a sample of the HTML around the table to understand structure
const tableStart = html.indexOf('<table')
if (tableStart !== -1) {
  console.log("=== TABLE SECTION (first 3000 chars) ===")
  console.log(html.substring(tableStart, tableStart + 3000))
} else {
  console.log("No <table> found. Looking for other structures...")
  // Look for tr tags
  const trStart = html.indexOf('<tr')
  if (trStart !== -1) {
    console.log("=== TR SECTION ===")
    console.log(html.substring(trStart, trStart + 2000))
  }
  // Look for list items
  const liStart = html.indexOf('itemTitle')
  if (liStart !== -1) {
    console.log("=== itemTitle SECTION ===")
    console.log(html.substring(Math.max(0, liStart - 200), liStart + 1500))
  }
}

// Also check total html length and search for common patterns
console.log("\n=== HTML LENGTH:", html.length, "===")

// Find all <a href="/l/ patterns
const linkMatches = html.match(/<a[^>]*href="\/l\/[^"]*"[^>]*>[^<]+<\/a>/g)
if (linkMatches) {
  console.log("\n=== FOUND /l/ LINKS:", linkMatches.length, "===")
  linkMatches.slice(0, 10).forEach((m, i) => console.log(i + 1, m))
}

// Find "Jc" or "jc" class patterns (TopHub uses class="Jc" for items)
const jcMatches = html.match(/class="[^"]*[Jj]c[^"]*"[^>]*>[\s\S]*?<\/a>/g)
if (jcMatches) {
  console.log("\n=== Jc CLASS MATCHES:", jcMatches.length, "===")
  jcMatches.slice(0, 5).forEach((m, i) => console.log(i + 1, m.substring(0, 200)))
}

// Find numbered patterns  
const numPatterns = html.match(/>\s*\d+\s*<\/t[dh]>/g)
if (numPatterns) {
  console.log("\n=== NUMBER CELLS:", numPatterns.length, "===")
  numPatterns.slice(0, 10).forEach((m, i) => console.log(i + 1, m.trim()))
}
