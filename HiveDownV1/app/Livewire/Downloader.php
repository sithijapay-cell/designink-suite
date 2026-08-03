<?php

namespace App\Livewire;

use Livewire\Component;
use App\Models\DownloadJob;
use Illuminate\Support\Facades\Auth;
use App\Jobs\ProcessDownload;

class Downloader extends Component
{
    public $url;
    public $format = 'video'; // video, audio, muted
    public $quality = 'best'; // best, 1080p, 720p, 480p, 360p
    public $jobId;
    public $jobStatus;
    public $downloadLink;
    public $errorMessage;

    protected $rules = [
        'url' => 'required|url',
        'format' => 'required|in:video,audio,muted',
        'quality' => 'required|in:best,1080p,720p,480p,360p',
    ];

    public function submit()
    {
        $this->validate();

        // Create a new download job
        $job = DownloadJob::create([
            'user_id' => Auth::id(),
            'url' => $this->url,
            'provider' => 'yt-dlp',
            'status' => 'pending',
            'meta_data' => [
                'format' => $this->format,
                'quality' => $this->quality,
            ],
        ]);

        $this->jobId = $job->id;
        $this->jobStatus = 'pending';
        $this->errorMessage = null;
        $this->downloadLink = null;

        // Dispatch the job synchronously for instant processing
        ProcessDownload::dispatchSync($job);
    }

    public function pollStatus()
    {
        if (!$this->jobId) {
            return;
        }

        $job = DownloadJob::find($this->jobId);
        if (!$job) {
            $this->errorMessage = 'Job not found.';
            return;
        }

        $this->jobStatus = $job->status;

        if ($job->status === 'completed') {
            $this->downloadLink = $job->download_link;
        } elseif ($job->status === 'failed') {
            $this->errorMessage = $job->error_message ?? 'Download failed.';
        }
    }

    public function render()
    {
        return view('livewire.downloader');
    }
}
