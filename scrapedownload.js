const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cheerio = require('cheerio');

const BASE_API = 'http://localhost:3001/api/videos';
const DETAIL_API = 'http://localhost:3001/api/video-detail?url=';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Folder untuk menyimpan video
const downloadDir = path.join(os.homedir(), 'Documents', 'mmawatch');
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true });
}

// Buat nama file aman
const sanitizeFilename = (name) =>
  name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '_');

// Download file video
const downloadVideo = async (videoUrl, title) => {
  const filename = sanitizeFilename(title) + '.mp4';
  const filePath = path.join(downloadDir, filename);
  const writer = fs.createWriteStream(filePath);

  console.log(`⬇️  Downloading: ${title}`);
  console.log(`🔗 Download URL: ${videoUrl}`);

  const response = await axios.get(videoUrl, {
    responseType: 'stream',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      console.log(`💾 Saved: ${filename}`);
      resolve();
    });
    writer.on('error', reject);
  });
};

// Ambil direct mp4 dari halaman embed spcdn
const extractDirectVideoUrl = async (playerPageUrl) => {
  try {
    const res = await axios.get(playerPageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    const html = res.data;
    const $ = cheerio.load(html);

    // Debug isi awal halaman
    console.log('🧪 Player Page HTML (first 500 chars):\n', html.substring(0, 500));

    // Ambil dari tag video/source
    const videoUrl = $('video source').attr('src') || $('video').attr('src');

    if (videoUrl && videoUrl.startsWith('http')) {
      console.log(`✅ Extracted video URL: ${videoUrl}`);
      return videoUrl;
    } else {
      console.warn(`⚠️ Could not extract video from: ${playerPageUrl}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error scraping player page: ${playerPageUrl}`);
    console.error(error.message);
    return null;
  }
};

const scrapeAllVideos = async () => {
  const MAX_PAGES = 1; // Gunakan 1 dulu untuk testing cepat

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      console.log(`📦 Fetching videos from page ${page}...`);
      const { data } = await axios.get(`${BASE_API}?page=${page}`);
      const videos = data.videos || [];

      for (const video of videos) {
        try {
          const encodedUrl = encodeURIComponent(video.url);
          console.log(`🎥 Scraping detail for: ${video.title}`);

          const response = await axios.get(`${DETAIL_API}${encodedUrl}`);
          const detail = response.data;

          console.log('📋 Detail response:', detail);

          let videoUrl =
            detail.videoEmbed || detail.videoUrl || detail.video || detail.embed_url;

          if (videoUrl && videoUrl.includes('spcdn.xyz')) {
            console.log(`🌐 Scraping player page for direct link: ${videoUrl}`);
            videoUrl = await extractDirectVideoUrl(videoUrl);
          }

          console.log(`🔗 Final video URL: ${videoUrl || 'Not found'}`);

          if (videoUrl) {
            await downloadVideo(videoUrl, detail.title);
          } else {
            console.warn(`⚠️ No video URL found for: ${detail.title}`);
          }
        } catch (err) {
          console.error(`❌ Failed detail/download for: ${video.title}`);
          console.error(err.message);
        }

        await delay(500); // Delay antar video
      }
    } catch (err) {
      console.error(`❌ Failed to fetch page ${page}`);
      console.error(err.message);
    }

    await delay(1000); // Delay antar halaman
  }

  console.log('🎉 Scraping & downloading completed.');
};

scrapeAllVideos();
