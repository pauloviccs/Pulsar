export type SourcePlatform = 'youtube' | 'youtube_music' | 'spotify';
export type ImportConfidence = 'high' | 'medium' | 'low' | 'not_found';

export interface LinkDetection {
  platform: SourcePlatform | 'unknown';
  link_type: 'track' | 'playlist' | 'album' | 'radio' | 'unknown';
  normalized_url: string;
}

export interface SpotifyImportProgress {
  current: number;
  total: number;
  current_track_title: string;
  confidence: ImportConfidence;
}

export interface Track {
  id: string;
  youtube_video_id: string;
  title: string;
  artist_guess: string;
  channel_name: string;
  artist?: string;
  thumbnail?: string;
  duration_seconds: number;
  thumbnail_url: string;
  audio_stream_cached?: boolean;
  added_at: string;
  stream_url?: string;
  source_platform?: SourcePlatform;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover_image: string;
  created_at: string;
  is_imported_youtube_playlist: boolean;
  source_youtube_playlist_id?: string | null;
  track_count: number;
  total_duration_seconds: number;
  visibility?: PlaylistVisibility;
  user_id?: string;
}

export type RepeatMode = 'none' | 'one' | 'all';

export interface PlaybackState {
  current_track: Track | null;
  current_playlist_id: string | null;
  position_seconds: number;
  duration_seconds: number;
  volume: number;
  is_playing: boolean;
  shuffle: boolean;
  repeat_mode: RepeatMode;
  video_visible: boolean;
  is_buffering: boolean;
}

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'idle' | 'dnd';
export type PlaylistVisibility = 'public' | 'private' | 'shared';
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface UserProfile {
  id: string;
  username: string;
  tag: string; // Ex: 7X9A
  display_name: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  presence?: PresenceStatus;
  presence_status?: PresenceStatus;
  custom_status?: string;
  listening_track_title?: string | null;
  listening_artist?: string | null;
  current_track_title?: string | null;
  created_at: string;
  followers_count?: number;
  following_count?: number;
  is_following?: boolean;
}

export interface CloudPlaylist {
  id: string;
  user_id: string;
  name: string;
  description: string;
  cover_image_url: string;
  visibility: PlaylistVisibility;
  created_at: string;
  track_count?: number;
  author_name?: string;
  author_tag?: string;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: FriendshipStatus;
  created_at: string;
  friend_username: string;
  friend_tag: string;
  friend_display_name: string;
  friend_avatar?: string;
  presence_status?: PresenceStatus;
  current_track_title?: string | null;
  friend_profile?: UserProfile;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  shared_track_id?: string | null;
  shared_track_title?: string | null;
  shared_track?: Track | null;
  is_read?: boolean;
  read?: boolean;
  created_at: string;
}

export type ActiveView = 'home' | 'library' | 'recent' | 'playlists' | 'playlist-detail' | 'favorites' | 'profile' | 'social-search' | 'settings';

export interface UserSettings {
  volume: number;
  shuffle: boolean;
  repeat_mode: RepeatMode;
  locale: string;
  video_visible: boolean;
  spotify_connected?: boolean;
  lastfm_username?: string;
}

export type CloudSyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CommunityTrendingPlaylist {
  id: string;
  name: string;
  description: string;
  cover_image_url: string;
  track_count: number;
  play_count: number;
  likes_count: number;
  created_at: string;
  owner_id?: string;
  owner_username?: string;
  owner_display_name?: string;
  owner_avatar_url?: string;
}

export interface QuickAccessItem {
  id: string;
  type: 'liked' | 'playlist' | 'track';
  title: string;
  subtitle?: string;
  cover_image: string;
  track_count?: number;
  data: any;
}

