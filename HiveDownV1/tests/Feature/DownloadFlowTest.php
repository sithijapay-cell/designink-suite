<?php

namespace Tests\Feature;

use App\Livewire\Downloader;
use App\Models\User;
use App\Jobs\ProcessDownload;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Livewire\Livewire;
use Tests\TestCase;

class DownloadFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_submit_download_job()
    {
        Queue::fake();

        $user = User::factory()->create();

        Livewire::actingAs($user)
            ->test(Downloader::class)
            ->set('url', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
            ->call('submit')
            ->assertHasNoErrors();

        Queue::assertPushed(ProcessDownload::class);
    }
}
