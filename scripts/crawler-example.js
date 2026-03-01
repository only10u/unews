/**
 * 国内服务器爬虫脚本示例
 * 
 * 部署到腾讯云/阿里云等国内服务器，定时执行（建议每2-3分钟）
 * 
 * 功能：
 * 1. 爬取微博/抖音/公众号的热搜数据（含真实图片、头像、内容）
 * 2. 推送到 Vercel 主站的 /api/crawler/push 接口
 * 3. 主站会自动将图片转存到 R2，并缓存数据供前端使用
 * 
 * 使用方法：
 * 1. npm install node-fetch cheerio
 * 2. 设置环境变量 VERCEL_API_URL 和 CRAWLER_API_KEY
 * 3. node crawler-example.js
 * 
 * 定时任务 (crontab -e):
 * */2 * * * * /usr/bin/node /home/crawler/crawler-example.js >> /var/log/crawler.log 2>&1
 */

const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
const cheerio = (...args) => import('cheerio').then(({load}) => load(...args));

// Configuration
const VERCEL_API_URL = process.env.VERCEL_API_URL || 'https://www.10unews.com';
const CRAWLER_API_KEY = process.env.CRAWLER_API_KEY || 'douu-crawler-secret-2026';

// Common headers for requests
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const PC_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * 爬取微博热搜
 */
async function crawlWeibo() {
  console.log('[WEIBO] 开始爬取...');
  const items = [];
  
  try {
    // 1. 获取热搜列表
    const listRes = await fetch('https://weibo.com/ajax/side/hotSearch', {
      headers: {
        'User-Agent': PC_UA,
        'Accept': 'application/json',
        'Referer': 'https://weibo.com/',
      },
      timeout: 10000,
    });
    
    if (!listRes.ok) throw new Error(`热搜列表请求失败: ${listRes.status}`);
    const listData = await listRes.json();
    const realtime = listData?.data?.realtime || [];
    
    console.log(`[WEIBO] 获取到 ${realtime.length} 条热搜`);
    
    // 2. 为每条热搜获取置顶微博的详情
    for (let i = 0; i < Math.min(realtime.length, 20); i++) {
      const item = realtime[i];
      const keyword = item.word || '';
      
      try {
        // 搜索该关键词的微博
        const searchUrl = `https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D${encodeURIComponent(keyword)}&page_type=searchall`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': MOBILE_UA,
            'Accept': 'application/json',
            'Referer': 'https://m.weibo.cn/',
          },
          timeout: 8000,
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const cards = searchData?.data?.cards || [];
          
          // 找到第一条微博
          for (const card of cards) {
            const mblog = card.card_type === 9 ? card.mblog
              : card.card_type === 11 ? card.card_group?.find(s => s.card_type === 9)?.mblog
              : null;
            
            if (mblog) {
              // 提取图片
              const pics = mblog.pics || [];
              const firstPic = pics.length > 0 ? (pics[0].large?.url || pics[0].url) : null;
              const videoThumb = mblog.page_info?.page_pic?.url;
              
              items.push({
                rank: i + 1,
                title: keyword,
                hotValue: item.num || item.raw_hot || 0,
                url: `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}`,
                imageUrl: firstPic || videoThumb,
                videoUrl: mblog.page_info?.urls?.mp4_720p_mp4 || mblog.page_info?.media_info?.stream_url,
                authorName: mblog.user?.screen_name,
                authorAvatar: mblog.user?.profile_image_url,
                excerpt: stripHtml(mblog.text || '').substring(0, 120),
                detailContent: stripHtml(mblog.text || ''),
                mediaType: mblog.page_info?.type === 'video' ? 'video' : 'image',
              });
              break;
            }
          }
        }
        
        // 避免请求过快
        await sleep(300);
      } catch (e) {
        console.log(`[WEIBO] 获取 "${keyword}" 详情失败:`, e.message);
        // 添加基础数据
        items.push({
          rank: i + 1,
          title: keyword,
          hotValue: item.num || 0,
          url: `https://s.weibo.com/weibo?q=${encodeURIComponent(keyword)}`,
          excerpt: `#${keyword}# 正在热议中`,
        });
      }
    }
    
    console.log(`[WEIBO] 完成，共 ${items.length} 条，有图片 ${items.filter(i => i.imageUrl).length} 条`);
  } catch (e) {
    console.error('[WEIBO] 爬取失败:', e.message);
  }
  
  return items;
}

/**
 * 爬取抖音热搜
 */
