// Vercel Serverless Function: 从 Notion API 获取法相天地数据
const NOTION_API = 'https://api.notion.com/v1';
const DATABASE_ID = '3af12e08d5a8803aa490f55d3e4b0976';

export default async function handler(req, res) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'NOTION_TOKEN not configured' });
  }

  try {
    const allEntries = [];
    let hasMore = true;
    let startCursor = null;

    // 分页获取所有数据
    while (hasMore) {
      const body = { page_size: 100 };
      if (startCursor) body.start_cursor = startCursor;

      const response = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('Notion API error:', response.status, err);
        return res.status(502).json({ error: 'Failed to fetch from Notion', detail: err });
      }

      const data = await response.json();

      // 解析每条记录
      for (const page of data.results) {
        const props = page.properties;
        const entry = {
          name: props['标题']?.title?.[0]?.plain_text || '',
          explanation: props['解释']?.rich_text?.[0]?.plain_text || '',
          example: props['案例']?.rich_text?.[0]?.plain_text || '',
          progress: props['进度']?.number ?? null,
          status: props['状态']?.select?.name || '等待',
          link: props['链接']?.url || ''
        };
        // 过滤掉空记录
        if (entry.name) {
          allEntries.push(entry);
        }
      }

      hasMore = data.has_more;
      startCursor = data.next_cursor || null;
    }

    return res.status(200).json({
      success: true,
      count: allEntries.length,
      data: allEntries,
      updatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}