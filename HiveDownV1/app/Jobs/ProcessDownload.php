<?php

namespace App\Jobs;

use App\Models\DownloadJob;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class ProcessDownload implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public DownloadJob $downloadJob
    ) {}

    public function handle(): void
    {
        try {
            $this->downloadJob->update(['status' => 'processing']);

            // Use free Cobalt API (no configuration needed)
            $this->processCobalt();

        } catch (\Exception $e) {
            \Log::error('Download job failed', [
                'job_id' => $this->downloadJob->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            $this->downloadJob->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'meta_data' => [
                    'error' => $e->getMessage(),
                    'failed_at' => now()->toDateTimeString(),
                ],
            ]);
        }
    }

    protected function processCobalt(): void
    {
        // Call our API server (subdomain with yt-dlp)
        $apiUrl = env('VIDEO_API_URL', 'https://api.hidedown.com');
        
        \Log::info('Calling Video API', [
            'url' => $this->downloadJob->url,
            'job_id' => $this->downloadJob->id,
            'api_url' => $apiUrl,
        ]);
        
        $response = Http::timeout(120)
            ->get($apiUrl, [
                'url' => $this->downloadJob->url,
            ]);

        \Log::info('API Response', [
            'status' => $response->status(),
            'body' => substr($response->body(), 0, 500),
        ]);

        if (!$response->successful()) {
            $errorBody = $response->body();
            \Log::error('API Error Response', ['body' => $errorBody]);
            throw new \Exception('API request failed: ' . $response->status() . ' - ' . substr($errorBody, 0, 200));
        }

        $data = $response->json();
        
        if (!isset($data['success']) || $data['success'] !== true) {
            $errorMsg = $data['error'] ?? 'API returned an error';
            \Log::error('API Error', ['error' => $errorMsg, 'data' => $data]);
            throw new \Exception($errorMsg);
        }

        $downloadUrl = $data['data']['url'] ?? null;
        
        if (!$downloadUrl) {
            throw new \Exception('No download URL in API response');
        }

        // Use proxy URL for cross-origin downloads
        $title = $data['data']['title'] ?? 'Downloaded Video';
        $proxyUrl = route('download.proxy', [
            'url' => $downloadUrl,
            'title' => $title
        ]);

        $this->downloadJob->update([
            'status' => 'completed',
            'completed_at' => now(),
            'download_link' => $proxyUrl,
            'provider' => 'yt-dlp',
            'meta_data' => [
                'title' => $data['data']['title'] ?? 'Downloaded Video',
                'thumbnail' => $data['data']['thumbnail'] ?? null,
                'duration' => $data['data']['duration'] ?? null,
                'uploader' => $data['data']['uploader'] ?? null,
            ],
        ]);
        
        \Log::info('Download completed via API', [
            'job_id' => $this->downloadJob->id,
            'title' => $data['data']['title'] ?? 'Unknown',
        ]);
    }
}
