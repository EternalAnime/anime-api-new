import { fetchAnilistInfo, mapAnilistToHiAnimeId, getEpisodesByHiAnimeId } from '../utils/anilist.service.js';
import extractAnimeInfo from '../extractors/animeInfo.extractor.js';
import { extractServers, extractStreamingInfo } from '../extractors/streamInfo.extractor.js';
import { getCachedData, setCachedData } from '../helper/cache.helper.js';

/**
 * Test AniList ID mapping
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @returns {object} - Mapping result
 */
export const testAnilistMapping = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Validate ID
    if (!id || isNaN(Number(id))) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid AniList ID: ${id}. Must be a number.` 
      });
      return;
    }
    
    console.log(`Testing AniList ID mapping for ID: ${id}`);
    
    // First get AniList info
    let anilistInfo;
    try {
      anilistInfo = await fetchAnilistInfo(id);
      console.log('AniList info fetched successfully');
    } catch (error) {
      console.error(`Failed to fetch AniList info for ID ${id}:`, error);
      res.status(404).json({ 
        success: false, 
        message: `Failed to fetch AniList info: ${error.message}` 
      });
      return;
    }
    
    // Then try to map to HiAnime ID
    let hiAnimeId;
    try {
      hiAnimeId = await mapAnilistToHiAnimeId(id);
      console.log(`Successfully mapped AniList ID ${id} to HiAnime ID ${hiAnimeId}`);
    } catch (error) {
      console.error(`Failed to map AniList ID ${id} to HiAnime ID:`, error);
      res.status(404).json({ 
        success: false, 
        message: error.message || `Failed to map AniList ID ${id} to HiAnime ID` 
      });
      return;
    }
    
    return {
      success: true,
      anilistId: Number(id),
      anilistInfo: {
        title: anilistInfo.title,
        episodes: anilistInfo.episodes,
        format: anilistInfo.format,
        status: anilistInfo.status
      },
      hiAnimeId
    };
  } catch (error) {
    console.error('Error in testAnilistMapping:', error);
    res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${error.message}` 
    });
    return;
  }
};

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
    // Validate ID
    if (!id || isNaN(Number(id))) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid AniList ID: ${id}. Must be a number.` 
      });
      return;
    }

    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData && Object.keys(cachedData).length > 0) {
      return cachedData;
    }

    // Get HiAnime ID from AniList ID
    let hiAnimeId;
    try {
      hiAnimeId = await mapAnilistToHiAnimeId(id);
    } catch (error) {
      console.error(`Failed to map AniList ID ${id} to HiAnime ID:`, error);
      res.status(404).json({ 
        success: false, 
        message: error.message || `Failed to map AniList ID ${id} to HiAnime ID` 
      });
      return;
    }
    
    // Get anime info from HiAnime
    const animeInfo = await extractAnimeInfo(hiAnimeId);
    if (!animeInfo) {
      res.status(404).json({ 
        success: false, 
        message: `Failed to extract anime info for HiAnime ID: ${hiAnimeId}` 
      });
      return;
    }
    
    // Get episodes list
    let episodesList;
    try {
      episodesList = await getEpisodesByHiAnimeId(hiAnimeId);
    } catch (error) {
      console.error(`Failed to get episodes for HiAnime ID ${hiAnimeId}:`, error);
      episodesList = [];
    }
    
    // Combine data
    const responseData = {
      anilistId: Number(id),
      hiAnimeId,
      info: animeInfo,
      episodes: episodesList || []
    };

    // Cache the response
    setCachedData(cacheKey, responseData, 3600).catch((err) => {
      console.error("Failed to set cache:", err);
    });

    return responseData;
  } catch (error) {
    console.error('Error in getAnimeInfoByAnilistId:', error);
    res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${error.message}` 
    });
    return;
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
    // Validate ID and episode number
    if (!id || isNaN(Number(id))) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid AniList ID: ${id}. Must be a number.` 
      });
      return;
    }

    if (!episodeNumber || isNaN(Number(episodeNumber))) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid episode number: ${episodeNumber}. Must be a number.` 
      });
      return;
    }

    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData && Object.keys(cachedData).length > 0) {
      return cachedData;
    }

    // Get HiAnime ID from AniList ID
    let hiAnimeId;
    try {
      hiAnimeId = await mapAnilistToHiAnimeId(id);
    } catch (error) {
      console.error(`Failed to map AniList ID ${id} to HiAnime ID:`, error);
      res.status(404).json({ 
        success: false, 
        message: error.message || `Failed to map AniList ID ${id} to HiAnime ID` 
      });
      return;
    }
    
    // Get episodes list
    let episodesList;
    try {
      episodesList = await getEpisodesByHiAnimeId(hiAnimeId);
    } catch (error) {
      console.error(`Failed to get episodes for HiAnime ID ${hiAnimeId}:`, error);
      res.status(404).json({ 
        success: false, 
        message: `Failed to get episodes for anime with AniList ID ${id}: ${error.message}` 
      });
      return;
    }
    
    // Find the requested episode
    const episode = episodesList.find(ep => ep.number === Number(episodeNumber));
    
    if (!episode) {
      res.status(404).json({ 
        success: false, 
        message: `Episode ${episodeNumber} not found for anime with AniList ID ${id}` 
      });
      return;
    }
    
    // Get servers for the episode
    const servers = await extractServers(episode.episodeId);
    
    if (!servers || servers.length === 0) {
      res.status(404).json({ 
        success: false, 
        message: `No servers found for episode ${episodeNumber} of anime with AniList ID ${id}` 
      });
      return;
    }
    
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
    res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${error.message}` 
    });
    return;
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
  
  try {
    // Validate parameters
    if (!id || isNaN(Number(id))) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid AniList ID: ${id}. Must be a number.` 
      });
      return;
    }

    if (!episodeNumber || isNaN(Number(episodeNumber))) {
      res.status(400).json({ 
        success: false, 
        message: `Invalid episode number: ${episodeNumber}. Must be a number.` 
      });
      return;
    }
    
    if (!server) {
      res.status(400).json({ 
        success: false, 
        message: 'Server parameter is required' 
      });
      return;
    }
    
    const cacheKey = `anilist_sources_${id}_${episodeNumber}_${server}_${type}`;

    // Check cache first
    const cachedData = await getCachedData(cacheKey);
    if (cachedData && Object.keys(cachedData).length > 0) {
      return cachedData;
    }

    // Get HiAnime ID from AniList ID
    let hiAnimeId;
    try {
      hiAnimeId = await mapAnilistToHiAnimeId(id);
    } catch (error) {
      console.error(`Failed to map AniList ID ${id} to HiAnime ID:`, error);
      res.status(404).json({ 
        success: false, 
        message: error.message || `Failed to map AniList ID ${id} to HiAnime ID` 
      });
      return;
    }
    
    // Get episodes list
    let episodesList;
    try {
      episodesList = await getEpisodesByHiAnimeId(hiAnimeId);
    } catch (error) {
      console.error(`Failed to get episodes for HiAnime ID ${hiAnimeId}:`, error);
      res.status(404).json({ 
        success: false, 
        message: `Failed to get episodes for anime with AniList ID ${id}: ${error.message}` 
      });
      return;
    }
    
    // Find the requested episode
    const episode = episodesList.find(ep => ep.number === Number(episodeNumber));
    
    if (!episode) {
      res.status(404).json({ 
        success: false, 
        message: `Episode ${episodeNumber} not found for anime with AniList ID ${id}` 
      });
      return;
    }
    
    // Get streaming sources
    let streamingInfo;
    try {
      streamingInfo = await extractStreamingInfo(episode.id, server, type);
    } catch (error) {
      console.error(`Failed to extract streaming info:`, error);
      res.status(500).json({ 
        success: false, 
        message: `Failed to extract streaming sources: ${error.message}` 
      });
      return;
    }
    
    if (!streamingInfo || !streamingInfo.streamingLink || streamingInfo.streamingLink.length === 0) {
      res.status(404).json({ 
        success: false, 
        message: `No streaming sources found for episode ${episodeNumber} with server ${server} and type ${type}` 
      });
      return;
    }
    
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
    res.status(500).json({ 
      success: false, 
      message: `Internal server error: ${error.message}` 
    });
    return;
  }
}; 
