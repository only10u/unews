/**
 * Test media URL accessibility - checks if images and videos from our API responses
 * can actually be fetched (status code + content length).
 */

const URLS_TO_TEST = [
  // 1. picsum.photos placeholder images (used by all 3 routes as defaults)
  { label: "picsum.photos (default image)", url: "https://picsum.photos/seed/test123/800/450" },
  
  // 2. DiceBear avatar (used for author avatars)
  { label: "DiceBear avatar SVG", url: "https://api.dicebear.com/7.x/initials/svg?seed=test&backgroundColor=e60012" },
  
  // 3. Weibo mobile API (m.weibo.cn) - test if we can reach it from Vercel
  { label: "Weibo mobile search API", url: "https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D%E7%83%AD%E6%90%9C&page_type=searchall" },
  
  // 4. Weibo image domain (sinaimg.cn) - test anti-hotlink
  { label: "Weibo image (sinaimg.cn) direct", url: "https://wx1.sinaimg.cn/orj480/006cml9lgy1hxl3v3rjvoj30u01hcwp5.jpg" },
  
  // 5. Weibo image through our proxy concept (weserv.nl)  
  { label: "Weibo image via weserv.nl proxy", url: "https://images.weserv.nl/?url=https://wx1.sinaimg.cn/orj480/006cml9lgy1hxl3v3rjvoj30u01hcwp5.jpg&w=800&q=80" },
  
  // 6. Unsplash image (used in mock data)
  { label: "Unsplash image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80" },
  
  // 7. Sogou WeChat search (used for GZH enrichment)
  { label: "Sogou WeChat search", url: "https://weixin.sogou.com/weixin?type=2&query=%E4%B8%89%E5%A4%A7%E8%BF%90%E8%90%A5%E5%95%86" },
  
  // 8. TopHub HTML page (used for GZH scraping)
  { label: "TopHub GZH page HTML", url: "https://tophub.today/n/WnBe01o371" },

  // 9. Douyin search page
  { label: "Douyin search page", url: "https://www.douyin.com/search/%E7%83%AD%E6%90%9C" },
];

async function testUrl(item) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  try {
    const res = await fetch(item.url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Referer": "https://www.google.com/",
      },
      redirect: "follow",
    });
    
    clearTimeout(timeout);
    
    const contentType = res.headers.get("content-type") || "unknown";
    const contentLength = res.headers.get("content-length") || "unknown";
    
    // Try to read body to get actual size
    let bodySize = 0;
    try {
      const buffer = await res.arrayBuffer();
      bodySize = buffer.byteLength;
    } catch {
      bodySize = -1;
    }
    
    console.log(`[${res.status}] ${item.label}`);
    console.log(`  URL: ${item.url.substring(0, 100)}${item.url.length > 100 ? "..." : ""}`);
    console.log(`  Content-Type: ${contentType}`);
    console.log(`  Content-Length header: ${contentLength}`);
    console.log(`  Actual body size: ${bodySize} bytes`);
    console.log(`  Status: ${res.status >= 200 && res.status < 400 ? "OK" : "FAILED"}`);
    console.log(`  Redirected: ${res.redirected} -> ${res.url.substring(0, 80)}`);
    console.log("");
    
    return { label: item.label, status: res.status, bodySize, contentType, ok: res.status >= 200 && res.status < 400 };
  } catch (err) {
    clearTimeout(timeout);
    console.log(`[ERROR] ${item.label}`);
    console.log(`  URL: ${item.url.substring(0, 100)}`);
    console.log(`  Error: ${err.message}`);
    console.log("");
    return { label: item.label, status: 0, bodySize: 0, contentType: "error", ok: false, error: err.message };
  }
}

async function main() {
  console.log("=== Media URL Accessibility Test ===");
  console.log(`Testing ${URLS_TO_TEST.length} URLs from Vercel serverless environment...\n`);
  
  const results = [];
  for (const item of URLS_TO_TEST) {
    const result = await testUrl(item);
    results.push(result);
  }
  
  console.log("\n=== SUMMARY ===");
  console.log("Label | Status | Size | Content-Type | OK?");
  console.log("-".repeat(100));
  for (const r of results) {
    console.log(`${r.label} | ${r.status} | ${r.bodySize} bytes | ${r.contentType?.substring(0, 30)} | ${r.ok ? "YES" : "NO"}`);
  }
  
  const failed = results.filter(r => !r.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} URL(s) FAILED:`);
    for (const f of failed) {
      console.log(`  - ${f.label}: ${f.error || `HTTP ${f.status}`}`);
    }
  }
  
  // Now test the actual Weibo API enrichment to see what data we get
  console.log("\n\n=== Weibo Top Post Enrichment Test ===");
  try {
    const searchRes = await fetch("https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D%E7%83%AD%E6%90%9C&page_type=searchall", {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        "Referer": "https://m.weibo.cn/",
      },
    });
    
    if (searchRes.ok) {
      const json = await searchRes.json();
      const cards = json?.data?.cards || [];
      console.log(`Got ${cards.length} card groups from Weibo search`);
      
      for (const card of cards.slice(0, 3)) {
        const mblog = card.mblog || card?.card_group?.[0]?.mblog;
        if (mblog) {
          const pics = mblog.pics || [];
          const pageInfo = mblog.page_info || {};
          console.log(`\n  Post by: ${mblog.user?.screen_name || "unknown"}`);
          console.log(`  Avatar: ${mblog.user?.profile_image_url?.substring(0, 80) || "none"}`);
          console.log(`  Text: ${(mblog.text || "").replace(/<[^>]+>/g, "").substring(0, 80)}`);
          console.log(`  Pics count: ${pics.length}`);
          if (pics[0]) {
            console.log(`  First pic URL: ${pics[0].url || pics[0].large?.url || "none"}`);
          }
          console.log(`  Has video: ${!!pageInfo.urls || !!pageInfo.media_info}`);
          if (pageInfo.urls) {
            const videoKeys = Object.keys(pageInfo.urls);
            console.log(`  Video qualities: ${videoKeys.join(", ")}`);
            console.log(`  Video URL sample: ${Object.values(pageInfo.urls)[0]?.substring(0, 80)}`);
          }
        }
      }
    } else {
      console.log(`Weibo search API returned: ${searchRes.status}`);
    }
  } catch (err) {
    console.log(`Weibo enrichment test failed: ${err.message}`);
  }
}

main().catch(console.error);
