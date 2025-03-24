const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const supabase = require('./supabaseClient'); // Supabase client

const app = express();
const PORT = 3002;
const BASE_URL = 'https://watchmmafull.com';

app.use(cors());

app.get('/api/videos', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const url = page === 1 ? BASE_URL : `${BASE_URL}/new/${page}`;

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const videos = [];

    $('li.item-movie a').each((i, el) => {
      const title = $(el).attr('title') || $(el).find('h3').text().trim();
      const href = $(el).attr('href');
      const thumbnail = $(el).find('img').attr('src');

      if (title && href) {
        videos.push({
          title,
          url: `${BASE_URL}${href}`,
          thumbnail: thumbnail.startsWith('http') ? thumbnail : `${BASE_URL}${thumbnail}`,
        });
      }
    });

    res.json({ page, url, videos });
  } catch (error) {
    console.error(`Error scraping videos on page ${page}:`, error.message);
    res.status(500).json({ error: `Failed to scrape videos on page ${page}.` });
  }
});

app.get('/api/video-detail', async (req, res) => {
  const { url } = req.query;

  if (!url || !url.startsWith(BASE_URL)) {
    return res.status(400).json({ error: 'Invalid or missing URL.' });
  }

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const iframeSrc = $('iframe').first().attr('src');
    const title = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim();

    let thumbnail = $('meta[property="og:image"]').attr('content') || $('.thumb-bv').attr('src');
    if (thumbnail && !thumbnail.startsWith('http')) {
      thumbnail = `${BASE_URL}${thumbnail}`;
    }

    const categories = [];
    let foundCategories = false;
    $('#extras').children().each((_, el) => {
      if ($(el).is('h4') && $(el).text().includes('Categories:')) {
        foundCategories = true;
        return;
      }
      if (foundCategories) {
        if ($(el).is('h4')) return false;
        if ($(el).is('a[rel="category tag"]')) {
          categories.push($(el).text().trim());
        }
      }
    });

    const fighters = [];
    let foundFighters = false;
    $('#extras').children().each((_, el) => {
      if ($(el).is('h4') && $(el).text().includes('Fighters:')) {
        foundFighters = true;
        return;
      }
      if (foundFighters) {
        if ($(el).is('h4')) return false;
        if ($(el).is('a[rel="category tag"]')) {
          fighters.push($(el).text().trim());
        }
      }
    });

    let description = '';
    const articleParagraphs = $('article.infobv p');
    if (articleParagraphs.length >= 2) {
      const p1 = $(articleParagraphs[0]).text().trim();
      const p2 = $(articleParagraphs[1]).text().trim();
      description = `${p1} ${p2}`;
    } else if (articleParagraphs.length === 1) {
      description = $(articleParagraphs[0]).text().trim();
    }

    if (iframeSrc) {
      // 🟡 Tambahan: cek akses ke iframe video dengan User-Agent Chrome Desktop
      try {
        await axios.get(iframeSrc, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
              'AppleWebKit/537.36 (KHTML, like Gecko) ' +
              'Chrome/122.0.0.0 Safari/537.36',
            'Referer': url,
          }
        });
      } catch (err) {
        console.warn('⚠️ Gagal akses video iframe:', err.message);
        return res.status(500).json({ error: 'Failed to access iframe video.' });
      }

      // Cek jika sudah ada di Supabase
      const { data: existingByTitle, error: errorTitle } = await supabase
        .from('video_details')
        .select('id')
        .eq('title', title)
        .limit(1);

      const { data: existingByEmbed, error: errorEmbed } = await supabase
        .from('video_details')
        .select('id')
        .eq('video_embed', iframeSrc)
        .limit(1);

      if (errorTitle || errorEmbed) {
        console.error('Supabase check error:', errorTitle || errorEmbed);
        return res.status(500).json({ error: 'Failed to check existing video in Supabase.' });
      }

      if ((existingByTitle && existingByTitle.length > 0) || (existingByEmbed && existingByEmbed.length > 0)) {
        return res.json({
          title,
          thumbnail,
          videoEmbed: iframeSrc,
          categories,
          fighters,
          description,
          savedToSupabase: false,
          message: 'Video already exists in Supabase.',
        });
      }

      const { error: insertError } = await supabase.from('video_details').insert({
        url,
        title,
        thumbnail,
        video_embed: iframeSrc,
        categories,
        fighters,
        description
      });

      if (insertError) {
        console.error('Supabase insert error:', insertError.message);
      }

      res.json({
        title,
        thumbnail,
        videoEmbed: iframeSrc,
        categories,
        fighters,
        description,
        savedToSupabase: !insertError,
      });
    } else {
      res.status(404).json({ error: 'Embed video not found.' });
    }
  } catch (error) {
    console.error('Error scraping video detail:', error.message);
    res.status(500).json({ error: 'Failed to scrape video detail.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
