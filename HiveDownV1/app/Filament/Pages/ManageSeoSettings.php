<?php

namespace App\Filament\Pages;

use App\Models\SystemConfiguration;
use Filament\Forms\Components\Section;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Actions\Action;

class ManageSeoSettings extends Page implements HasForms
{
    use InteractsWithForms;

    protected static ?string $navigationIcon = 'heroicon-o-magnifying-glass';
    protected static ?string $navigationLabel = 'SEO Settings';
    protected static ?string $title = 'SEO & Metadata';
    protected static ?string $navigationGroup = 'Settings';
    protected static ?int $navigationSort = 3;

    protected static string $view = 'filament.pages.manage-seo-settings';

    public ?array $data = [];

    public function mount(): void
    {
        $this->form->fill([
            'seo_title' => SystemConfiguration::get('seo_title', 'Video Downloader - Free Online Video Downloader'),
            'seo_description' => SystemConfiguration::get('seo_description', 'Download videos from YouTube, TikTok, Instagram, Facebook and more for free. Fast, secure, and high-quality downloads.'),
            'seo_keywords' => SystemConfiguration::get('seo_keywords', 'video downloader, free video downloader, youtube downloader, tiktok downloader'),
            'og_image_url' => SystemConfiguration::get('og_image_url', ''),
        ]);
    }

    public function form(Form $form): Form
    {
        return $form
            ->schema([
                Section::make('SEO & Metadata')
                    ->description('Configure search engine optimization settings')
                    ->icon('heroicon-o-magnifying-glass')
                    ->schema([
                        TextInput::make('seo_title')
                            ->label('Default Meta Title')
                            ->placeholder('Video Downloader - Download Videos from YouTube, TikTok, Instagram')
                            ->maxLength(60)
                            ->helperText('Default title for pages without specific titles'),
                        
                        Textarea::make('seo_description')
                            ->label('Default Meta Description')
                            ->placeholder('Download videos from YouTube, TikTok, Instagram, Facebook and more for free. High quality MP4/MP3 downloads.')
                            ->maxLength(160)
                            ->rows(3)
                            ->helperText('Default description for search results'),
                        
                        TextInput::make('seo_keywords')
                            ->label('Meta Keywords')
                            ->placeholder('video downloader, youtube downloader, tiktok downloader, free video download')
                            ->helperText('Comma separated keywords'),
                        
                        TextInput::make('og_image_url')
                            ->label('Social Share Image URL (OG Image)')
                            ->url()
                            ->placeholder('https://example.com/share-image.jpg')
                            ->helperText('Image displayed when sharing on Facebook/Twitter (1200x630px recommended)'),
                    ]),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        $data = $this->form->getState();

        SystemConfiguration::set('seo_title', $data['seo_title'], 'string', 'seo');
        SystemConfiguration::set('seo_description', $data['seo_description'], 'string', 'seo');
        SystemConfiguration::set('seo_keywords', $data['seo_keywords'], 'string', 'seo');
        SystemConfiguration::set('og_image_url', $data['og_image_url'], 'string', 'seo');

        Notification::make()
            ->success()
            ->title('SEO Settings saved')
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

    protected function hasFullWidthFormActions(): bool
    {
        return false;
    }
}
