import { fetchAnilistInfo, mapAnilistToHiAnimeId, getEpisodesByHiAnimeId } from '../utils/anilist.service.js';
import extractAnimeInfo from '../extractors/animeInfo.extractor.js';
import { extractServers, extractStreamingInfo } from '../extractors/streamInfo.extractor.js';
import { getCachedData, setCachedData } from '../helper/cache.helper.js';

/**
 * Get anime info by AniList ID
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} - Anime info with episodes
 */
export const getAnimeInfoByAnilistId = async (req, res) => {
  const { id } = req.params;
  const cacheKey = `anilist_info_${id}`;

  try {
    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData && Object.keys(cachedData).length > 0) {
      return cachedData;
    }

    // Get HiAnime ID from AniList ID
    const hiAnimeId = await mapAnilistToHiAnimeId(id);
    
    // Get anime info from HiAnime
    const animeInfo = await extractAnimeInfo(hiAnimeId);
    
    // Get episodes list
    const episodesList = await getEpisodesByHiAnimeId(hiAnimeId);
    
    // Combine data
    const responseData = {
      anilistId: Number(id),
      hiAnimeId,
      info: animeInfo,
      episodes: episodesList
    };

    // Cache the response
    setCachedData(cacheKey, responseData, 3600).catch((err) => {
      console.error("Failed to set cache:", err);
    });

    return responseData;
  } catch (error) {
    console.error('Error in getAnimeInfoByAnilistId:', error);
    throw error;
  }
};

/**
 * Get episode servers by AniList ID and episode number
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} - Episode servers
 */
export const getEpisodeServersByAnilistId = async (req, res) => {
  const { id, episodeNumber } = req.params;
  const cacheKey = `anilist_servers_${id}_${episodeNumber}`;

  try {
    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData && Object.keys(cachedData).length > 0) {
      return cachedData;
    }

    // Get HiAnime ID from AniList ID
    const hiAnimeId = await mapAnilistToHiAnimeId(id);
    
    // Get episodes list
    const episodesList = await getEpisodesByHiAnimeId(hiAnimeId);
    
    // Find the requested episode
    const episode = episodesList.find(ep => ep.number === Number(episodeNumber));
    
    if (!episode) {
      throw new Error(`Episode ${episodeNumber} not found for anime with AniList ID ${id}`);
    }
    
    // Get servers for the episode
    const servers = await extractServers(episode.episodeId);
    
    const responseData = {
      anilistId: Number(id),
      hiAnimeId,
      episodeNumber: Number(episodeNumber),
      episodeId: episode.episodeId,
      servers
    };

    // Cache the response
    setCachedData(cacheKey, responseData, 3600).catch((err) => {
      console.error("Failed to set cache:", err);
    });

    return responseData;
  } catch (error) {
    console.error('Error in getEpisodeServersByAnilistId:', error);
    throw error;
  }
};

/**
 * Get streaming sources by AniList ID, episode number, and server
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} - Streaming sources
 */
export const getStreamingSourcesByAnilistId = async (req, res) => {
  const { id, episodeNumber } = req.params;
  const { server, type = 'sub' } = req.query;
  
  if (!server) {
    throw new Error('Server parameter is required');
  }
  
  const cacheKey = `anilist_sources_${id}_${episodeNumber}_${server}_${type}`;

  try {
    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData && Object.keys(cachedData).length > 0) {
      return cachedData;
    }

    // Get HiAnime ID from AniList ID
    const hiAnimeId = await mapAnilistToHiAnimeId(id);
    
    // Get episodes list
    const episodesList = await getEpisodesByHiAnimeId(hiAnimeId);
    
    // Find the requested episode
    const episode = episodesList.find(ep => ep.number === Number(episodeNumber));
    
    if (!episode) {
      throw new Error(`Episode ${episodeNumber} not found for anime with AniList ID ${id}`);
    }
    
    // Get streaming sources
    const streamingInfo = await extractStreamingInfo(episode.id, server, type);
    
    const responseData = {
      anilistId: Number(id),
      hiAnimeId,
      episodeNumber: Number(episodeNumber),
      episodeId: episode.episodeId,
      server,
      type,
      sources: streamingInfo.streamingLink,
      availableServers: streamingInfo.servers
    };

    // Cache the response
    setCachedData(cacheKey, responseData, 1800).catch((err) => {
      console.error("Failed to set cache:", err);
    });

    return responseData;
  } catch (error) {
    console.error('Error in getStreamingSourcesByAnilistId:', error);
    throw error;
  }
}; 
