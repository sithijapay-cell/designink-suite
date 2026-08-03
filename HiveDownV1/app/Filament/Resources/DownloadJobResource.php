<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DownloadJobResource\Pages;
use App\Filament\Resources\DownloadJobResource\RelationManagers;
use App\Models\DownloadJob;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletingScope;

class DownloadJobResource extends Resource
{
    protected static ?string $model = DownloadJob::class;

    protected static ?string $navigationIcon = 'heroicon-o-arrow-down-tray';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\TextInput::make('url')
                    ->required()
                    ->columnSpanFull(),
                Forms\Components\TextInput::make('provider')
                    ->readOnly(),
                Forms\Components\Select::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'processing' => 'Processing',
                        'completed' => 'Completed',
                        'failed' => 'Failed',
                    ])
                    ->required(),
                Forms\Components\TextInput::make('format')
                    ->readOnly(),
                Forms\Components\TextInput::make('quality')
                    ->readOnly(),
                Forms\Components\TextInput::make('file_path')
                    ->readOnly(),
                Forms\Components\TextInput::make('download_link')
                    ->columnSpanFull()
                    ->readOnly(),
                Forms\Components\Textarea::make('error_message')
                    ->columnSpanFull()
                    ->readOnly(),
                Forms\Components\KeyValue::make('meta_data')
                    ->disabled(),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('id')->sortable(),
                Tables\Columns\TextColumn::make('user.name')->label('User')->sortable(),
                Tables\Columns\TextColumn::make('url')->limit(50)->searchable(),
                Tables\Columns\TextColumn::make('provider')->sortable(),
                Tables\Columns\TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'pending' => 'warning',
                        'processing' => 'info',
                        'completed' => 'success',
                        'failed' => 'danger',
                    }),
                Tables\Columns\TextColumn::make('created_at')->dateTime()->sortable(),
            ])
            ->filters([
                Tables\Filters\SelectFilter::make('status')
                    ->options([
                        'pending' => 'Pending',
                        'processing' => 'Processing',
                        'completed' => 'Completed',
                        'failed' => 'Failed',
                    ]),
            ])
            ->actions([
                Tables\Actions\ViewAction::make(),
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
            'index' => Pages\ListDownloadJobs::route('/'),
            'create' => Pages\CreateDownloadJob::route('/create'),
            'edit' => Pages\EditDownloadJob::route('/{record}/edit'),
        ];
    }    
}
