/**
 * YouTube IFrame Player wrapper for synchronized rhythm game audio playback.
 * Fully movable/draggable on mobile and desktop, position-aware, and guarded against
 * lifecycle races, button overlap, and autoplay restrictions.
 */

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PositionCoords {
  left?: number;
  top?: number;
  right?: number;
  bottom?: number;
}

class YouTubePlayerController {
  private player: any = null;
  private isReady = false;
  private isScriptLoaded = false;
  private pendingVideoId: string | null = null;
  private wrapperElementId = 'youtube-player-wrapper';
  private targetElementId = 'youtube-game-player';
  private videoContainerId = 'youtube-player-video-container';
  private onReadyCallbacks: Array<() => void> = [];
  private onStateChangeCallbacks: Array<(state: number) => void> = [];
  private onErrorCallbacks: Array<(error: any) => void> = [];
  private onVisibilityCallbacks: Array<(visible: boolean) => void> = [];
  private playerState: number = -1;
  private lastPolledTime = 0;
  private lastPollTimestamp = 0;
  private currentVideoId: string | null = null;
  private isMinimized = false;
  private isVisibleState = true;
  private currentCornerIndex = 0;

  constructor() {
    this.initScript();
  }

  private initScript() {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      this.isScriptLoaded = true;
      return;
    }

