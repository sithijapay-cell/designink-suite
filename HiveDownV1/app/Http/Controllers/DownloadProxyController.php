<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class DownloadProxyController extends Controller
{
    public function download(Request $request)
    {
        $url = $request->query('url');
        $title = $request->query('title', 'video');
        
        if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
            abort(400, 'Invalid URL');
        }
        
        try {
            // Generate custom filename
            $siteName = \App\Models\SystemConfiguration::get('site_name', config('app.name', 'VideoDownloader'));
            $cleanTitle = $this->sanitizeFilename($title);
            $date = date('Y-m-d');
            $filename = "{$siteName}-{$cleanTitle}-{$date}.mp4";
            
            // Check if URL is HLS manifest
            $isHLS = (strpos($url, '.m3u8') !== false || strpos($url, '/manifest/') !== false);
            
            if ($isHLS) {
                // Use yt-dlp to download and stream
                $this->streamViaYtDlp($url, $filename);
            } else {
                // Direct stream for regular URLs
                $this->streamDirect($url, $filename);
            }
            
        } catch (\Exception $e) {
            \Log::error('Download error: ' . $e->getMessage());
            abort(500, 'Download error. Please try again.');
        }
    }
    
    private function streamViaYtDlp($url, $filename)
    {
        // Set headers first
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');
        
        // Disable output buffering
        if (ob_get_level()) {
            ob_end_clean();
        }
        
        // Stream directly using yt-dlp
        $pythonPath = '/home/imagetoo/.pyenv/shims/python';
        
        $command = sprintf(
            '%s -m yt_dlp --no-warnings --quiet -o - %s 2>/dev/null',
            $pythonPath,
            escapeshellarg($url)
        );
        
        // Execute and stream output
        $handle = popen($command, 'r');
        
        if ($handle) {
            while (!feof($handle)) {
                $chunk = fread($handle, 8192);
                if ($chunk !== false) {
                    echo $chunk;
                    flush();
                }
            }
            pclose($handle);
        } else {
            throw new \Exception('Failed to start download process');
        }
        
        exit;
    }
    
    private function streamDirect($url, $filename)
    {
        // Initialize cURL
        $ch = curl_init($url);
        
        curl_setopt_array($ch, [
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            CURLOPT_HTTPHEADER => [
                'Referer: https://www.youtube.com/',
                'Accept: */*',
            ],
            CURLOPT_WRITEFUNCTION => function($ch, $data) {
                echo $data;
                flush();
                return strlen($data);
            }
        ]);
        
        // Set download headers
        header('Content-Type: video/mp4');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Cache-Control: no-cache');
        header('X-Accel-Buffering: no');
        
        // Disable output buffering
        if (ob_get_level()) {
            ob_end_clean();
        }
        
        // Execute streaming
        curl_exec($ch);
        
        if (curl_errno($ch)) {
            throw new \Exception('Download failed: ' . curl_error($ch));
        }
        
        curl_close($ch);
        exit;
    }
    
    /**
     * Sanitize filename for safe download
     */
    private function sanitizeFilename($filename)
    {
        // Remove special characters and limit length
        $filename = preg_replace('/[^a-zA-Z0-9\s\-_]/', '', $filename);
        $filename = preg_replace('/\s+/', '-', $filename);
        $filename = substr($filename, 0, 50);
        return trim($filename, '-') ?: 'video';
    }
}
