<x-dashboard-layout>
    <div class="dashboard-header">
        <h1>Welcome back, {{ auth()->user()->name }}!</h1>
        <p>Here's what's happening with your account today.</p>
    </div>
    
    <!-- Stats Grid -->
    <div class="stats-grid">
        @php
            $totalDownloads = \App\Models\DownloadJob::where('user_id', auth()->id())->count();
            $todayDownloads = \App\Models\DownloadJob::where('user_id', auth()->id())
                ->whereDate('created_at', today())
                ->count();
            $thisMonthDownloads = \App\Models\DownloadJob::where('user_id', auth()->id())
                ->whereMonth('created_at', now()->month)
                ->count();
        @endphp
        
        <div class="stat-card">
            <div class="stat-card-header">
                <div>
                    <div class="stat-value">{{ $totalDownloads }}</div>
                    <div class="stat-label">Total Downloads</div>
                </div>
                <div class="stat-icon primary">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                </div>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-card-header">
                <div>
                    <div class="stat-value">{{ $todayDownloads }}</div>
                    <div class="stat-label">Today's Downloads</div>
                </div>
                <div class="stat-icon success">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-card-header">
                <div>
                    <div class="stat-value">{{ $thisMonthDownloads }}</div>
                    <div class="stat-label">This Month</div>
                </div>
                <div class="stat-icon warning">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                </div>
            </div>
        </div>
        
        <div class="stat-card">
            <div class="stat-card-header">
                <div>
                    @if($subscription)
                        <div class="stat-value">{{ $subscription->ends_at->diffInDays(now()) }}</div>
                        <div class="stat-label">Days Remaining</div>
                    @else
                        <div class="stat-value">Free</div>
                        <div class="stat-label">Current Plan</div>
                    @endif
                </div>
                <div class="stat-icon {{ $subscription ? 'primary' : 'danger' }}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                    </svg>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Quick Action -->
    <div class="content-card" style="margin-bottom: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
        <div style="text-align: center; padding: 2rem;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto 1rem;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Download Videos Instantly</h3>
            <p style="margin-bottom: 1.5rem; opacity: 0.9;">Paste any video URL and get instant download link</p>
            <a href="{{ route('home') }}" class="btn btn-primary" style="background: white; color: #667eea; padding: 0.75rem 2rem; border-radius: 0.5rem; text-decoration: none; display: inline-block; font-weight: 600;">
                Start Downloading
            </a>
        </div>
    </div>
    
    <!-- Subscription Status -->
    @if($subscription)
    <div class="content-card" style="margin-bottom: 2rem;">
        <div class="content-card-header">
            <h2 class="content-card-title">Active Subscription</h2>
            <span class="badge success">Active</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Plan Name</div>
                <div style="font-weight: 600; color: #111827; font-size: 1.125rem;">{{ $subscription->plan->name ?? 'No Plan' }}</div>
            </div>
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Started</div>
                <div style="font-weight: 600; color: #111827;">{{ $subscription->starts_at->format('M d, Y') }}</div>
            </div>
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Expires On</div>
                <div style="font-weight: 600; color: #DC2626;">{{ $subscription->ends_at->format('M d, Y') }}</div>
            </div>
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Days Left</div>
                <div style="font-weight: 700; color: #4F46E5; font-size: 1.5rem;">{{ $subscription->ends_at->diffInDays(now()) }}</div>
            </div>
        </div>
        
        <!-- Progress Bar -->
        @php
            $totalDays = $subscription->starts_at->diffInDays($subscription->ends_at);
            $daysUsed = $subscription->starts_at->diffInDays(now());
            $progress = $totalDays > 0 ? ($daysUsed / $totalDays) * 100 : 0;
        @endphp
        <div style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-size: 0.875rem; color: #6B7280;">Subscription Progress</span>
                <span style="font-size: 0.875rem; font-weight: 600; color: #4F46E5;">{{ number_format($progress, 1) }}%</span>
            </div>
            <div style="width: 100%; height: 8px; background: #E5E7EB; border-radius: 9999px; overflow: hidden;">
                <div style="height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); width: {{ $progress }}%; transition: width 0.3s;"></div>
            </div>
        </div>
    </div>
    @else
    <div class="content-card" style="margin-bottom: 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
        <div style="text-align: center; padding: 2rem;">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 64px; height: 64px; margin: 0 auto 1rem;">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Upgrade to Premium</h3>
            <p style="margin-bottom: 1.5rem; opacity: 0.9;">Get unlimited downloads, HD quality, and ad-free experience</p>
            <a href="{{ route('dashboard.plans') }}" class="btn btn-primary" style="background: white; color: #667eea; padding: 0.75rem 2rem; border-radius: 0.5rem; text-decoration: none; display: inline-block; font-weight: 600;">
                View Plans
            </a>
        </div>
    </div>
    @endif
    
    <!-- Account Info -->
    <div class="content-card">
        <div class="content-card-header">
            <h2 class="content-card-title">Account Information</h2>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 48px; height: 48px; border-radius: 0.75rem; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Name</div>
                    <div style="font-weight: 600; color: #111827;">{{ auth()->user()->name }}</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 48px; height: 48px; border-radius: 0.75rem; background: #D1FAE5; color: #059669; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Email</div>
                    <div style="font-weight: 600; color: #111827;">{{ auth()->user()->email }}</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 48px; height: 48px; border-radius: 0.75rem; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 24px; height: 24px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Member Since</div>
                    <div style="font-weight: 600; color: #111827;">{{ auth()->user()->created_at->format('M d, Y') }}</div>
                </div>
            </div>
        </div>
    </div>
</x-dashboard-layout>
