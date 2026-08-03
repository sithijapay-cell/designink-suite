<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'subscription_plan_id',
        'payment_method',
        'transaction_id',
        'sender_number',
        'amount',
        'status',
        'admin_note',
        'approved_at',
        'approved_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'approved_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function subscriptionPlan()
    {
        return $this->belongsTo(SubscriptionPlan::class);
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function approve($adminId, $note = null)
    {
        $this->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by' => $adminId,
            'admin_note' => $note,
        ]);

        // Create user subscription
        UserSubscription::create([
            'user_id' => $this->user_id,
            'subscription_plan_id' => $this->subscription_plan_id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addDays($this->subscriptionPlan->duration_days),
        ]);
    }

    public function reject($adminId, $note = null)
    {
        $this->update([
            'status' => 'rejected',
            'approved_by' => $adminId,
            'admin_note' => $note,
        ]);
    }
}
