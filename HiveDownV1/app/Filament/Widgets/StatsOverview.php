<?php

namespace App\Filament\Widgets;

use App\Models\DownloadJob;
use App\Models\User;
use App\Models\UserSubscription;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected function getStats(): array
    {
        $totalDownloads = DownloadJob::count();
        $completedDownloads = DownloadJob::where('status', 'completed')->count();
        $processingDownloads = DownloadJob::where('status', 'processing')->count();
        $failedDownloads = DownloadJob::where('status', 'failed')->count();
        
        $totalUsers = User::count();
        $activeSubscriptions = UserSubscription::where('status', 'active')->count();
        
        $todayDownloads = DownloadJob::whereDate('created_at', today())->count();
        
        return [
            Stat::make('Total Downloads', $totalDownloads)
                ->description('All time downloads')
                ->descriptionIcon('heroicon-m-arrow-trending-up')
                ->chart([7, 12, 15, 18, 22, 28, $totalDownloads])
                ->color('success'),
                
            Stat::make('Completed Downloads', $completedDownloads)
                ->description($completedDownloads > 0 ? round(($completedDownloads / $totalDownloads) * 100, 1) . '% success rate' : 'No downloads yet')
                ->descriptionIcon('heroicon-m-check-circle')
                ->color('success'),
                
            Stat::make('Processing', $processingDownloads)
                ->description('Currently processing')
                ->descriptionIcon('heroicon-m-arrow-path')
                ->color('warning'),
                
            Stat::make('Failed Downloads', $failedDownloads)
                ->description($failedDownloads > 0 ? round(($failedDownloads / $totalDownloads) * 100, 1) . '% failure rate' : 'No failures')
                ->descriptionIcon('heroicon-m-x-circle')
                ->color('danger'),
                
            Stat::make('Total Users', $totalUsers)
                ->description('Registered users')
                ->descriptionIcon('heroicon-m-users')
                ->chart([5, 10, 15, 20, 25, $totalUsers])
                ->color('info'),
                
            Stat::make('Active Subscriptions', $activeSubscriptions)
                ->description($activeSubscriptions > 0 ? round(($activeSubscriptions / max($totalUsers, 1)) * 100, 1) . '% conversion rate' : 'No subscriptions')
                ->descriptionIcon('heroicon-m-currency-dollar')
                ->color('success'),
                
            Stat::make('Today\'s Downloads', $todayDownloads)
                ->description('Downloads today')
                ->descriptionIcon('heroicon-m-calendar')
                ->color('primary'),
        ];
    }
}
