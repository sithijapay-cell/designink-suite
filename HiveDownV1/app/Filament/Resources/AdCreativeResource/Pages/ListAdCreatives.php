<?php

namespace App\Filament\Resources\AdCreativeResource\Pages;

use App\Filament\Resources\AdCreativeResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListAdCreatives extends ListRecords
{
    protected static string $resource = AdCreativeResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
