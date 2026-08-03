<div class="downloader-component">
    <div class="card">
        <h2 class="text-center mb-4">Download Your Video</h2>
        
        <form wire:submit.prevent="submit">
            <div class="form-group">
                <label for="url" class="form-label">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    Video URL
                </label>
                <input 
                    type="url" 
                    id="url" 
                    wire:model="url" 
                    class="form-input" 
                    placeholder="Paste your video URL here (YouTube, TikTok, Instagram, etc.)..." 
                    required
                >
                @error('url') 
                    <span style="color: #d63031; font-size: 0.875rem; margin-top: 0.5rem; display: block;">
                        {{ $message }}
                    </span> 
                @enderror
            </div>

            <div class="text-center">
                <button type="submit" class="btn btn-primary" wire:loading.attr="disabled">
                    <span wire:loading.remove wire:target="submit">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Start Download
                    </span>
                    <span wire:loading wire:target="submit" style="display: none;">
                        <span class="loading"></span>
                        Processing...
                    </span>
                </button>
            </div>
        </form>

        @if($jobId)
            <div class="status-box" wire:poll.2s="pollStatus">
                <p style="font-weight: 700; margin-bottom: 1rem; font-size: 1.1rem;">
                    Download Status
                </p>
                
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <span class="status-badge status-{{ $jobStatus }}">
                        {{ ucfirst($jobStatus) }}
                    </span>
                </div>
                
                @if($jobStatus === 'pending')
                    <p style="color: #636e72; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="loading"></span>
                        Your download is queued and will start shortly...
                    </p>
                @endif

                @if($jobStatus === 'processing')
                    <p style="color: #0984e3; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="loading"></span>
                        We are processing your video. This may take a few moments...
                    </p>
                @endif

                @if($downloadLink)
                    <div class="mt-4 text-center" style="padding: 1.5rem; background: linear-gradient(135deg, #55efc4 0%, #00b894 100%); border-radius: 1rem;">
                        <p style="color: white; font-weight: 600; margin-bottom: 1rem; font-size: 1.1rem;">
                            Your video is ready! Download starting automatically...
                        </p>
                        <a href="{{ $downloadLink }}" 
                           id="download-link-{{ $jobId }}" 
                           class="btn btn-primary" 
                           download
                           style="background: white; color: #00b894;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px; display: inline-block; vertical-align: middle; margin-right: 8px;">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download Now
                        </a>
                        <p style="color: white; font-size: 0.875rem; margin-top: 1rem; opacity: 0.9;">
                            Click if download doesn't start automatically
                        </p>
                    </div>
                    
                    <!-- Hidden iframe for auto-download -->
                    <iframe id="download-iframe-{{ $jobId }}" style="display: none;"></iframe>
                    
                    <script>
                        // Auto-download using iframe
                        (function() {
                            const downloadUrl = '{{ $downloadLink }}';
                            const iframe = document.getElementById('download-iframe-{{ $jobId }}');
                            
                            if (iframe && !iframe.dataset.loaded) {
                                iframe.dataset.loaded = 'true';
                                
                                // Trigger download after short delay
                                setTimeout(() => {
                                    iframe.src = downloadUrl;
                                }, 500);
                            }
                        })();
                    </script>
                @endif

                @if($errorMessage)
                    <div style="padding: 1rem; background: linear-gradient(135deg, #ff7675 0%, #d63031 100%); border-radius: 0.75rem; margin-top: 1rem;">
                        <p style="color: white; font-weight: 600;">
                            Error: {{ $errorMessage }}
                        </p>
                    </div>
                @endif
            </div>
        @endif
    </div>
</div>
