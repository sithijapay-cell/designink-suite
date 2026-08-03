<?php

namespace App\Filament\Resources\DownloadJobResource\Pages;

use App\Filament\Resources\DownloadJobResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListDownloadJobs extends ListRecords
{
    protected static string $resource = DownloadJobResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
