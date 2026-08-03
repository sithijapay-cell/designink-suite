<?php

namespace App\View\Composers;

use App\Models\SystemConfiguration;
use Illuminate\View\View;

class SiteConfigComposer
{
    /**
     * Bind data to the view.
     */
    public function compose(View $view): void
    {
        $view->with([
            'siteName' => SystemConfiguration::get('site_name', config('app.name', 'Video Downloader')),
            'siteLogo' => SystemConfiguration::get('site_logo'),
            'siteFavicon' => SystemConfiguration::get('site_favicon'),
            'siteDescription' => SystemConfiguration::get('site_description', 'Download videos from any platform'),
            'ogImage' => SystemConfiguration::get('og_image'),
        ]);
    }
}
