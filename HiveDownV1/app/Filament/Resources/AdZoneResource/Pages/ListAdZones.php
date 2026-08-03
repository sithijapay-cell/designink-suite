<?php

namespace App\Filament\Resources\AdZoneResource\Pages;

use App\Filament\Resources\AdZoneResource;
use Filament\Actions;
use Filament\Resources\Pages\ListRecords;

class ListAdZones extends ListRecords
{
    protected static string $resource = AdZoneResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\CreateAction::make(),
        ];
    }
}
