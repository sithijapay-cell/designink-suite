<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AdCreativeResource\Pages;
use App\Filament\Resources\AdCreativeResource\RelationManagers;
use App\Models\AdCreative;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class AdCreativeResource extends Resource
{
    protected static ?string $model = AdCreative::class;

    protected static ?string $navigationIcon = 'heroicon-o-photo';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\Select::make('zone_id')
                    ->relationship('zone', 'name')
                    ->required(),
                Forms\Components\Textarea::make('html_content')
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('image_path'),
                Forms\Components\TextInput::make('target_url')
                    ->url(),
                Forms\Components\TextInput::make('priority')
                    ->numeric()
                    ->default(0),
                Forms\Components\Toggle::make('is_active')
                    ->required(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('zone.name')->sortable(),
                Tables\Columns\TextColumn::make('priority')->sortable(),
                Tables\Columns\TextColumn::make('impressions')->sortable(),
                Tables\Columns\TextColumn::make('clicks')->sortable(),
                Tables\Columns\IconColumn::make('is_active')->boolean(),
                Tables\Columns\TextColumn::make('created_at')->dateTime()->sortable(),
            ])
            ->filters([
                //
            ])
            ->actions([
                Tables\Actions\EditAction::make(),
            ])
            ->bulkActions([
                Tables\Actions\BulkActionGroup::make([
                    Tables\Actions\DeleteBulkAction::make(),
                ]),
            ])
            ->emptyStateActions([
                Tables\Actions\CreateAction::make(),
            ]);
    }
    
    public static function getRelations(): array
    {
        return [
            //
        ];
    }
    
    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAdCreatives::route('/'),
            'create' => Pages\CreateAdCreative::route('/create'),
            'edit' => Pages\EditAdCreative::route('/{record}/edit'),
        ];
    }    
}
