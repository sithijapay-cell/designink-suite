<?php

namespace App\Http\Controllers;

use App\Models\DownloadJob;
use App\Models\UserSubscription;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        
        $subscription = UserSubscription::where('user_id', $user->id)
            ->where('status', 'active')
            ->first();
        
        return view('dashboard.index', compact('subscription'));
    }
    
    public function downloads()
    {
        $downloads = DownloadJob::where('user_id', auth()->id())
            ->latest()
            ->paginate(20);
        
        return view('dashboard.downloads', compact('downloads'));
    }
    
    public function subscription()
    {
        $subscription = UserSubscription::where('user_id', auth()->id())
            ->where('status', 'active')
            ->first();
        
        return view('dashboard.subscription', compact('subscription'));
    }
    
    public function plans()
    {
        $plans = \App\Models\SubscriptionPlan::where('is_active', true)->get();
        
        return view('dashboard.plans', compact('plans'));
    }
    
    public function checkout($planId)
    {
        $plan = \App\Models\SubscriptionPlan::findOrFail($planId);
        
        return view('dashboard.checkout', compact('plan'));
    }
    
    public function submitPayment(Request $request)
    {
        $request->validate([
            'subscription_plan_id' => 'required|exists:subscription_plans,id',
            'payment_method' => 'required|in:bkash,nagad,rocket',
            'sender_number' => 'required|string|max:20',
            'transaction_id' => 'required|string|max:255',
        ]);
        
        $plan = \App\Models\SubscriptionPlan::findOrFail($request->subscription_plan_id);
        
        // Create payment request
        \App\Models\PaymentRequest::create([
            'user_id' => auth()->id(),
            'subscription_plan_id' => $plan->id,
            'amount' => $plan->price,
            'payment_method' => $request->payment_method,
            'sender_number' => $request->sender_number,
            'transaction_id' => $request->transaction_id,
            'status' => 'pending',
        ]);
        
        return redirect()->route('dashboard.subscription')
            ->with('success', 'Payment request submitted successfully! We will verify and activate your subscription soon.');
    }
    
    public function profile()
    {
        return view('dashboard.profile');
    }
}
