<?php

namespace Tests\Feature;

use App\Models\SystemConfiguration;
use App\Models\User;
use App\Models\SubscriptionPlan;
use App\Models\UserSubscription;
use App\Services\PremiumService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PremiumToggleTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_have_premium_access_when_fully_free_mode_is_on()
    {
        // Set to Fully Free (premium_mode = false)
        SystemConfiguration::set('premium_mode', false, 'boolean');

        $user = User::factory()->create();

        $this->assertTrue(PremiumService::isFullyFreeMode());
        $this->assertTrue(PremiumService::userHasPremiumAccess($user));
        $this->assertTrue(PremiumService::userHasPremiumAccess(null)); // Even guests might get perks, or at least logic returns true
    }

    public function test_users_do_not_have_premium_access_when_premium_mode_is_on()
    {
        // Set to Premium Mode (premium_mode = true)
        SystemConfiguration::set('premium_mode', true, 'boolean');

        $user = User::factory()->create();

        $this->assertFalse(PremiumService::isFullyFreeMode());
        $this->assertFalse(PremiumService::userHasPremiumAccess($user));
    }

    public function test_subscribers_have_premium_access_in_premium_mode()
    {
        SystemConfiguration::set('premium_mode', true, 'boolean');

        $user = User::factory()->create();
        $plan = SubscriptionPlan::create([
            'name' => 'Pro',
            'slug' => 'pro',
            'price' => 10,
            'is_active' => true
        ]);

        UserSubscription::create([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'stripe_subscription_id' => 'sub_123',
            'status' => 'active',
        ]);

        $this->assertTrue(PremiumService::userHasPremiumAccess($user));
    }
}
