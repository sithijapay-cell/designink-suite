<x-dashboard-layout>
    <div class="dashboard-header">
        <h1>My Subscription</h1>
        <p>Manage your subscription and view plan details</p>
    </div>
    
    @if(session('success'))
    <div style="background: #D1FAE5; border: 1px solid #059669; border-radius: 0.75rem; padding: 1rem 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 24px; height: 24px; color: #059669; flex-shrink: 0;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div style="color: #065F46; font-weight: 500;">{{ session('success') }}</div>
    </div>
    @endif
    
    @if($subscription)
    <!-- Active Subscription -->
    <div class="content-card" style="margin-bottom: 2rem;">
        <div class="content-card-header">
            <h2 class="content-card-title">Current Plan</h2>
            <span class="badge success">Active</span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; margin-bottom: 2rem;">
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.5rem;">Plan Name</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #111827;">{{ $subscription->plan->name ?? 'No Plan' }}</div>
            </div>
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.5rem;">Price</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #4F46E5;">৳{{ number_format($subscription->plan->price ?? 0, 2) }}</div>
            </div>
            <div>
                <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.5rem;">Status</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #059669;">{{ ucfirst($subscription->status) }}</div>
            </div>
        </div>
        
        <div style="border-top: 1px solid #E5E7EB; padding-top: 1.5rem;">
            <h3 style="font-weight: 600; margin-bottom: 1rem;">Subscription Period</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
                <div>
                    <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Start Date</div>
                    <div style="font-weight: 600;">{{ $subscription->starts_at->format('M d, Y') }}</div>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">End Date</div>
                    <div style="font-weight: 600;">{{ $subscription->ends_at->format('M d, Y') }}</div>
                </div>
                <div>
                    <div style="color: #6B7280; font-size: 0.875rem; margin-bottom: 0.25rem;">Days Remaining</div>
                    <div style="font-weight: 600; color: #4F46E5;">{{ $subscription->ends_at->diffInDays(now()) }} days</div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Plan Features -->
    <div class="content-card">
        <div class="content-card-header">
            <h2 class="content-card-title">Plan Features</h2>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 0.5rem; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">Daily Downloads</div>
                    <div style="color: #6B7280; font-size: 0.875rem;">{{ $subscription->plan->daily_download_limit ?? 'Unlimited' }} downloads per day</div>
                </div>
            </div>
            
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 0.5rem; background: #D1FAE5; color: #059669; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">Monthly Downloads</div>
                    <div style="color: #6B7280; font-size: 0.875rem;">{{ $subscription->plan->monthly_download_limit ?? 'Unlimited' }} downloads per month</div>
                </div>
            </div>
            
            @if($subscription->plan->can_download_hd ?? false)
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 0.5rem; background: #FEF3C7; color: #D97706; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">HD Downloads</div>
                    <div style="color: #6B7280; font-size: 0.875rem;">Download in HD quality</div>
                </div>
            </div>
            @endif
            
            @if($subscription->plan->can_download_4k ?? false)
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 0.5rem; background: #FEE2E2; color: #DC2626; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">4K Downloads</div>
                    <div style="color: #6B7280; font-size: 0.875rem;">Download in 4K quality</div>
                </div>
            </div>
            @endif
            
            @if($subscription->plan->no_ads ?? false)
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 0.5rem; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">Ad-Free</div>
                    <div style="color: #6B7280; font-size: 0.875rem;">No advertisements</div>
                </div>
            </div>
            @endif
            
            @if($subscription->plan->priority_support ?? false)
            <div style="display: flex; align-items: start; gap: 1rem;">
                <div style="width: 40px; height: 40px; border-radius: 0.5rem; background: #D1FAE5; color: #059669; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 20px; height: 20px;">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">Priority Support</div>
                    <div style="color: #6B7280; font-size: 0.875rem;">Get priority customer support</div>
                </div>
            </div>
            @endif
        </div>
    </div>
    
    @else
    <!-- No Active Subscription -->
    <div class="content-card" style="text-align: center; padding: 3rem;">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 80px; height: 80px; margin: 0 auto 1.5rem; color: #6B7280;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">No Active Subscription</h2>
        <p style="color: #6B7280; margin-bottom: 2rem;">You don't have an active subscription. Upgrade to premium to unlock all features!</p>
        <a href="{{ route('dashboard.plans') }}" class="btn btn-primary" style="padding: 0.75rem 2rem; display: inline-block;">
            View Plans
        </a>
    </div>
    @endif
</x-dashboard-layout>
