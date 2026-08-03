<?php

namespace App\Filament\Pages;

use App\Models\SystemConfiguration;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Actions\Action;

class ManageSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-cog-6-tooth';
    
    protected static ?string $navigationLabel = 'General Settings';
    
    protected static ?int $navigationSort = 100;

    protected static string $view = 'filament.pages.manage-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'site_name' => SystemConfiguration::get('site_name', 'Video Downloader'),
            'site_logo' => SystemConfiguration::get('site_logo', ''),
            'site_favicon' => SystemConfiguration::get('site_favicon', ''),
            'premium_mode' => SystemConfiguration::get('premium_mode', true),
            'maintenance_mode' => SystemConfiguration::get('maintenance_mode', false),
            'legal_notice' => SystemConfiguration::get('legal_notice'),
            'primary_color' => SystemConfiguration::get('primary_color', '#4F46E5'),
            'downloads_per_day_free' => SystemConfiguration::get('downloads_per_day_free', 5),
            'downloads_per_day_premium' => SystemConfiguration::get('downloads_per_day_premium', 100),
            'facebook_url' => SystemConfiguration::get('facebook_url', '#'),
            'twitter_url' => SystemConfiguration::get('twitter_url', '#'),
            'instagram_url' => SystemConfiguration::get('instagram_url', '#'),
            'youtube_url' => SystemConfiguration::get('youtube_url', '#'),
            'bkash_number' => SystemConfiguration::get('bkash_number', ''),
            'nagad_number' => SystemConfiguration::get('nagad_number', ''),
            'rocket_number' => SystemConfiguration::get('rocket_number', ''),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('Branding & Appearance')
                    ->description('Customize your site\'s look and feel')
                    ->icon('heroicon-o-paint-brush')
                    ->collapsible()
                    ->schema([
                        TextInput::make('site_name')
                            ->label('Site Name')
                            ->required()
                            ->maxLength(255)
                            ->prefixIcon('heroicon-o-globe-alt')
                            ->placeholder('Enter your site name'),
                        
                        TextInput::make('site_logo')
                            ->label('Site Logo URL')
                            ->url()
                            ->prefixIcon('heroicon-o-photo')
                            ->placeholder('https://i.ibb.co/your-logo.png')
                            ->helperText('Upload to ImgBB and paste URL here'),
                        
                        TextInput::make('site_favicon')
                            ->label('Favicon URL')
                            ->url()
                            ->prefixIcon('heroicon-o-photo')
                            ->placeholder('https://i.ibb.co/your-favicon.png')
                            ->helperText('Upload to ImgBB and paste URL here'),
                        
                        TextInput::make('primary_color')
                            ->label('Primary Color')
                            ->type('color')
                            ->prefixIcon('heroicon-o-swatch'),
                    ])
                    ->columns(2),

                Section::make('Billing & Premium Features')
                    ->description('Control premium mode and subscription features')
                    ->icon('heroicon-o-currency-dollar')
                    ->collapsible()
                    ->schema([
                        Toggle::make('premium_mode')
                            ->label('Enable Premium Mode')
                            ->helperText('When disabled, all users get premium features for free')
                            ->onIcon('heroicon-o-lock-closed')
                            ->offIcon('heroicon-o-lock-open')
                            ->onColor('success')
                            ->offColor('danger')
                            ->inline(false),
                    ]),

                Section::make('Payment Methods')
                    ->description('Configure bKash, Nagad, and Rocket numbers for manual payments')
                    ->icon('heroicon-o-banknotes')
                    ->collapsible()
                    ->schema([
                        TextInput::make('bkash_number')
                            ->label('bKash Number')
                            ->tel()
                            ->prefixIcon('heroicon-o-device-phone-mobile')
                            ->placeholder('01XXXXXXXXX')
                            ->helperText('Users will send payment to this number'),
                        
                        TextInput::make('nagad_number')
                            ->label('Nagad Number')
                            ->tel()
                            ->prefixIcon('heroicon-o-device-phone-mobile')
                            ->placeholder('01XXXXXXXXX')
                            ->helperText('Users will send payment to this number'),
                        
                        TextInput::make('rocket_number')
                            ->label('Rocket Number')
                            ->tel()
                            ->prefixIcon('heroicon-o-device-phone-mobile')
                            ->placeholder('01XXXXXXXXX')
                            ->helperText('Users will send payment to this number'),
                    ])
                    ->columns(3),

                Section::make('System Settings')
                    ->description('Configure system behavior')
                    ->icon('heroicon-o-cog')
                    ->collapsible()
                    ->schema([
                        Toggle::make('maintenance_mode')
                            ->label('Maintenance Mode')
                            ->helperText('Put the site in maintenance mode')
                            ->onIcon('heroicon-o-wrench-screwdriver')
                            ->offIcon('heroicon-o-check-circle')
                            ->inline(false),
                    ]),

                Section::make('Rate Limits')
                    ->description('Set download limits for free and premium users')
                    ->icon('heroicon-o-chart-bar')
                    ->collapsible()
                    ->schema([
                        TextInput::make('downloads_per_day_free')
                            ->label('Free User Daily Limit')
                            ->numeric()
                            ->required()
                            ->prefixIcon('heroicon-o-user')
                            ->suffix('downloads/day'),
                        
                        TextInput::make('downloads_per_day_premium')
                            ->label('Premium User Daily Limit')
                            ->numeric()
                            ->required()
                            ->prefixIcon('heroicon-o-star')
                            ->suffix('downloads/day'),
                    ])
                    ->columns(2),

                Section::make('Social Media Links')
                    ->description('Configure your social media profile URLs')
                    ->icon('heroicon-o-share')
                    ->collapsible()
                    ->schema([
                        TextInput::make('facebook_url')
                            ->label('Facebook URL')
                            ->url()
                            ->prefixIcon('heroicon-o-link')
                            ->placeholder('https://facebook.com/yourpage'),
                        
                        TextInput::make('twitter_url')
                            ->label('Twitter URL')
                            ->url()
                            ->prefixIcon('heroicon-o-link')
                            ->placeholder('https://twitter.com/yourhandle'),
                        
                        TextInput::make('instagram_url')
                            ->label('Instagram URL')
                            ->url()
                            ->prefixIcon('heroicon-o-link')
                            ->placeholder('https://instagram.com/yourprofile'),
                        
                        TextInput::make('youtube_url')
                            ->label('YouTube URL')
                            ->url()
                            ->prefixIcon('heroicon-o-link')
                            ->placeholder('https://youtube.com/@yourchannel'),
                    ])
                    ->columns(2),

                Section::make('Legal & Compliance')
                    ->description('Legal notices and terms')
                    ->icon('heroicon-o-scale')
                    ->collapsible()
                    ->schema([
                        Textarea::make('legal_notice')
                            ->label('Legal Notice')
                            ->helperText('Displayed in the footer')
                            ->rows(4)
                            ->columnSpanFull()
                            ->placeholder('Enter legal disclaimer or terms...'),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        SystemConfiguration::set('site_name', $data['site_name']);
        SystemConfiguration::set('site_logo', $data['site_logo'], 'string', 'branding');
        SystemConfiguration::set('site_favicon', $data['site_favicon'], 'string', 'branding');
        SystemConfiguration::set('premium_mode', $data['premium_mode'], 'boolean', 'billing');
        SystemConfiguration::set('maintenance_mode', $data['maintenance_mode'], 'boolean', 'system');
        SystemConfiguration::set('legal_notice', $data['legal_notice'], 'string', 'legal');
        SystemConfiguration::set('primary_color', $data['primary_color'], 'string', 'branding');
        SystemConfiguration::set('downloads_per_day_free', $data['downloads_per_day_free'], 'integer', 'limits');
        SystemConfiguration::set('downloads_per_day_premium', $data['downloads_per_day_premium'], 'integer', 'limits');
        SystemConfiguration::set('facebook_url', $data['facebook_url'], 'string', 'social');
        SystemConfiguration::set('twitter_url', $data['twitter_url'], 'string', 'social');
        SystemConfiguration::set('instagram_url', $data['instagram_url'], 'string', 'social');
        SystemConfiguration::set('youtube_url', $data['youtube_url'], 'string', 'social');
        SystemConfiguration::set('bkash_number', $data['bkash_number'], 'string', 'payment');
        SystemConfiguration::set('nagad_number', $data['nagad_number'], 'string', 'payment');
        SystemConfiguration::set('rocket_number', $data['rocket_number'], 'string', 'payment');

        Notification::make()
            ->success()
            ->title('Settings saved successfully')
            ->body('All changes have been applied.')
            ->send();
    }

    protected function getFormActions(): array
    {
        return [
            Action::make('save')
                ->label('Save Settings')
                ->icon('heroicon-o-check')
                ->submit('save')
                ->color('success'),
        ];
    }
}
