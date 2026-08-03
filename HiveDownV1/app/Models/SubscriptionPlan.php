<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'duration_days',
        'features',
        'is_active',
        'daily_download_limit',
        'monthly_download_limit',
        'can_download_hd',
        'can_download_4k',
        'no_ads',
        'priority_support',
    ];

    protected $casts = [
        'features' => 'array',
        'is_active' => 'boolean',
        'price' => 'decimal:2',
        'daily_download_limit' => 'integer',
        'monthly_download_limit' => 'integer',
        'can_download_hd' => 'boolean',
        'can_download_4k' => 'boolean',
        'no_ads' => 'boolean',
        'priority_support' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($plan) {
            if (empty($plan->slug)) {
                $plan->slug = \Illuminate\Support\Str::slug($plan->name);
                
                // Ensure unique slug
                $originalSlug = $plan->slug;
                $count = 1;
                while (static::where('slug', $plan->slug)->exists()) {
                    $plan->slug = $originalSlug . '-' . $count;
                    $count++;
                }
            }
        });
    }

    public function userSubscriptions()
    {
        return $this->hasMany(UserSubscription::class);
    }

    public function paymentRequests()
    {
        return $this->hasMany(PaymentRequest::class);
    }
}
