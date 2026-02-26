const testUrls = [
  // 1. picsum.photos placeholder (what our API returns as default imageUrl)
  { name: "picsum.photos placeholder", url: "https://picsum.photos/seed/test123/800/450" },
  // 2. DiceBear avatar (what our API returns as authorAvatar)
  { name: "DiceBear avatar", url: "https://api.dicebear.com/7.x/initials/svg?seed=AB&backgroundColor=e60012" },
  // 3. Unsplash image (used in mock data)
  { name: "Unsplash image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80" },
  // 4. Weibo CDN image (typical sinaimg URL - anti-hotlink)
  { name: "Weibo sinaimg (direct)", url: "https://wx3.sinaimg.cn/orj480/006Fd2j0ly1hv0test.jpg" },
  // 5. Weibo image via weserv.nl proxy
  { name: "Weibo via weserv.nl", url: "https://images.weserv.nl/?url=https://wx3.sinaimg.cn/orj480/006Fd2j0ly1hv0test.jpg&w=800&q=80" },
  // 6. Weibo mobile API (real endpoint our enrichment calls)
  { name: "Weibo mobile search API", url: "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D%E6%B5%8B%E8%AF%95&page_type=searchall" },
  // 7. Sogou Weixin search (GZH enrichment)
  { name: "Sogou Weixin search", url: "https://weixin.sogou.com/weixin?type=2&query=AI" },
  // 8. TopHub HTML page (GZH source)
  { name: "TopHub HTML", url: "https://tophub.today/n/WnBe01o371" },
];

async function testUrl(item) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const start = Date.now();
    const res = await fetch(item.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Referer": "https://m.weibo.cn/",
        "Accept": "text/html,application/json,image/*,*/*",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    const ms = Date.now() - start;
    
    // Read a small portion of the body to check content
    const contentType = res.headers.get("content-type") || "unknown";
    const contentLength = res.headers.get("content-length") || "unknown";
    
    // Read first 500 bytes to check if we get real content
    const reader = res.body.getReader();
    const { value } = await reader.read();
    reader.cancel();
    const bodySize = value ? value.length : 0;
    
    // Check if the response is a valid image/html/json
    const isImage = contentType.includes("image");
    const isJson = contentType.includes("json");
    const isHtml = contentType.includes("html");
    const isSvg = contentType.includes("svg");
    
    let verdict = "UNKNOWN";
    if (res.status === 200 && (isImage || isSvg) && bodySize > 100) verdict = "OK_IMAGE";
    else if (res.status === 200 && isJson && bodySize > 10) verdict = "OK_JSON";
    else if (res.status === 200 && isHtml && bodySize > 100) verdict = "OK_HTML";
    else if (res.status === 200 && bodySize > 100) verdict = "OK_OTHER";
    else if (res.status === 200 && bodySize < 100) verdict = "EMPTY_OR_TINY";
    else if (res.status === 301 || res.status === 302) verdict = "REDIRECT";
    else if (res.status === 403) verdict = "BLOCKED_403";
    else if (res.status === 404) verdict = "NOT_FOUND_404";
    else verdict = `HTTP_${res.status}`;
    
    console.log(`[${verdict}] ${item.name}`);
    console.log(`  Status: ${res.status} | Type: ${contentType} | Size: ${contentLength} | Body: ${bodySize}B | Time: ${ms}ms`);
    console.log(`  URL: ${item.url.substring(0, 100)}`);
    
    // If it's JSON, try to peek at the structure
    if (isJson && value) {
      const text = new TextDecoder().decode(value).substring(0, 200);
      console.log(`  JSON preview: ${text}`);
    }
    
    return { name: item.name, status: res.status, verdict, bodySize };
  } catch (err) {
    clearTimeout(timeout);
    console.log(`[ERROR] ${item.name}`);
    console.log(`  Error: ${err.message}`);
    console.log(`  URL: ${item.url.substring(0, 100)}`);
    return { name: item.name, status: 0, verdict: "ERROR", bodySize: 0 };
  }
}

async function main() {
  console.log("=== MEDIA URL ACCESSIBILITY TEST ===\n");
  
  const results = [];
  for (const item of testUrls) {
    const result = await testUrl(item);
    results.push(result);
    console.log("");
  }
  
  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const icon = r.verdict.startsWith("OK") ? "PASS" : "FAIL";
    console.log(`  ${icon} | ${r.name}: ${r.verdict} (${r.bodySize}B)`);
  }
  
  // Now test what our API actually returns
  console.log("\n=== TESTING LOCAL API RESPONSE STRUCTURE ===");
  console.log("(Simulating what the API routes return as JSON)\n");
  
  // Simulate a weibo item
  const sampleWeiboItem = {
    rank: 1,
    title: "测试热搜",
    hotValue: 5000000,
    url: "https://s.weibo.com/weibo?q=%23测试%23",
    authorName: "微博用户",
    authorAvatar: "https://api.dicebear.com/7.x/initials/svg?seed=测试&backgroundColor=e60012",
    imageUrl: "https://picsum.photos/seed/测试热搜test/800/450",
    mediaType: "image",
    excerpt: "这是一条测试摘要",
    detailContent: null,
  };
  
  console.log("Sample Weibo item fields:");
  for (const [key, val] of Object.entries(sampleWeiboItem)) {
    const display = val === null ? "null" : val === undefined ? "undefined" : String(val).substring(0, 80);
    console.log(`  ${key}: ${display}`);
  }
  
  // Test if picsum.photos actually redirects to a real image
  console.log("\n=== TESTING PICSUM REDIRECT CHAIN ===");
  try {
    const res = await fetch("https://picsum.photos/seed/test123/800/450", { redirect: "manual" });
    console.log(`  Initial: status=${res.status}, location=${res.headers.get("location")}`);
    if (res.status === 302 || res.status === 301) {
      const loc = res.headers.get("location");
      if (loc) {
        const res2 = await fetch(loc, { redirect: "manual" });
        console.log(`  Redirect: status=${res2.status}, type=${res2.headers.get("content-type")}, size=${res2.headers.get("content-length")}`);
      }
    }
  } catch (e) {
    console.log(`  Error: ${e.message}`);
  }
}

main().catch(console.error);