async function crawlDouyin() {
  console.log('[DOUYIN] 开始爬取...');
  const items = [];
  
  try {
    // 抖音热搜接口
    const res = await fetch('https://www.iesdouyin.com/web/api/v2/hotsearch/billboard/word/', {
      headers: {
        'User-Agent': MOBILE_UA,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    const data = await res.json();
    const list = data?.word_list || [];
    
    console.log(`[DOUYIN] 获取到 ${list.length} 条热搜`);
    
    for (let i = 0; i < Math.min(list.length, 20); i++) {
      const item = list[i];
      items.push({
        rank: i + 1,
        title: item.word || '',
        hotValue: item.hot_value || 0,
        url: `https://www.douyin.com/search/${encodeURIComponent(item.word || '')}`,
        // 抖音热搜接口不直接返回图片，需要二级爬取
        // 可以尝试搜索视频获取封面，但这里简化处理
        excerpt: `#${item.word}# 正在抖音热播`,
        mediaType: 'video',
      });
    }
    
    console.log(`[DOUYIN] 完成，共 ${items.length} 条`);
  } catch (e) {
    console.error('[DOUYIN] 爬取失败:', e.message);
  }
  
  return items;
}

/**
 * 爬取公众号热文
 */
async function crawlGzh() {
  console.log('[GZH] 开始爬取...');
  const items = [];
  
  try {
    // 通过搜狗微信搜索获取热门文章
    const res = await fetch('https://weixin.sogou.com/pcindex/pc/pc_0/1.html', {
      headers: {
        'User-Agent': PC_UA,
        'Accept': 'text/html',
        'Referer': 'https://weixin.sogou.com/',
      },
      timeout: 10000,
    });
    
    if (!res.ok) throw new Error(`请求失败: ${res.status}`);
    const html = await res.text();
    
    // 使用 cheerio 解析 HTML
    const loadCheerio = await import('cheerio');
    const $ = loadCheerio.load(html);
    
    $('li').each((i, el) => {
      if (i >= 20) return false;
      const $el = $(el);
      const title = $el.find('a').text().trim();
      const link = $el.find('a').attr('href');
      const img = $el.find('img').attr('src');
      
      if (title && link) {
        items.push({
          rank: i + 1,
          title,
          hotValue: 0,
          url: link.startsWith('http') ? link : `https://weixin.sogou.com${link}`,
          imageUrl: img,
          authorName: '公众号热文',
          excerpt: title,
          mediaType: 'image',
        });
      }
    });
    
    console.log(`[GZH] 完成，共 ${items.length} 条，有图片 ${items.filter(i => i.imageUrl).length} 条`);
  } catch (e) {
    console.error('[GZH] 爬取失败:', e.message);
  }
  
  return items;
}

/**
 * 推送数据到 Vercel 主站
 */
async function pushToVercel(platform, items) {
  if (items.length === 0) {
    console.log(`[PUSH] ${platform} 无数据，跳过推送`);
    return;
  }
  
  console.log(`[PUSH] 推送 ${items.length} 条 ${platform} 数据到 Vercel...`);
  
  try {
    const res = await fetch(`${VERCEL_API_URL}/api/crawler/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Crawler-Key': CRAWLER_API_KEY,
      },
      body: JSON.stringify({
        platform,
        items,
        transferImages: true, // 让 Vercel 转存图片到 R2
      }),
      timeout: 30000,
    });
    
    if (res.ok) {
      const result = await res.json();
      console.log(`[PUSH] ${platform} 成功:`, result);
    } else {
      console.error(`[PUSH] ${platform} 失败: ${res.status} ${await res.text()}`);
    }
  } catch (e) {
    console.error(`[PUSH] ${platform} 异常:`, e.message);
  }
}

// Utility functions
function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main
async function main() {
  console.log('========================================');
  console.log('开始爬取任务:', new Date().toLocaleString('zh-CN'));
  console.log('========================================');
  
  // 并行爬取三个平台
  const [weiboItems, douyinItems, gzhItems] = await Promise.all([
    crawlWeibo(),
    crawlDouyin(),
    crawlGzh(),
  ]);
  
  // 推送到 Vercel
  await pushToVercel('weibo', weiboItems);
  await pushToVercel('douyin', douyinItems);
  await pushToVercel('gzh', gzhItems);
  
  console.log('========================================');
  console.log('爬取任务完成:', new Date().toLocaleString('zh-CN'));
  console.log('========================================');
}

main().catch(console.error);