    const pollTimer = setInterval(() => {
      if (window.YT && window.YT.Player) {
        this.isScriptLoaded = true;
        clearInterval(pollTimer);
        if (this.pendingVideoId) {
          const vid = this.pendingVideoId;
          this.pendingVideoId = null;
          this.mountPlayer(vid);
        }
      }
    }, 100);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') {
        try {
          prevReady();
        } catch (_) {}
      }
      this.isScriptLoaded = true;
      clearInterval(pollTimer);
      if (this.pendingVideoId) {
        const vid = this.pendingVideoId;
        this.pendingVideoId = null;
        this.mountPlayer(vid);
      }
    };

    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api-script';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }

  private ensureDOMContainers(): HTMLElement {
    let wrapper = document.getElementById(this.wrapperElementId);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.id = this.wrapperElementId;
      wrapper.style.position = 'fixed';
      wrapper.style.zIndex = '45';
      wrapper.style.backgroundColor = '#09090b';
      wrapper.style.borderRadius = '12px';
      wrapper.style.boxShadow = '0 12px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.12)';
      wrapper.style.overflow = 'hidden';
      wrapper.style.transition = 'box-shadow 0.2s ease';
      wrapper.style.touchAction = 'none';

      // Load saved position or use safe default away from bottom buttons
      const savedPos = this.loadSavedPosition();
      if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
        wrapper.style.left = `${savedPos.left}px`;
        wrapper.style.top = `${savedPos.top}px`;
        wrapper.style.right = 'auto';
        wrapper.style.bottom = 'auto';
      } else {
        // Safe default: placed top-right below the game top bar so bottom lane hit buttons are 100% unobstructed!
        wrapper.style.top = isMobile ? '68px' : '76px';
        wrapper.style.right = isMobile ? '12px' : '16px';
        wrapper.style.left = 'auto';
        wrapper.style.bottom = 'auto';
      }

      this.updateDimensions(wrapper, isMobile);

      // Create Drag Header
      const header = document.createElement('div');
      header.id = 'youtube-player-header';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.style.height = '26px';
      header.style.padding = '0 6px 0 8px';
      header.style.backgroundColor = '#18181b';
      header.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
      header.style.cursor = 'grab';
      header.style.userSelect = 'none';
      header.style.webkitUserSelect = 'none';
      header.title = 'Drag to reposition anywhere';

      // Left title with drag handle icon
      const titleSpan = document.createElement('div');
      titleSpan.style.display = 'flex';
      titleSpan.style.alignItems = 'center';
      titleSpan.style.gap = '5px';
      titleSpan.style.color = '#a1a1aa';
      titleSpan.style.fontSize = '10px';
      titleSpan.style.fontWeight = '700';
      titleSpan.style.letterSpacing = '0.02em';
      titleSpan.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="12" r="1"></circle>
          <circle cx="9" cy="5" r="1"></circle>
          <circle cx="9" cy="19" r="1"></circle>
          <circle cx="15" cy="12" r="1"></circle>
          <circle cx="15" cy="5" r="1"></circle>
          <circle cx="15" cy="19" r="1"></circle>
        </svg>
        <span>YT Music</span>
      `;
      header.appendChild(titleSpan);

      // Actions right
      const actionsDiv = document.createElement('div');
      actionsDiv.style.display = 'flex';
      actionsDiv.style.alignItems = 'center';
      actionsDiv.style.gap = '4px';

      // Snap Button
      const snapBtn = document.createElement('button');
      snapBtn.type = 'button';
      snapBtn.title = 'Snap corner position';
      snapBtn.style.background = 'transparent';
      snapBtn.style.border = 'none';
      snapBtn.style.color = '#71717a';
      snapBtn.style.cursor = 'pointer';
      snapBtn.style.padding = '2px 4px';
      snapBtn.style.borderRadius = '4px';
      snapBtn.style.display = 'flex';
      snapBtn.style.alignItems = 'center';
      snapBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4"/>
        </svg>
      `;
      snapBtn.onpointerdown = (e) => e.stopPropagation();
      snapBtn.onclick = (e) => {
        e.stopPropagation();
        this.snapNextCorner();
      };
      actionsDiv.appendChild(snapBtn);

      // Minimize Button
      const minBtn = document.createElement('button');
      minBtn.id = 'yt-btn-minimize';
      minBtn.type = 'button';
      minBtn.title = 'Minimize / Expand';
      minBtn.style.background = 'transparent';
      minBtn.style.border = 'none';
      minBtn.style.color = '#71717a';
      minBtn.style.cursor = 'pointer';
      minBtn.style.padding = '2px 4px';
      minBtn.style.borderRadius = '4px';
      minBtn.style.display = 'flex';
      minBtn.style.alignItems = 'center';
      minBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      `;
      minBtn.onpointerdown = (e) => e.stopPropagation();
      minBtn.onclick = (e) => {
        e.stopPropagation();
        this.toggleMinimize();
      };
      actionsDiv.appendChild(minBtn);

      // Close / Hide Button
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.title = 'Hide video (audio continues)';
      closeBtn.style.background = 'transparent';
      closeBtn.style.border = 'none';
      closeBtn.style.color = '#71717a';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.padding = '2px 4px';
      closeBtn.style.borderRadius = '4px';
      closeBtn.style.display = 'flex';
      closeBtn.style.alignItems = 'center';
      closeBtn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;
      closeBtn.onpointerdown = (e) => e.stopPropagation();
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.setVisible(false);
      };
      actionsDiv.appendChild(closeBtn);

      header.appendChild(actionsDiv);
      wrapper.appendChild(header);

      // Video Container
      const videoContainer = document.createElement('div');
      videoContainer.id = this.videoContainerId;
      videoContainer.style.width = '100%';
      videoContainer.style.height = isMobile ? '90px' : '124px';
      videoContainer.style.backgroundColor = '#000';
      wrapper.appendChild(videoContainer);

      // Setup Drag handling
      this.attachDragListeners(header, wrapper);

      document.body.appendChild(wrapper);
    }

    let videoContainer = document.getElementById(this.videoContainerId);
    if (!videoContainer) {
      videoContainer = document.createElement('div');
      videoContainer.id = this.videoContainerId;
      videoContainer.style.width = '100%';
      videoContainer.style.height = isMobile ? '90px' : '124px';
      videoContainer.style.backgroundColor = '#000';
      wrapper.appendChild(videoContainer);
    }

    let target = document.getElementById(this.targetElementId);
    if (!target) {
      target = document.createElement('div');
      target.id = this.targetElementId;
      target.style.width = '100%';
      target.style.height = '100%';
      videoContainer.appendChild(target);
    }

    return target;
  }

  private updateDimensions(wrapper: HTMLElement, isMobile: boolean) {
    if (this.isMinimized) {
      wrapper.style.width = '128px';
      wrapper.style.height = '26px';
    } else {
      wrapper.style.width = isMobile ? '160px' : '220px';
      wrapper.style.height = isMobile ? '116px' : '150px';
    }
  }

  private attachDragListeners(handle: HTMLElement, target: HTMLElement) {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const onPointerDown = (e: PointerEvent) => {
      // Don't drag if clicking buttons
      if ((e.target as HTMLElement)?.closest('button')) return;

      isDragging = true;
      handle.style.cursor = 'grabbing';
      handle.setPointerCapture(e.pointerId);

      const rect = target.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      // Ensure explicit left/top are set
      target.style.left = `${initialLeft}px`;
      target.style.top = `${initialTop}px`;
      target.style.right = 'auto';
      target.style.bottom = 'auto';
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      const width = target.offsetWidth || 160;
      const height = target.offsetHeight || 116;

      const minLeft = 6;
      const maxLeft = Math.max(minLeft, window.innerWidth - width - 6);
      const minTop = 50; // Below status/nav bars
      const maxTop = Math.max(minTop, window.innerHeight - height - 6);

      const newLeft = Math.min(Math.max(minLeft, initialLeft + deltaX), maxLeft);
      const newTop = Math.min(Math.max(minTop, initialTop + deltaY), maxTop);

      target.style.left = `${newLeft}px`;
      target.style.top = `${newTop}px`;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';
      try {
        handle.releasePointerCapture(e.pointerId);
      } catch (_) {}

      // Save user-preferred position
      const rect = target.getBoundingClientRect();
      this.savePosition({ left: Math.round(rect.left), top: Math.round(rect.top) });
    };

    handle.addEventListener('pointerdown', onPointerDown);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
    handle.addEventListener('pointercancel', onPointerUp);
  }

  public snapNextCorner() {
    const wrapper = document.getElementById(this.wrapperElementId);
    if (!wrapper) return;

    const isMobile = window.innerWidth < 640;
    const width = this.isMinimized ? 128 : isMobile ? 160 : 220;
    const height = this.isMinimized ? 26 : isMobile ? 116 : 150;

    // 4 Safe corner presets that NEVER cover the bottom lane buttons:
    // 0: Top-Right (default)
    // 1: Top-Left
    // 2: Mid-Left (centered vertically on the left side)
    // 3: Mid-Right (centered vertically on the right side)
    this.currentCornerIndex = (this.currentCornerIndex + 1) % 4;

    let targetLeft = 12;
    let targetTop = 68;

    switch (this.currentCornerIndex) {
      case 0: // Top-Right
        targetLeft = window.innerWidth - width - 12;
        targetTop = 68;
        break;
      case 1: // Top-Left
        targetLeft = 12;
        targetTop = 68;
        break;
      case 2: // Mid-Left
        targetLeft = 12;
        targetTop = Math.round(window.innerHeight * 0.38);
        break;
      case 3: // Mid-Right
        targetLeft = window.innerWidth - width - 12;
        targetTop = Math.round(window.innerHeight * 0.38);
        break;
    }

    wrapper.style.left = `${targetLeft}px`;
    wrapper.style.top = `${targetTop}px`;
    wrapper.style.right = 'auto';
    wrapper.style.bottom = 'auto';

    this.savePosition({ left: targetLeft, top: targetTop });
  }

  public toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    const wrapper = document.getElementById(this.wrapperElementId);
    const videoContainer = document.getElementById(this.videoContainerId);
    const minBtn = document.getElementById('yt-btn-minimize');
    const isMobile = window.innerWidth < 640;

    if (!wrapper || !videoContainer) return;

    if (this.isMinimized) {
      videoContainer.style.display = 'none';
      wrapper.style.width = '128px';
      wrapper.style.height = '26px';
      if (minBtn) {
        minBtn.title = 'Expand video';
        minBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          </svg>
        `;
      }
    } else {
      videoContainer.style.display = 'block';
      wrapper.style.width = isMobile ? '160px' : '220px';
      wrapper.style.height = isMobile ? '116px' : '150px';
      if (minBtn) {
        minBtn.title = 'Minimize player';
        minBtn.innerHTML = `
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        `;
      }
    }
  }

  private savePosition(pos: PositionCoords) {
    try {
      sessionStorage.setItem('rhythm_yt_player_pos', JSON.stringify(pos));
    } catch (_) {}
  }

  private loadSavedPosition(): PositionCoords | null {
    try {
      const raw = sessionStorage.getItem('rhythm_yt_player_pos');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
          // Verify it's still within current viewport
          if (parsed.left < window.innerWidth - 30 && parsed.top < window.innerHeight - 30) {
            return parsed;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  public mountPlayer(videoId: string) {
    this.currentVideoId = videoId;

    if (!this.isScriptLoaded || !window.YT || !window.YT.Player) {
      this.pendingVideoId = videoId;
      return;
    }

    this.ensureDOMContainers();

    // If player already exists and is healthy, load new video
    if (this.player && typeof this.player.loadVideoById === 'function') {
      try {
        this.player.loadVideoById(videoId);
        this.isReady = true;
        if (typeof this.player.playVideo === 'function') {
          try {
            this.player.playVideo();
          } catch (e) {
            console.warn('YouTube playVideo on re-mount failed:', e);
          }
        }
        this.onReadyCallbacks.forEach((cb) => {
          try {
            cb();
          } catch (_) {}
        });
        return;
      } catch (e) {
        console.warn('Re-creating player because loadVideoById threw:', e);
      }
    }

    // Clean up stale player instance
    if (this.player && typeof this.player.destroy === 'function') {
      try {
        this.player.destroy();
      } catch (e) {
        console.warn('Player destroy warning:', e);
      }
      this.player = null;
    }

    // Reset video container element while preserving header and drag setup
    const videoContainer = document.getElementById(this.videoContainerId);
    if (videoContainer) {
      videoContainer.innerHTML = `<div id="${this.targetElementId}" style="width:100%;height:100%;"></div>`;
    }

    const isMobile = window.innerWidth < 640;
    const playerWidth = isMobile ? '160' : '220';
    const playerHeight = isMobile ? '90' : '124';

    try {
      let createdPlayerInstance: any = null;

      createdPlayerInstance = new window.YT.Player(this.targetElementId, {
        width: playerWidth,
        height: playerHeight,
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: (event: any) => {
            const playerInstance = event?.target || createdPlayerInstance || this.player;
            if (playerInstance) {
              this.player = playerInstance;
            }
            this.isReady = true;
            this.pendingVideoId = null;

            if (playerInstance && typeof playerInstance.playVideo === 'function') {
              try {
                playerInstance.playVideo();
              } catch (e) {
                console.warn('YouTube auto-play in onReady blocked or failed:', e);
              }
            }

            this.onReadyCallbacks.forEach((cb) => {
              try {
                cb();
              } catch (cbErr) {
                console.warn('onReadyCallback error:', cbErr);
              }
            });
          },
          onStateChange: (event: any) => {
            this.playerState = event?.data ?? -1;
            if (this.playerState === 1) { // PLAYING
              try {
                this.lastPolledTime = this.player?.getCurrentTime?.() || 0;
                this.lastPollTimestamp = performance.now();
              } catch (_) {}
            }
            this.onStateChangeCallbacks.forEach((cb) => {
              try {
                cb(event.data);
              } catch (_) {}
            });
          },
          onError: (err: any) => {
            console.warn('YouTube Player Event Error:', err);
            this.onErrorCallbacks.forEach((cb) => {
              try {
                cb(err);
              } catch (_) {}
            });
          },
        },
      });

      this.player = createdPlayerInstance;
    } catch (err) {
      console.warn('Failed to construct new window.YT.Player:', err);
    }
  }

  public play() {
    if (this.player && typeof this.player.playVideo === 'function') {
      try {
        this.player.playVideo();
      } catch (e) {
        console.warn('YouTube play failed:', e);
      }
    }
  }

  public pause() {
    if (this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch (e) {
        console.warn('YouTube pause failed:', e);
      }
    }
  }

  public stop() {
    if (this.player && typeof this.player.stopVideo === 'function') {
      try {
        this.player.stopVideo();
      } catch (e) {
        console.warn('YouTube stop failed:', e);
      }
    }
    const wrapper = document.getElementById(this.wrapperElementId);
    if (wrapper) {
      wrapper.style.display = 'none';
    }
    this.isVisibleState = false;
    this.notifyVisibility(false);
  }

  public seekTo(seconds: number) {
    if (this.player && typeof this.player.seekTo === 'function') {
      try {
        this.player.seekTo(seconds, true);
      } catch (e) {
        console.warn('YouTube seekTo failed:', e);
      }
    }
  }

  public setVolume(volume0to1: number) {
    if (this.player && typeof this.player.setVolume === 'function') {
      try {
        this.player.setVolume(Math.round(Math.max(0, Math.min(1, volume0to1)) * 100));
      } catch (e) {
        console.warn('YouTube setVolume failed:', e);
      }
    }
  }

  public setVisible(visible: boolean) {
    this.isVisibleState = visible;
    const wrapper = document.getElementById(this.wrapperElementId);
    if (wrapper) {
      wrapper.style.display = visible ? 'block' : 'none';
    }
    this.notifyVisibility(visible);
  }

  public isVisible(): boolean {
    return this.isVisibleState;
  }

  public addVisibilityListener(cb: (visible: boolean) => void) {
    this.onVisibilityCallbacks.push(cb);
  }

  public removeVisibilityListener(cb: (visible: boolean) => void) {
    this.onVisibilityCallbacks = this.onVisibilityCallbacks.filter((c) => c !== cb);
  }

  private notifyVisibility(visible: boolean) {
    this.onVisibilityCallbacks.forEach((cb) => {
      try {
        cb(visible);
      } catch (_) {}
    });
  }

  public addErrorListener(cb: (err: any) => void) {
    this.onErrorCallbacks.push(cb);
  }

  public removeErrorListener(cb: (err: any) => void) {
    this.onErrorCallbacks = this.onErrorCallbacks.filter((c) => c !== cb);
  }

  /**
   * Returns current playback time in seconds with microsecond interpolation
   * for zero-jitter rhythm game note alignment and tight drum-beat synchronicity.
   */
  public getCurrentTime(): number {
    if (!this.player || typeof this.player.getCurrentTime !== 'function') {
      return 0;
    }

    try {
      const now = performance.now();
      const rawTime = this.player.getCurrentTime() || 0;

      if (rawTime !== this.lastPolledTime) {
        this.lastPolledTime = rawTime;
        this.lastPollTimestamp = now;
        return rawTime;
      }

      // If YouTube is playing, smoothly extrapolate based on high-resolution clock
      // up to 0.8s between poll ticks so there are never jerky freeze/snaps
      if (this.playerState === 1 || this.playerState === -1) {
        const elapsed = (now - this.lastPollTimestamp) / 1000;
        if (elapsed > 0 && elapsed < 0.8) {
          return this.lastPolledTime + elapsed;
        }
      }
      return rawTime;
    } catch (e) {
      return 0;
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.player && this.isReady);
  }

  public getCurrentVideoId(): string | null {
    return this.currentVideoId;
  }
}

export const youtubePlayer = new YouTubePlayerController();
