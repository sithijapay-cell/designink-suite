<?php

namespace App\Filament\Resources\AdZoneResource\Pages;

use App\Filament\Resources\AdZoneResource;
use Filament\Actions;
use Filament\Resources\Pages\EditRecord;

class EditAdZone extends EditRecord
{
    protected static string $resource = AdZoneResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Actions\DeleteAction::make(),
        ];
    }
}
