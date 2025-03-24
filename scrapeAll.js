const axios = require('axios');

const BASE_API = 'http://localhost:3001/api/videos';
const DETAIL_API = 'http://localhost:3001/api/video-detail?url=';

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

const scrapeAllVideos = async () => {
  const MAX_PAGES = 300;

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
          console.log(`✅ Saved: ${response.data.title}`);
        } catch (err) {
          console.error(`❌ Failed detail for: ${video.title}`);
        }

        await delay(500); // delay to avoid server overload
      }
    } catch (err) {
      console.error(`❌ Failed to fetch page ${page}`);
    }

    await delay(1000); // delay between pages
  }

  console.log('🎉 Scraping completed.');
};

scrapeAllVideos();
