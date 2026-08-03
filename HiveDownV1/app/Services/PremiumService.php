<?php

namespace App\Services;

use App\Models\SystemConfiguration;
use App\Models\User;

class PremiumService
{
    /**
     * Check if the system is in "Fully Free" mode.
     */
    public static function isFullyFreeMode(): bool
    {
        // If premium_mode is false, it means the site is "Fully Free"
        return !SystemConfiguration::get('premium_mode', true);
    }

    /**
     * Check if a user has premium access.
     * 
     * @param User|null $user
     * @return bool
     */
    public static function userHasPremiumAccess(?User $user): bool
    {
        if (self::isFullyFreeMode()) {
            return true;
        }

        if (!$user) {
            return false;
        }

        // Check for active subscription
        $subscription = $user->subscription;
        
        if ($subscription && $subscription->status === 'active') {
            return true;
        }

        // Check for admin/editor roles who might get free premium
        if ($user->hasRole(['super_admin', 'admin'])) {
            return true;
        }

        return false;
    }

    /**
     * Get the current download rate limit for a user.
     */
    public static function getDailyDownloadLimit(?User $user): int
    {
        if (self::userHasPremiumAccess($user)) {
            return (int) config('app.rate_limit_premium_downloads_per_day', 100);
        }

        return (int) config('app.rate_limit_free_downloads_per_day', 5);
    }
}
