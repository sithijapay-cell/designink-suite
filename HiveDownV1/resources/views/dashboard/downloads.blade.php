<x-dashboard-layout>
    <div class="dashboard-header">
        <h1>My Downloads</h1>
        <p>View and manage all your download history</p>
    </div>
    
    <div class="content-card">
        @if($downloads->count() > 0)
        <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid #E5E7EB;">
                        <th style="text-align: left; padding: 1rem; color: #111827; font-weight: 600;">URL</th>
                        <th style="text-align: left; padding: 1rem; color: #111827; font-weight: 600;">Status</th>
                        <th style="text-align: left; padding: 1rem; color: #111827; font-weight: 600;">Date</th>
                        <th style="text-align: left; padding: 1rem; color: #111827; font-weight: 600;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($downloads as $download)
                    <tr style="border-bottom: 1px solid #F3F4F6;">
                        <td style="padding: 1rem; max-width: 400px;">
                            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="{{ $download->url }}">
                                {{ $download->url }}
                            </div>
                            @if($download->meta_data && isset($download->meta_data['title']))
                            <div style="color: #6B7280; font-size: 0.875rem; margin-top: 0.25rem;">
                                {{ $download->meta_data['title'] }}
                            </div>
                            @endif
                        </td>
                        <td style="padding: 1rem;">
                            <span class="badge {{ $download->status === 'completed' ? 'success' : ($download->status === 'processing' ? 'warning' : ($download->status === 'failed' ? 'danger' : 'primary')) }}">
                                {{ ucfirst($download->status) }}
                            </span>
                        </td>
                        <td style="padding: 1rem; color: #6B7280;">
                            <div>{{ $download->created_at->format('M d, Y') }}</div>
                            <div style="font-size: 0.875rem;">{{ $download->created_at->format('h:i A') }}</div>
                        </td>
                        <td style="padding: 1rem;">
                            @if($download->status === 'completed' && $download->download_link)
                            <a href="{{ $download->download_link }}" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.875rem; display: inline-block;" target="_blank">
                                Download
                            </a>
                            @elseif($download->status === 'failed')
                            <span style="color: #DC2626; font-size: 0.875rem;">Failed</span>
                            @else
                            <span style="color: #D97706; font-size: 0.875rem;">Processing...</span>
                            @endif
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #E5E7EB;">
            {{ $downloads->links() }}
        </div>
        @else
        <div style="text-align: center; padding: 3rem; color: #6B7280;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto 1rem; opacity: 0.5;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <p>No downloads yet. Start downloading videos now!</p>
            <a href="{{ route('home') }}" class="btn btn-primary" style="margin-top: 1rem; display: inline-block;">
                Download Now
            </a>
        </div>
        @endif
    </div>
</x-dashboard-layout>
