import axios from 'axios';
import * as cheerio from 'cheerio';
import { v1_base_url } from './base_v1.js';
import match from 'string-similarity-js';

// AniList GraphQL API URL
const ANILIST_BASEURL = 'https://graphql.anilist.co';

// GraphQL query to get anime information from AniList
const ANIME_QUERY = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    idMal
    title {
      romaji
      english
      native
      userPreferred
    }
    coverImage {
      extraLarge
      large
      medium
      color
    }
    format
    description
    genres
    season
    episodes
    status
    seasonYear
  }
}
`;

/**
 * Fetches anime information from AniList API by ID
 * @param {number} anilistId - The AniList ID of the anime
 * @returns {Promise<object>} - Anime information from AniList
 */
export async function fetchAnilistInfo(anilistId) {
  try {
    const response = await axios.post(ANILIST_BASEURL, {
      query: ANIME_QUERY,
      variables: {
        id: anilistId,
      },
    });

    return response.data.data.Media;
  } catch (error) {
    console.error('Error fetching AniList info:', error);
    throw new Error('Failed to fetch anime information from AniList');
  }
}

/**
 * Maps an AniList ID to a HiAnime ID by searching for the title
 * @param {number} anilistId - The AniList ID to map
 * @returns {Promise<string>} - The HiAnime ID
 */
export async function mapAnilistToHiAnimeId(anilistId) {
  try {
    // Get anime info from AniList
    const anilistData = await fetchAnilistInfo(anilistId);
    
    if (!anilistData) {
      throw new Error(`Anime with AniList ID ${anilistId} not found`);
    }

    // Use the English title for search, fallback to romaji if not available
    const searchTitle = anilistData.title.english || anilistData.title.romaji;
    
    // Search for the anime on HiAnime
    const response = await axios.get(`https://${v1_base_url}/search?keyword=${encodeURIComponent(searchTitle)}`);
    const $ = cheerio.load(response.data);
    
    // Extract search results
    let similarTitles = [];
    $('.film_list-wrap > .flw-item .film-detail .film-name a').each((i, el) => {
      const title = $(el).text();
      const id = $(el).attr('href')?.split('/').pop()?.split('?')[0] || '';
      const similarity = Number(
        (match(title.replace(/[\,\:]/g, ''), searchTitle) * 10).toFixed(2)
      );
      similarTitles.push({ id, title, similarity });
    });

    // Sort by similarity score
    similarTitles.sort((a, b) => b.similarity - a.similarity);
    
    // If no results found
    if (similarTitles.length === 0) {
      throw new Error(`No matches found for anime with AniList ID ${anilistId}`);
    }

    // Handle season matching similar to hianime-mapper
    if (
      (searchTitle.match(/\Season(.+?)\d/) && similarTitles[0].title.match(/\Season(.+?)\d/)) || 
      (!searchTitle.match(/\Season(.+?)\d/) && !similarTitles[0].title.match(/\Season(.+?)\d/))
    ) {
      return similarTitles[0].id;
    } else {
      return similarTitles[1]?.id || similarTitles[0].id;
    }
  } catch (error) {
    console.error('Error mapping AniList ID to HiAnime ID:', error);
    throw new Error(`Failed to map AniList ID ${anilistId} to HiAnime ID`);
  }
}

/**
 * Gets episode list for an anime using its HiAnime ID
 * @param {string} hiAnimeId - The HiAnime ID
 * @returns {Promise<Array>} - List of episodes
 */
export async function getEpisodesByHiAnimeId(hiAnimeId) {
  try {
    const animeId = hiAnimeId.split('-').pop();
    const response = await axios.get(
      `https://${v1_base_url}/ajax/v2/episode/list/${animeId}`,
      {
        headers: {
          'Referer': `https://${v1_base_url}/watch/${hiAnimeId}`,
          'X-Requested-With': 'XMLHttpRequest',
        },
      }
    );
    
    const $ = cheerio.load(response.data.html);
    let episodesList = [];
    
    $('#detail-ss-list div.ss-list a').each((i, el) => {
      episodesList.push({
        id: $(el).attr('href')?.split('/').pop() || '',
        episodeId: Number($(el).attr('href')?.split('?ep=').pop()),
        title: $(el).attr('title') || '',
        number: i + 1,
      });
    });

    return episodesList;
  } catch (error) {
    console.error('Error fetching episodes by HiAnime ID:', error);
    throw new Error(`Failed to get episodes for HiAnime ID ${hiAnimeId}`);
  }
} 
