<x-dashboard-layout>
    <div class="dashboard-header">
        <h1>Upgrade Your Plan</h1>
        <p>Choose the perfect plan for your needs</p>
    </div>
    
    @if($plans->count() > 0)
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
        @foreach($plans as $plan)
        <div class="content-card" style="position: relative;">
            @if($plan->name === 'Premium' || $plan->name === 'Pro')
            <div style="position: absolute; top: -10px; right: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.25rem 1rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;">
                Popular
            </div>
            @endif
            
            <div style="text-align: center; padding: 1rem 0;">
                <h3 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">{{ $plan->name }}</h3>
                @if($plan->description)
                <p style="color: #6B7280; margin-bottom: 1.5rem;">{{ $plan->description }}</p>
                @endif
                
                <div style="margin-bottom: 2rem;">
                    <span style="font-size: 3rem; font-weight: 700; color: #4F46E5;">৳{{ number_format($plan->price, 0) }}</span>
                    <span style="color: #6B7280;">/ {{ $plan->duration_days }} days</span>
                </div>
                
                <a href="{{ route('dashboard.checkout', $plan->id) }}" class="btn btn-primary" style="width: 100%; padding: 0.75rem; display: block; text-align: center;">
                    Choose Plan
                </a>
            </div>
            
            <div style="border-top: 1px solid #E5E7EB; padding-top: 1.5rem; margin-top: 1.5rem;">
                <div style="font-weight: 600; margin-bottom: 1rem;">Features:</div>
                <ul style="list-style: none; padding: 0; margin: 0;">
                    <li style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #059669; flex-shrink: 0;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{{ $plan->daily_download_limit }} downloads/day</span>
                    </li>
                    <li style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #059669; flex-shrink: 0;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{{ $plan->monthly_download_limit }} downloads/month</span>
                    </li>
                    @if($plan->can_download_hd)
                    <li style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #059669; flex-shrink: 0;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>HD Quality Downloads</span>
                    </li>
                    @endif
                    @if($plan->can_download_4k)
                    <li style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #059669; flex-shrink: 0;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>4K Quality Downloads</span>
                    </li>
                    @endif
                    @if($plan->no_ads)
                    <li style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #059669; flex-shrink: 0;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Ad-Free Experience</span>
                    </li>
                    @endif
                    @if($plan->priority_support)
                    <li style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px; color: #059669; flex-shrink: 0;">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Priority Support</span>
                    </li>
                    @endif
                </ul>
            </div>
        </div>
        @endforeach
    </div>
    @else
    <div class="content-card" style="text-align: center; padding: 3rem;">
        <p style="color: #6B7280;">No plans available at the moment.</p>
    </div>
    @endif
</x-dashboard-layout>
